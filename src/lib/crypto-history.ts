import { db } from "@/db";
import { accounts, categories, expenses } from "@/db/schema";
import { and, desc, eq, isNull, like, or } from "drizzle-orm";
import {
  parseCryptoTradeDescription,
  type CryptoTradeRow,
} from "@/lib/crypto-trades";

export function getCryptoTradeHistory(limit = 50): CryptoTradeRow[] {
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
    .limit(limit)
    .all();

  const trades: CryptoTradeRow[] = [];

  for (const row of rows) {
    const parsed = parseCryptoTradeDescription(row.description);
    if (!parsed) continue;

    trades.push({
      id: row.id,
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
