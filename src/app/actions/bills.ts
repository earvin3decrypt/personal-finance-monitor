"use server";

import { db } from "@/db";
import { accounts, expenses, recurringItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nextDueAfterPayment, type BillingCycle } from "@/lib/bills";
import { isSupportedCurrency } from "@/lib/currencies";
import { todayISO } from "@/lib/format";

function revalidateBillPaths() {
  revalidatePath("/bills");
  revalidatePath("/forecast");
  revalidatePath("/expenses");
  revalidatePath("/accounts");
  revalidatePath("/");
}

function parseOptionalId(value: FormDataEntryValue | null): number | null {
  if (value == null || String(value) === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseBillingCycle(raw: string): BillingCycle {
  return raw === "year" ? "year" : "month";
}

function parseOptionalDate(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? "").trim();
  return raw || null;
}

export async function saveBill(formData: FormData) {
  const id = parseOptionalId(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const amount = Math.abs(Number(formData.get("amount")));
  const currency = String(formData.get("currency") ?? "EUR");
  const typeRaw = String(formData.get("type") ?? "expense");
  const billingCycle = parseBillingCycle(
    String(formData.get("billingCycle") ?? "month"),
  );
  const nextDueDate = parseOptionalDate(formData.get("nextDueDate"));
  const endDate = parseOptionalDate(formData.get("endDate"));
  const reminderDays = Math.max(
    0,
    Math.min(30, Number(formData.get("reminderDays") ?? 3) || 3),
  );
  const accountId = parseOptionalId(formData.get("accountId"));
  const categoryId = parseOptionalId(formData.get("categoryId"));
  const subcategoryId = parseOptionalId(formData.get("subcategoryId"));

  if (!name || !amount) throw new Error("Missing fields");
  if (!isSupportedCurrency(currency)) throw new Error("Invalid currency");
  if (typeRaw !== "expense" && typeRaw !== "income") {
    throw new Error("Invalid type");
  }
  if (endDate && nextDueDate && endDate < nextDueDate) {
    throw new Error("End date must be on or after the next due date");
  }

  const type = typeRaw as "expense" | "income";
  const values = {
    name,
    amount,
    currency,
    type,
    isBill: 1,
    billingCycle,
    nextDueDate,
    endDate,
    reminderDays,
    accountId,
    categoryId,
    subcategoryId,
  };

  if (id) {
    db.update(recurringItems).set(values).where(eq(recurringItems.id, id)).run();
  } else {
    db.insert(recurringItems)
      .values({
        ...values,
        createdAt: new Date().toISOString(),
      })
      .run();
  }

  revalidateBillPaths();
}

export async function markBillPaid(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) throw new Error("Missing bill");

  const bill = db
    .select()
    .from(recurringItems)
    .where(eq(recurringItems.id, id))
    .limit(1)
    .all()[0];

  if (!bill || !bill.isBill) throw new Error("Bill not found");
  if (!bill.accountId || !bill.categoryId) {
    throw new Error("Bill needs an account and category before marking paid");
  }

  const paidDate = String(formData.get("date") ?? "").trim() || todayISO();
  const createdAt = new Date().toISOString();

  db.insert(expenses)
    .values({
      accountId: bill.accountId,
      categoryId: bill.categoryId,
      subcategoryId: bill.subcategoryId,
      type: bill.type as "expense" | "income",
      amount: bill.amount,
      currency: bill.currency,
      description: bill.name,
      date: paidDate,
      createdAt,
    })
    .run();

  const account = db
    .select()
    .from(accounts)
    .where(eq(accounts.id, bill.accountId))
    .limit(1)
    .all()[0];

  if (account) {
    const delta = bill.type === "income" ? bill.amount : -bill.amount;
    db.update(accounts)
      .set({
        balance: account.balance + delta,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(accounts.id, bill.accountId))
      .run();
  }

  const cycle = (bill.billingCycle ?? "month") as BillingCycle;
  const fromDate = bill.nextDueDate || paidDate;
  const nextDueDate = nextDueAfterPayment(fromDate, cycle, bill.endDate);

  db.update(recurringItems)
    .set({ nextDueDate })
    .where(eq(recurringItems.id, id))
    .run();

  revalidateBillPaths();
}

export async function skipBill(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) throw new Error("Missing bill");

  const bill = db
    .select()
    .from(recurringItems)
    .where(eq(recurringItems.id, id))
    .limit(1)
    .all()[0];

  if (!bill || !bill.isBill) throw new Error("Bill not found");

  const cycle = (bill.billingCycle ?? "month") as BillingCycle;
  const fromDate = bill.nextDueDate || todayISO();
  const nextDueDate = nextDueAfterPayment(fromDate, cycle, bill.endDate);

  db.update(recurringItems)
    .set({ nextDueDate })
    .where(eq(recurringItems.id, id))
    .run();

  revalidateBillPaths();
}

export async function trackAsBill(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) throw new Error("Missing item");

  const billingCycle = parseBillingCycle(
    String(formData.get("billingCycle") ?? "month"),
  );
  const nextDueDate = parseOptionalDate(formData.get("nextDueDate"));
  const endDate = parseOptionalDate(formData.get("endDate"));
  const reminderDays = Math.max(
    0,
    Math.min(30, Number(formData.get("reminderDays") ?? 3) || 3),
  );
  const accountId = parseOptionalId(formData.get("accountId"));
  const categoryId = parseOptionalId(formData.get("categoryId"));
  const subcategoryId = parseOptionalId(formData.get("subcategoryId"));

  if (!nextDueDate) throw new Error("Next due date is required");
  if (!accountId || !categoryId) {
    throw new Error("Account and category are required to track as a bill");
  }
  if (endDate && endDate < nextDueDate) {
    throw new Error("End date must be on or after the next due date");
  }

  const item = db
    .select()
    .from(recurringItems)
    .where(eq(recurringItems.id, id))
    .limit(1)
    .all()[0];

  if (!item) throw new Error("Recurring item not found");

  db.update(recurringItems)
    .set({
      isBill: 1,
      billingCycle,
      nextDueDate,
      endDate,
      reminderDays,
      accountId,
      categoryId,
      subcategoryId,
    })
    .where(eq(recurringItems.id, id))
    .run();

  revalidateBillPaths();
}

export async function deleteBill(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) throw new Error("Missing bill");
  db.delete(recurringItems).where(eq(recurringItems.id, id)).run();
  revalidateBillPaths();
}
