import { db } from "@/db";
import { accounts, cryptoHoldings, dividends, holdings } from "@/db/schema";
import { desc } from "drizzle-orm";
import { convertToBase, getFxRates } from "@/lib/fx";
import { toCryptoPriceSymbol } from "@/lib/crypto-symbols";
import { getPricesForSymbols } from "@/lib/prices";
import { getBaseCurrency } from "@/lib/settings";

export type HoldingWithMetrics = {
  id: number;
  symbol: string;
  name: string;
  assetType: string;
  quantity: number;
  costBasis: number;
  currency: string;
  accountId: number | null;
  currentPrice: number | null;
  priceCurrency: string | null;
  marketValue: number | null;
  marketValueBase: number | null;
  costTotal: number;
  costTotalBase: number;
  pl: number | null;
  plPercent: number | null;
  priceStale: boolean;
};

export type DividendWithMetrics = {
  id: number;
  amount: number;
  currency: string;
  amountBase: number;
  date: string;
  description: string | null;
};

export type CryptoWithMetrics = {
  id: number;
  symbol: string;
  name: string;
  quantity: number;
  costBasis: number | null;
  currency: string;
  currentPrice: number | null;
  priceCurrency: string | null;
  marketValue: number | null;
  marketValueBase: number | null;
  costTotal: number | null;
  costTotalBase: number | null;
  pl: number | null;
  plPercent: number | null;
  priceStale: boolean;
};

export type PortfolioSummary = {
  baseCurrency: string;
  cashTotalBase: number;
  investmentsMarketValueBase: number;
  dividendsTotalBase: number;
  investmentsTotalBase: number;
  cryptoTotalBase: number;
  netWorthBase: number;
  fxStale: boolean;
  pricesStale: boolean;
  holdings: HoldingWithMetrics[];
  crypto: CryptoWithMetrics[];
  dividends: DividendWithMetrics[];
  byCurrency: Record<string, number>;
};

