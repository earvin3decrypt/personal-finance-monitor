export type HoldingTradeRow = {
  id: number;
  holdingId: number;
  side: "buy" | "sell";
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  date: string;
  accountId: number | null;
  createdAt: string;
  accountName: string | null;
};

export type HoldingTradeSummary = {
  shares: number;
  totalCost: number;
  avgCost: number;
  marketValue: number | null;
  totalGains: number | null;
  totalGainsPercent: number | null;
  transactionCount: number;
};

export function buildHoldingTradeSummary(
  trades: HoldingTradeRow[],
  shares: number,
  avgCost: number,
  currentPrice: number | null,
): HoldingTradeSummary {
  const totalCost = avgCost * shares;
  const marketValue =
    currentPrice != null ? currentPrice * shares : null;
  const totalGains =
    marketValue != null ? marketValue - totalCost : null;
  const totalGainsPercent =
    totalGains != null && totalCost > 0
      ? (totalGains / totalCost) * 100
      : null;

  return {
    shares,
    totalCost,
    avgCost,
    marketValue,
    totalGains,
    totalGainsPercent,
    transactionCount: trades.length,
  };
}

export function lotMetrics(
  trade: HoldingTradeRow,
  currentPrice: number | null,
): {
  lotValue: number | null;
  lotGains: number | null;
  lotGainsPercent: number | null;
} {
  if (currentPrice == null) {
    return { lotValue: null, lotGains: null, lotGainsPercent: null };
  }

  const lotValue = currentPrice * trade.quantity;
  const lotCost = trade.totalAmount;
  const lotGains = trade.side === "buy" ? lotValue - lotCost : null;
  const lotGainsPercent =
    lotGains != null && lotCost > 0 ? (lotGains / lotCost) * 100 : null;

  return { lotValue, lotGains, lotGainsPercent };
}
