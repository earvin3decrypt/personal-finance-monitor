import { db } from "@/db";
import { cryptoHoldings, holdings, priceSnapshots } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { toCryptoPriceSymbol } from "@/lib/crypto-symbols";
import { isMarketDataCacheFresh } from "@/lib/market-data-cache";

export type PriceInfo = {
  symbol: string;
  price: number;
  currency: string;
  stale: boolean;
  fetchedAt: string | null;
};

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const YF_IMPORT_BASE = "https://yf-import.gionn.net/api/quotes";

function inferCurrencyFromSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (
    upper.endsWith(".PA") ||
    upper.endsWith(".DE") ||
    upper.endsWith(".MI") ||
    upper.endsWith(".AS") ||
    upper.endsWith(".BR")
  ) {
    return "EUR";
  }
  if (upper.endsWith(".L")) return "GBP";
  if (upper.endsWith(".SW")) return "CHF";
  if (upper.endsWith(".ST") || upper.endsWith(".CO")) return "SEK";
  if (upper.endsWith(".OL")) return "NOK";
  if (upper.endsWith(".TO")) return "CAD";
  if (upper.endsWith(".AX")) return "AUD";
  return "USD";
}

function getCachedPrice(symbol: string): PriceInfo | null {
  const row = db
    .select()
    .from(priceSnapshots)
    .where(eq(priceSnapshots.symbol, symbol.toUpperCase()))
    .orderBy(desc(priceSnapshots.fetchedAt))
    .limit(1)
    .all()[0];

  if (!row) return null;
  return {
    symbol: row.symbol,
    price: row.price,
    currency: row.currency,
    stale: !isMarketDataCacheFresh(row.fetchedAt),
    fetchedAt: row.fetchedAt,
  };
}

function savePriceSnapshot(
  symbol: string,
  price: number,
  currency: string,
): string {
  const now = new Date().toISOString();
  const upper = symbol.toUpperCase();
  db.insert(priceSnapshots)
    .values({
      symbol: upper,
      price,
      currency,
      fetchedAt: now,
    })
    .run();
  return now;
}

async function fetchPriceFromYahooChart(
  symbol: string,
): Promise<{ price: number; currency: string }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": BROWSER_UA },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Yahoo chart API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    chart?: {
      result?: Array<{
        meta?: { regularMarketPrice?: number; currency?: string };
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
    };
  };

  const result = data.chart?.result?.[0];
  if (!result) throw new Error(`No chart data for ${symbol}`);

  let price = result.meta?.regularMarketPrice;
  if (price == null) {
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const valid = closes.filter((v): v is number => v != null);
    price = valid.at(-1);
  }

  if (price == null || !Number.isFinite(price)) {
    throw new Error(`No price in chart response for ${symbol}`);
  }

  const currency =
    result.meta?.currency ?? inferCurrencyFromSymbol(symbol);

  return { price, currency };
}

async function fetchPriceFromYfImport(
  symbol: string,
): Promise<{ price: number; currency: string }> {
  const res = await fetch(
    `${YF_IMPORT_BASE}/${encodeURIComponent(symbol)}`,
    { cache: "no-store" },
  );
  const text = (await res.text()).trim();
  if (!res.ok) {
    throw new Error(`yf-import error: ${res.status}`);
  }

  const price = Number.parseFloat(text);
  if (!Number.isFinite(price)) {
    throw new Error(`yf-import returned invalid price: ${text}`);
  }

  return {
    price,
    currency: inferCurrencyFromSymbol(symbol),
  };
}

async function fetchPriceFromApi(symbol: string): Promise<PriceInfo> {
  const upper = symbol.toUpperCase();
  let lastError: unknown;

  for (const fetcher of [fetchPriceFromYahooChart, fetchPriceFromYfImport]) {
    try {
      const { price, currency } = await fetcher(upper);
      const fetchedAt = savePriceSnapshot(upper, price, currency);
      return {
        symbol: upper,
        price,
        currency,
        stale: false,
        fetchedAt,
      };
    } catch (err) {
      lastError = err;
      console.warn(
        `[prices] ${fetcher.name} failed for ${upper}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to fetch price for ${upper}`);
}

export async function getPrice(
  symbol: string,
  options?: { forceRefresh?: boolean },
): Promise<PriceInfo | null> {
  const upper = symbol.toUpperCase();
  if (!options?.forceRefresh) {
    const cached = getCachedPrice(upper);
    if (cached && !cached.stale) return cached;
  }

  try {
    return await fetchPriceFromApi(upper);
  } catch (err) {
    console.warn(`[prices] All sources failed for ${upper}:`, err);
    return getCachedPrice(upper);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function refreshAllPrices(): Promise<{
  updated: number;
  stale: boolean;
}> {
  const stockSymbols = [
    ...new Set(
      db
        .select({ symbol: holdings.symbol })
        .from(holdings)
        .all()
        .map((h) => h.symbol.toUpperCase()),
    ),
  ];
  const cryptoPriceSymbols = [
    ...new Set(
      db
        .select({ symbol: cryptoHoldings.symbol })
        .from(cryptoHoldings)
        .all()
        .map((c) => toCryptoPriceSymbol(c.symbol)),
    ),
  ];
  const symbols = [...new Set([...stockSymbols, ...cryptoPriceSymbols])];

  let updated = 0;
  let anyStale = false;

  for (let i = 0; i < symbols.length; i++) {
    if (i > 0) await delay(300);
    const result = await getPrice(symbols[i], { forceRefresh: true });
    if (result) {
      if (!result.stale) updated += 1;
      else anyStale = true;
    } else {
      anyStale = true;
    }
  }

  return { updated, stale: anyStale };
}

export async function getPricesForSymbols(
  symbols: string[],
  options?: { forceRefresh?: boolean },
): Promise<Map<string, PriceInfo>> {
  const map = new Map<string, PriceInfo>();
  for (let i = 0; i < symbols.length; i++) {
    if (i > 0 && options?.forceRefresh) await delay(300);
    const price = await getPrice(symbols[i], options);
    if (price) map.set(symbols[i].toUpperCase(), price);
  }
  return map;
}
