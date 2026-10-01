/** Weighted average cost per unit after a buy. */
export function weightedAverageCost(
  oldQty: number,
  oldCost: number | null,
  buyQty: number,
  buyPrice: number,
): number {
  const newQty = oldQty + buyQty;
  if (newQty <= 0) return buyPrice;
  if (oldCost == null || oldQty <= 0) return buyPrice;
  return (oldQty * oldCost + buyQty * buyPrice) / newQty;
}

export function formatTradeQty(qty: number): string {
  if (Number.isInteger(qty)) return String(qty);
  return qty
    .toFixed(8)
    .replace(/\.?0+$/, "");
}

export type CryptoTradeRow = {
  id: number;
  side: "buy" | "sell";
  symbol: string;
  quantity: string | null;
  amount: number;
  currency: string;
  date: string;
  accountName: string;
  description: string | null;
};

const TRADE_DESCRIPTION = /^(Buy|Sell)\s+([\d.]+)\s+(\S+)$/i;

export function parseCryptoTradeDescription(description: string | null): {
  side: "buy" | "sell";
  quantity: string;
  symbol: string;
} | null {
  if (!description) return null;
  const match = description.trim().match(TRADE_DESCRIPTION);
  if (!match) return null;
  return {
    side: match[1].toLowerCase() as "buy" | "sell",
    quantity: match[2],
    symbol: match[3].toUpperCase(),
  };
}
