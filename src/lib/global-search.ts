import { and, asc, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { accounts, recurringItems } from "@/db/schema";
import { isBillEnded } from "@/lib/bills";
import {
  searchExpenses,
  type ExpenseOperation,
} from "@/lib/expense-stats";

export type GlobalSearchAccount = {
  id: number;
  name: string;
  type: string;
  currency: string;
};

export type GlobalSearchBill = {
  id: number;
  name: string;
  amount: number;
  currency: string;
  nextDueDate: string | null;
};

export type GlobalSearchResult = {
  operations: ExpenseOperation[];
  accounts: GlobalSearchAccount[];
  bills: GlobalSearchBill[];
};

export function searchGlobal(
  query: string,
  limit = 8,
): GlobalSearchResult {
  const q = query.trim();
  if (!q) {
    return { operations: [], accounts: [], bills: [] };
  }

  const pattern = `%${q}%`;

  const operations = searchExpenses(q, limit);

  const accountRows = db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
      currency: accounts.currency,
    })
    .from(accounts)
    .where(like(accounts.name, pattern))
    .orderBy(asc(accounts.name))
    .limit(limit)
    .all();

  const billRows = db
    .select({
      id: recurringItems.id,
      name: recurringItems.name,
      amount: recurringItems.amount,
      currency: recurringItems.currency,
      nextDueDate: recurringItems.nextDueDate,
      endDate: recurringItems.endDate,
    })
    .from(recurringItems)
    .where(and(eq(recurringItems.isBill, 1), like(recurringItems.name, pattern)))
    .orderBy(asc(recurringItems.name))
    .limit(limit * 2)
    .all()
    .filter((row) => !isBillEnded(row.endDate, row.nextDueDate))
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      name: row.name,
      amount: row.amount,
      currency: row.currency,
      nextDueDate: row.nextDueDate,
    }));

  return {
    operations,
    accounts: accountRows,
    bills: billRows,
  };
}
