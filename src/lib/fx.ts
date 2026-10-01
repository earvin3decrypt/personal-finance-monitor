import { db } from "@/db";
import { fxRates } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { isMarketDataCacheFresh } from "@/lib/market-data-cache";

export type FxFetchResult = {
  rates: Map<string, number>;
  stale: boolean;
  fetchedAt: string | null;
};

async function fetchRatesFromApi(base: string): Promise<Record<string, number>> {
  const url = `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`FX API error: ${res.status}`);
  const data = (await res.json()) as { rates?: Record<string, number> };
  if (!data.rates) throw new Error("FX API returned no rates");
  return data.rates;
}

function loadCachedRates(base: string): FxFetchResult {
  const rows = db
    .select()
    .from(fxRates)
    .where(eq(fxRates.base, base))
    .orderBy(desc(fxRates.fetchedAt))
    .all();

  const latestByQuote = new Map<string, { rate: number; fetchedAt: string }>();
  for (const row of rows) {
    if (!latestByQuote.has(row.quote)) {
      latestByQuote.set(row.quote, { rate: row.rate, fetchedAt: row.fetchedAt });
    }
  }

  const rates = new Map<string, number>();
  let fetchedAt: string | null = null;
  for (const [quote, { rate, fetchedAt: at }] of latestByQuote) {
    rates.set(quote, rate);
    if (!fetchedAt || at > fetchedAt) fetchedAt = at;
  }
  rates.set(base, 1);

  const hasRates = rates.size > 1;
  return {
    rates,
    stale: !hasRates || !isMarketDataCacheFresh(fetchedAt),
    fetchedAt,
  };
}

export async function getFxRates(
  base: string,
  options?: { forceRefresh?: boolean },
): Promise<FxFetchResult> {
  if (!options?.forceRefresh) {
    const cached = loadCachedRates(base);
    if (cached.rates.size > 1 && !cached.stale) {
      return cached;
    }
  }

  try {
    const apiRates = await fetchRatesFromApi(base);
    const now = new Date().toISOString();
    const entries = Object.entries(apiRates);

    for (const [quote, rate] of entries) {
      db.insert(fxRates)
        .values({ base, quote, rate, fetchedAt: now })
        .run();
    }

    const rates = new Map<string, number>(entries);
    rates.set(base, 1);
    return { rates, stale: false, fetchedAt: now };
  } catch {
    return loadCachedRates(base);
  }
}

export async function convertToBase(
  amount: number,
  fromCurrency: string,
  baseCurrency: string,
  fx: FxFetchResult,
): Promise<number> {
  if (fromCurrency === baseCurrency) return amount;
  const direct = fx.rates.get(fromCurrency);
  if (direct && direct > 0) return amount / direct;

  const row = db
    .select()
    .from(fxRates)
    .where(and(eq(fxRates.base, baseCurrency), eq(fxRates.quote, fromCurrency)))
    .orderBy(desc(fxRates.fetchedAt))
    .limit(1)
    .all()[0];

  if (row && row.rate > 0) return amount / row.rate;

  console.warn(
    `[FX] No rate for ${fromCurrency} → ${baseCurrency}; excluding ${amount} ${fromCurrency} from totals`,
  );
  fx.stale = true;
  return 0;
}
