import { db } from "@/db";
import { accountTransfers, accounts, expenses } from "@/db/schema";
import { todayISO } from "@/lib/format";

export type AccountLineMetrics = {
  change30dPercent: number | null;
  lastActivityDate: string | null;
};

function daysAgoISO(days: number, today = todayISO()): string {
  const d = new Date(`${today}T00:00:00`);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function maxDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

/**
 * Per-account 30-day balance change (%) and last activity date.
 * Change is reconstructed from expenses + transfers over the last 30 days.
 * Last activity is the latest expense/transfer date, falling back to updatedAt.
 */
export function getAccountLineMetrics(
  accountRows: { id: number; balance: number; updatedAt: string }[],
  daysBack = 30,
): Map<number, AccountLineMetrics> {
  const result = new Map<number, AccountLineMetrics>();
  for (const a of accountRows) {
    result.set(a.id, {
      change30dPercent: null,
      lastActivityDate: a.updatedAt.slice(0, 10),
    });
  }
  if (accountRows.length === 0) return result;

  const startDate = daysAgoISO(daysBack);
  const netChange = new Map<number, number>();

  const expenseRows = db
    .select({
      accountId: expenses.accountId,
      amount: expenses.amount,
      type: expenses.type,
      date: expenses.date,
    })
    .from(expenses)
    .all();

  for (const row of expenseRows) {
    const metrics = result.get(row.accountId);
    if (!metrics) continue;

    metrics.lastActivityDate = maxDate(metrics.lastActivityDate, row.date);

    if (row.date >= startDate) {
      const signed = row.type === "income" ? row.amount : -row.amount;
      netChange.set(row.accountId, (netChange.get(row.accountId) ?? 0) + signed);
    }
  }

  const transferRows = db
    .select({
      fromAccountId: accountTransfers.fromAccountId,
      toAccountId: accountTransfers.toAccountId,
      sentAmount: accountTransfers.sentAmount,
      receivedAmount: accountTransfers.receivedAmount,
      date: accountTransfers.date,
    })
    .from(accountTransfers)
    .all();

  for (const row of transferRows) {
    const fromMetrics = result.get(row.fromAccountId);
    const toMetrics = result.get(row.toAccountId);
    if (fromMetrics) {
      fromMetrics.lastActivityDate = maxDate(
        fromMetrics.lastActivityDate,
        row.date,
      );
    }
    if (toMetrics) {
      toMetrics.lastActivityDate = maxDate(toMetrics.lastActivityDate, row.date);
    }

    if (row.date >= startDate) {
      if (result.has(row.fromAccountId)) {
        netChange.set(
          row.fromAccountId,
          (netChange.get(row.fromAccountId) ?? 0) - row.sentAmount,
        );
      }
      if (result.has(row.toAccountId)) {
        netChange.set(
          row.toAccountId,
          (netChange.get(row.toAccountId) ?? 0) + row.receivedAmount,
        );
      }
    }
  }

  // Interest credits are logged as expenses (income), so already covered.

  for (const a of accountRows) {
    const change = netChange.get(a.id) ?? 0;
    const pastBalance = a.balance - change;
    const metrics = result.get(a.id)!;

    if (Math.abs(pastBalance) < 0.005) {
      metrics.change30dPercent =
        Math.abs(a.balance) < 0.005 ? 0 : null;
    } else {
      metrics.change30dPercent = (change / Math.abs(pastBalance)) * 100;
    }
  }

  return result;
}

/** Convenience when you only need metrics for all accounts in the DB. */
export function getAllAccountLineMetrics(daysBack = 30) {
  const rows = db
    .select({
      id: accounts.id,
      balance: accounts.balance,
      updatedAt: accounts.updatedAt,
    })
    .from(accounts)
    .all();
  return getAccountLineMetrics(rows, daysBack);
}
