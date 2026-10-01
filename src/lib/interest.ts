import { db } from "@/db";
import { accounts, expenses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureInterestCategory } from "@/lib/categories";
import { todayISO } from "@/lib/format";

type InterestPeriod = "month" | "day";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function monthStartISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function dateISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function lastDayOfMonth(date: Date): string {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return dateISO(end);
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function dayLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function creditMonthlyInterest(
  account: {
    id: number;
    balance: number;
    currency: string;
    interestRate: number;
    lastInterestDate: string | null;
  },
  interestCategoryId: number,
  now: string,
): { balance: number; credited: boolean; lastInterestDate: string | null } {
  const today = todayISO();
  const currentMonthStart = new Date(`${today.slice(0, 7)}-01T00:00:00`);
  const currentMonthStartISO = monthStartISO(currentMonthStart);
  const rate = account.interestRate;

  let cursor = account.lastInterestDate
    ? addMonths(new Date(`${account.lastInterestDate}T00:00:00`), 1)
    : new Date(currentMonthStart);

  let balance = account.balance;
  let credited = false;

  while (cursor < currentMonthStart) {
    const interest = round2((balance * rate) / 100 / 12);
    if (interest > 0) {
      db.insert(expenses)
        .values({
          accountId: account.id,
          categoryId: interestCategoryId,
          subcategoryId: null,
          type: "income",
          amount: interest,
          currency: account.currency,
          description: `Interest — ${monthLabel(cursor)}`,
          date: lastDayOfMonth(cursor),
          createdAt: now,
        })
        .run();
      balance = round2(balance + interest);
      credited = true;
    }

    cursor = addMonths(cursor, 1);
  }

  return {
    balance,
    credited,
    lastInterestDate: credited ? currentMonthStartISO : account.lastInterestDate,
  };
}

function creditDailyInterest(
  account: {
    id: number;
    balance: number;
    currency: string;
    interestRate: number;
    lastInterestDate: string | null;
  },
  interestCategoryId: number,
  now: string,
): { balance: number; credited: boolean; lastInterestDate: string | null } {
  const today = todayISO();
  const todayDate = new Date(`${today}T00:00:00`);
  const rate = account.interestRate;

  let cursor = account.lastInterestDate
    ? addDays(new Date(`${account.lastInterestDate}T00:00:00`), 1)
    : new Date(todayDate);

  let balance = account.balance;
  let credited = false;
  let lastCredited: string | null = account.lastInterestDate;

  while (cursor < todayDate) {
    const interest = round2((balance * rate) / 100 / 365);
    if (interest > 0) {
      const creditedDate = dateISO(cursor);
      db.insert(expenses)
        .values({
          accountId: account.id,
          categoryId: interestCategoryId,
          subcategoryId: null,
          type: "income",
          amount: interest,
          currency: account.currency,
          description: `Interest — ${dayLabel(cursor)}`,
          date: creditedDate,
          createdAt: now,
        })
        .run();
      balance = round2(balance + interest);
      credited = true;
      lastCredited = creditedDate;
    }

    cursor = addDays(cursor, 1);
  }

  return {
    balance,
    credited,
    lastInterestDate: lastCredited,
  };
}

export async function applyDueInterest() {
  const interestCategoryId = ensureInterestCategory();
  const now = new Date().toISOString();

  const savingsAccounts = db
    .select()
    .from(accounts)
    .where(eq(accounts.type, "savings"))
    .all()
    .filter(
      (account) =>
        account.interestRate != null &&
        Number.isFinite(account.interestRate) &&
        account.interestRate > 0,
    );

  for (const account of savingsAccounts) {
    const period = (account.interestPeriod ?? "month") as InterestPeriod;
    const result =
      period === "day"
        ? creditDailyInterest(
            {
              id: account.id,
              balance: account.balance,
              currency: account.currency,
              interestRate: account.interestRate!,
              lastInterestDate: account.lastInterestDate,
            },
            interestCategoryId,
            now,
          )
        : creditMonthlyInterest(
            {
              id: account.id,
              balance: account.balance,
              currency: account.currency,
              interestRate: account.interestRate!,
              lastInterestDate: account.lastInterestDate,
            },
            interestCategoryId,
            now,
          );

    if (result.credited) {
      db.update(accounts)
        .set({
          balance: result.balance,
          lastInterestDate: result.lastInterestDate,
          updatedAt: now,
        })
        .where(eq(accounts.id, account.id))
        .run();
    }
  }
}
