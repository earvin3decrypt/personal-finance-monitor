import { db } from "@/db";
import { accounts, accountTransfers } from "@/db/schema";
import { alias } from "drizzle-orm/sqlite-core";
import { desc, eq } from "drizzle-orm";

export type TransferHistoryRow = {
  id: number;
  fromAccountId: number;
  toAccountId: number;
  fromAccountName: string;
  toAccountName: string;
  sentAmount: number;
  sentCurrency: string;
  receivedAmount: number;
  receivedCurrency: string;
  date: string;
  note: string | null;
  createdAt: string;
};

export function getRecentTransfers(limit = 50): TransferHistoryRow[] {
  const fromAccounts = alias(accounts, "from_accounts");
  const toAccounts = alias(accounts, "to_accounts");

  return db
    .select({
      id: accountTransfers.id,
      fromAccountId: accountTransfers.fromAccountId,
      toAccountId: accountTransfers.toAccountId,
      fromAccountName: fromAccounts.name,
      toAccountName: toAccounts.name,
      sentAmount: accountTransfers.sentAmount,
      sentCurrency: accountTransfers.sentCurrency,
      receivedAmount: accountTransfers.receivedAmount,
      receivedCurrency: accountTransfers.receivedCurrency,
      date: accountTransfers.date,
      note: accountTransfers.note,
      createdAt: accountTransfers.createdAt,
    })
    .from(accountTransfers)
    .innerJoin(
      fromAccounts,
      eq(accountTransfers.fromAccountId, fromAccounts.id),
    )
    .innerJoin(toAccounts, eq(accountTransfers.toAccountId, toAccounts.id))
    .orderBy(desc(accountTransfers.date), desc(accountTransfers.id))
    .limit(limit)
    .all();
}
