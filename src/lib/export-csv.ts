import { alias } from "drizzle-orm/sqlite-core";
import { asc, desc, eq } from "drizzle-orm";
import JSZip from "jszip";
import { db } from "@/db";
import {
  accounts,
  categories,
  expenses,
  holdings,
  recurringItems,
} from "@/db/schema";
import { todayISO } from "@/lib/format";

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ];
  return lines.join("\n") + "\n";
}

function buildOperationsCsv(): string {
  const cat = alias(categories, "cat");
  const sub = alias(categories, "sub");
  const rows = db
    .select({
      date: expenses.date,
      type: expenses.type,
      amount: expenses.amount,
      currency: expenses.currency,
      description: expenses.description,
      account: accounts.name,
      category: cat.name,
      subcategory: sub.name,
    })
    .from(expenses)
    .innerJoin(accounts, eq(expenses.accountId, accounts.id))
    .innerJoin(cat, eq(expenses.categoryId, cat.id))
    .leftJoin(sub, eq(expenses.subcategoryId, sub.id))
    .orderBy(desc(expenses.date), desc(expenses.id))
    .all();

  return toCsv(
    [
      "date",
      "type",
      "amount",
      "currency",
      "description",
      "account",
      "category",
      "subcategory",
    ],
    rows.map((r) => [
      r.date,
      r.type,
      r.amount,
      r.currency,
      r.description,
      r.account,
      r.category,
      r.subcategory,
    ]),
  );
}

function buildAccountsCsv(): string {
  const rows = db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
      currency: accounts.currency,
      balance: accounts.balance,
      note: accounts.note,
      interestRate: accounts.interestRate,
      interestPeriod: accounts.interestPeriod,
      lastInterestDate: accounts.lastInterestDate,
      updatedAt: accounts.updatedAt,
    })
    .from(accounts)
    .orderBy(asc(accounts.name))
    .all();

  return toCsv(
    [
      "id",
      "name",
      "type",
      "currency",
      "balance",
      "note",
      "interest_rate",
      "interest_period",
      "last_interest_date",
      "updated_at",
    ],
    rows.map((r) => [
      r.id,
      r.name,
      r.type,
      r.currency,
      r.balance,
      r.note,
      r.interestRate,
      r.interestPeriod,
      r.lastInterestDate,
      r.updatedAt,
    ]),
  );
}

function buildHoldingsCsv(): string {
  const rows = db
    .select({
      id: holdings.id,
      symbol: holdings.symbol,
      name: holdings.name,
      assetType: holdings.assetType,
      quantity: holdings.quantity,
      costBasis: holdings.costBasis,
      currency: holdings.currency,
      account: accounts.name,
    })
    .from(holdings)
    .leftJoin(accounts, eq(holdings.accountId, accounts.id))
    .orderBy(asc(holdings.symbol))
    .all();

  return toCsv(
    [
      "id",
      "symbol",
      "name",
      "asset_type",
      "quantity",
      "cost_basis",
      "currency",
      "account",
    ],
    rows.map((r) => [
      r.id,
      r.symbol,
      r.name,
      r.assetType,
      r.quantity,
      r.costBasis,
      r.currency,
      r.account,
    ]),
  );
}

function buildBillsCsv(): string {
  const cat = alias(categories, "bill_cat");
  const sub = alias(categories, "bill_sub");
  const rows = db
    .select({
      id: recurringItems.id,
      name: recurringItems.name,
      amount: recurringItems.amount,
      currency: recurringItems.currency,
      type: recurringItems.type,
      billingCycle: recurringItems.billingCycle,
      nextDueDate: recurringItems.nextDueDate,
      endDate: recurringItems.endDate,
      reminderDays: recurringItems.reminderDays,
      account: accounts.name,
      category: cat.name,
      subcategory: sub.name,
    })
    .from(recurringItems)
    .leftJoin(accounts, eq(recurringItems.accountId, accounts.id))
    .leftJoin(cat, eq(recurringItems.categoryId, cat.id))
    .leftJoin(sub, eq(recurringItems.subcategoryId, sub.id))
    .where(eq(recurringItems.isBill, 1))
    .orderBy(asc(recurringItems.name))
    .all();

  return toCsv(
    [
      "id",
      "name",
      "amount",
      "currency",
      "type",
      "billing_cycle",
      "next_due_date",
      "end_date",
      "reminder_days",
      "account",
      "category",
      "subcategory",
    ],
    rows.map((r) => [
      r.id,
      r.name,
      r.amount,
      r.currency,
      r.type,
      r.billingCycle,
      r.nextDueDate,
      r.endDate,
      r.reminderDays,
      r.account,
      r.category,
      r.subcategory,
    ]),
  );
}

export async function buildFinanceExportZip(): Promise<{
  filename: string;
  buffer: Buffer;
}> {
  const date = todayISO();
  const zip = new JSZip();
  zip.file("operations.csv", buildOperationsCsv());
  zip.file("accounts.csv", buildAccountsCsv());
  zip.file("holdings.csv", buildHoldingsCsv());
  zip.file("bills.csv", buildBillsCsv());

  const buffer = Buffer.from(
    await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }),
  );

  return {
    filename: `finance-export-${date}.zip`,
    buffer,
  };
}
