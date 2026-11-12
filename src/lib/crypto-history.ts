import { db } from "@/db";
import {
  accounts,
  categories,
  cryptoTrades,
  expenses,
} from "@/db/schema";
import { and, desc, eq, isNull, like, or } from "drizzle-orm";
import {
  formatTradeQty,
  parseCryptoTradeDescription,
  type CryptoTradeRow,
} from "@/lib/crypto-trades";

function getExpenseCryptoTrades(): CryptoTradeRow[] {
  const rows = db
    .select({
      id: expenses.id,
      amount: expenses.amount,
      currency: expenses.currency,
      date: expenses.date,
      description: expenses.description,
      accountName: accounts.name,
    })
    .from(expenses)
    .innerJoin(categories, eq(expenses.categoryId, categories.id))
    .innerJoin(accounts, eq(expenses.accountId, accounts.id))
    .where(
      and(
        eq(categories.name, "Crypto"),
        isNull(categories.parentId),
        or(
          like(expenses.description, "Buy %"),
          like(expenses.description, "Sell %"),
        ),
      ),
    )
    .orderBy(desc(expenses.date), desc(expenses.id))
    .all();

  const trades: CryptoTradeRow[] = [];

  for (const row of rows) {
    const parsed = parseCryptoTradeDescription(row.description);
    if (!parsed) continue;

    trades.push({
      id: row.id,
      source: "operation",
      side: parsed.side,
      symbol: parsed.symbol,
      quantity: parsed.quantity,
      amount: row.amount,
      currency: row.currency,
      date: row.date,
      accountName: row.accountName,
      description: row.description,
    });
  }

  return trades;
}

function getOpeningCryptoTrades(): CryptoTradeRow[] {
  const rows = db
    .select()
    .from(cryptoTrades)
    .orderBy(desc(cryptoTrades.date), desc(cryptoTrades.id))
    .all();

  return rows.map((row) => ({
    id: row.id,
    source: "opening" as const,
    side: "buy" as const,
    symbol: row.symbol.toUpperCase(),
    quantity: formatTradeQty(row.quantity),
    amount: row.totalAmount,
    currency: row.currency,
    date: row.date,
    accountName: "Opening position",
    description: `Buy ${formatTradeQty(row.quantity)} ${row.symbol}`,
  }));
}

export function getCryptoTradeHistory(limit = 50): CryptoTradeRow[] {
  const merged = [
    ...getExpenseCryptoTrades(),
    ...getOpeningCryptoTrades(),
  ].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.id - a.id;
  });

  return merged.slice(0, limit);
}

/** Earliest buy date per symbol across opening trades and expense buys. */
export function getCryptoFirstPurchaseDates(): Map<string, string> {
  const map = new Map<string, string>();

  function consider(symbol: string, date: string, side: "buy" | "sell") {
    if (side !== "buy") return;
    const key = symbol.toUpperCase();
    const existing = map.get(key);
    if (!existing || date < existing) map.set(key, date);
  }

  for (const trade of getOpeningCryptoTrades()) {
    consider(trade.symbol, trade.date, trade.side);
  }
  for (const trade of getExpenseCryptoTrades()) {
    consider(trade.symbol, trade.date, trade.side);
  }

  return map;
}