export async function getPortfolioSummary(options?: {
  forceRefreshPrices?: boolean;
  forceRefreshFx?: boolean;
}): Promise<PortfolioSummary> {
  const baseCurrency = await getBaseCurrency();
  const fx = await getFxRates(baseCurrency, {
    forceRefresh: options?.forceRefreshFx,
  });

  const accountRows = db.select().from(accounts).all();
  let cashTotalBase = 0;
  for (const account of accountRows) {
    cashTotalBase += await convertToBase(
      account.balance,
      account.currency,
      baseCurrency,
      fx,
    );
  }

  const holdingRows = db.select().from(holdings).all();

  const dividendRows = db
    .select({
      id: dividends.id,
      holdingId: dividends.holdingId,
      amount: dividends.amount,
      currency: dividends.currency,
      date: dividends.date,
      description: dividends.description,
    })
    .from(dividends)
    .orderBy(desc(dividends.date), desc(dividends.id))
    .all();

  let dividendsTotalBase = 0;
  const dividendsWithMetrics: DividendWithMetrics[] = [];

  for (const d of dividendRows) {
    const amountBase = await convertToBase(
      d.amount,
      d.currency,
      baseCurrency,
      fx,
    );
    dividendsTotalBase += amountBase;

    dividendsWithMetrics.push({
      id: d.id,
      amount: d.amount,
      currency: d.currency,
      amountBase,
      date: d.date,
      description: d.description,
    });
  }

  const symbols = [...new Set(holdingRows.map((h) => h.symbol.toUpperCase()))];
  const cryptoRows = db.select().from(cryptoHoldings).all();
  const cryptoPriceSymbols = [
    ...new Set(cryptoRows.map((c) => toCryptoPriceSymbol(c.symbol))),
  ];
  const allPriceSymbols = [...new Set([...symbols, ...cryptoPriceSymbols])];

  const prices = await getPricesForSymbols(allPriceSymbols, {
    forceRefresh: options?.forceRefreshPrices,
  });

  let investmentsMarketValueBase = 0;
  let pricesStale = false;
  const byCurrency: Record<string, number> = {};
  const holdingsWithMetrics: HoldingWithMetrics[] = [];

  for (const h of holdingRows) {
    const priceInfo = prices.get(h.symbol.toUpperCase());
    if (priceInfo?.stale) pricesStale = true;

    const currentPrice = priceInfo?.price ?? null;
    const priceCurrency = priceInfo?.currency ?? h.currency;
    const marketValue =
      currentPrice != null ? currentPrice * h.quantity : null;

    let marketValueBase: number | null = null;
    if (marketValue != null) {
      marketValueBase = await convertToBase(
        marketValue,
        priceCurrency,
        baseCurrency,
        fx,
      );
      investmentsMarketValueBase += marketValueBase;
      byCurrency[priceCurrency] =
        (byCurrency[priceCurrency] ?? 0) + marketValue;
    }

    const costTotal = h.costBasis * h.quantity;
    const costTotalBase = await convertToBase(
      costTotal,
      h.currency,
      baseCurrency,
      fx,
    );

    const pl =
      marketValueBase != null ? marketValueBase - costTotalBase : null;
    const plPercent =
      pl != null && costTotalBase > 0
        ? (pl / costTotalBase) * 100
        : null;

    holdingsWithMetrics.push({
      id: h.id,
      symbol: h.symbol,
      name: h.name,
      assetType: h.assetType,
      quantity: h.quantity,
      costBasis: h.costBasis,
      currency: h.currency,
      accountId: h.accountId,
      currentPrice,
      priceCurrency,
      marketValue,
      marketValueBase,
      costTotal,
      costTotalBase,
      pl,
      plPercent,
      priceStale: priceInfo?.stale ?? true,
    });
  }

  let cryptoTotalBase = 0;
  const cryptoWithMetrics: CryptoWithMetrics[] = [];

  for (const c of cryptoRows) {
    const priceKey = toCryptoPriceSymbol(c.symbol);
    const priceInfo = prices.get(priceKey);
    if (priceInfo?.stale) pricesStale = true;

    const currentPrice = priceInfo?.price ?? null;
    const priceCurrency = priceInfo?.currency ?? c.currency;
    const marketValue =
      currentPrice != null ? currentPrice * c.quantity : null;

    let marketValueBase: number | null = null;
    if (marketValue != null) {
      marketValueBase = await convertToBase(
        marketValue,
        priceCurrency,
        baseCurrency,
        fx,
      );
      cryptoTotalBase += marketValueBase;
      byCurrency[priceCurrency] =
        (byCurrency[priceCurrency] ?? 0) + marketValue;
    }

    const costTotal =
      c.costBasis != null ? c.costBasis * c.quantity : null;
    let costTotalBase: number | null = null;
    if (costTotal != null) {
      costTotalBase = await convertToBase(
        costTotal,
        c.currency,
        baseCurrency,
        fx,
      );
    }

    const pl =
      marketValueBase != null && costTotalBase != null
        ? marketValueBase - costTotalBase
        : null;
    const plPercent =
      pl != null && costTotalBase != null && costTotalBase > 0
        ? (pl / costTotalBase) * 100
        : null;

    cryptoWithMetrics.push({
      id: c.id,
      symbol: c.symbol,
      name: c.name,
      quantity: c.quantity,
      costBasis: c.costBasis,
      currency: c.currency,
      currentPrice,
      priceCurrency,
      marketValue,
      marketValueBase,
      costTotal,
      costTotalBase,
      pl,
      plPercent,
      priceStale: priceInfo?.stale ?? true,
    });
  }

  const investmentsTotalBase =
    investmentsMarketValueBase + dividendsTotalBase;

  return {
    baseCurrency,
    cashTotalBase,
    investmentsMarketValueBase,
    dividendsTotalBase,
    investmentsTotalBase,
    cryptoTotalBase,
    netWorthBase: cashTotalBase + investmentsTotalBase + cryptoTotalBase,
    fxStale: fx.stale,
    pricesStale,
    holdings: holdingsWithMetrics,
    crypto: cryptoWithMetrics,
    dividends: dividendsWithMetrics,
    byCurrency,
  };
}
