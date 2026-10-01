import { db } from "@/db";
import { accounts, holdingTrades, holdings } from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import type { HoldingTradeRow } from "@/lib/holding-trade-metrics";

export type { HoldingTradeRow, HoldingTradeSummary } from "@/lib/holding-trade-metrics";
export { buildHoldingTradeSummary, lotMetrics } from "@/lib/holding-trade-metrics";

export function getTradesForHolding(holdingId: number): HoldingTradeRow[] {
  const rows = db
    .select({
      id: holdingTrades.id,
      holdingId: holdingTrades.holdingId,
      side: holdingTrades.side,
      quantity: holdingTrades.quantity,
      unitPrice: holdingTrades.unitPrice,
      totalAmount: holdingTrades.totalAmount,
      currency: holdingTrades.currency,
      date: holdingTrades.date,
      accountId: holdingTrades.accountId,
      createdAt: holdingTrades.createdAt,
      accountName: accounts.name,
    })
    .from(holdingTrades)
    .leftJoin(accounts, eq(holdingTrades.accountId, accounts.id))
    .where(eq(holdingTrades.holdingId, holdingId))
    .orderBy(asc(holdingTrades.date), asc(holdingTrades.id))
    .all();

  return rows.map((r) => ({
    ...r,
    accountName: r.accountName ?? null,
  }));
}

export function getTradesForHoldings(
  holdingIds: number[],
): Map<number, HoldingTradeRow[]> {
  const map = new Map<number, HoldingTradeRow[]>();
  if (holdingIds.length === 0) return map;

  const rows = db
    .select({
      id: holdingTrades.id,
      holdingId: holdingTrades.holdingId,
      side: holdingTrades.side,
      quantity: holdingTrades.quantity,
      unitPrice: holdingTrades.unitPrice,
      totalAmount: holdingTrades.totalAmount,
      currency: holdingTrades.currency,
      date: holdingTrades.date,
      accountId: holdingTrades.accountId,
      createdAt: holdingTrades.createdAt,
      accountName: accounts.name,
    })
    .from(holdingTrades)
    .leftJoin(accounts, eq(holdingTrades.accountId, accounts.id))
    .where(inArray(holdingTrades.holdingId, holdingIds))
    .orderBy(asc(holdingTrades.date), asc(holdingTrades.id))
    .all();

  for (const row of rows) {
    const list = map.get(row.holdingId) ?? [];
    list.push({ ...row, accountName: row.accountName ?? null });
    map.set(row.holdingId, list);
  }

  return map;
}

/** Recompute quantity and weighted avg cost from trade lots. */
export function syncHoldingFromTrades(holdingId: number): void {
  const trades = db
    .select()
    .from(holdingTrades)
    .where(eq(holdingTrades.holdingId, holdingId))
    .orderBy(asc(holdingTrades.date), asc(holdingTrades.id))
    .all();

  let netQty = 0;
  let totalCost = 0;

  for (const trade of trades) {
    if (trade.side === "buy") {
      totalCost += trade.totalAmount;
      netQty += trade.quantity;
    } else {
      if (netQty > 0) {
        const avgCost = totalCost / netQty;
        const sellQty = Math.min(trade.quantity, netQty);
        totalCost -= sellQty * avgCost;
      }
      netQty -= trade.quantity;
    }
  }

  if (netQty <= 0) {
    db.update(holdings)
      .set({ quantity: 0, costBasis: 0 })
      .where(eq(holdings.id, holdingId))
      .run();
    return;
  }

  const costBasis = totalCost / netQty;

  db.update(holdings)
    .set({ quantity: netQty, costBasis })
    .where(eq(holdings.id, holdingId))
    .run();
}
