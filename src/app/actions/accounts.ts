"use server";

import { db } from "@/db";
import { accounts, accountTransfers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isSupportedCurrency } from "@/lib/currencies";
import { todayISO } from "@/lib/format";

type InterestPeriod = "month" | "day";

function parseInterestRate(
  type: string,
  formData: FormData,
): number | null {
  if (type !== "savings") return null;

  const raw = formData.get("interestRate");
  if (!raw || String(raw) === "") return null;

  const rate = Number(raw);
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error("Invalid interest rate");
  }
  return rate;
}

function parseInterestPeriod(
  type: string,
  formData: FormData,
): InterestPeriod {
  if (type !== "savings") return "month";

  const raw = String(formData.get("interestPeriod") ?? "month");
  if (raw !== "month" && raw !== "day") {
    throw new Error("Invalid interest period");
  }
  return raw;
}

function resolveLastInterestDate(
  type: string,
  interestRate: number | null,
  interestPeriod: InterestPeriod,
  existing: {
    interestRate: number | null;
    interestPeriod: string | null;
    lastInterestDate: string | null;
  } | null,
): string | null {
  if (type !== "savings" || interestRate == null || interestRate <= 0) {
    return null;
  }

  const hadRate =
    existing?.interestRate != null && existing.interestRate > 0;
  const samePeriod =
    hadRate && (existing?.interestPeriod ?? "month") === interestPeriod;

  if (samePeriod && existing?.lastInterestDate) {
    return existing.lastInterestDate;
  }

  if (interestPeriod === "day") {
    return todayISO();
  }

  return `${todayISO().slice(0, 7)}-01`;
}

export async function saveAccount(formData: FormData) {
  const id = formData.get("id");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "checking");
  const currency = String(formData.get("currency") ?? "EUR");
  const balance = Number(formData.get("balance") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;
  const interestRate = parseInterestRate(type, formData);
  const interestPeriod = parseInterestPeriod(type, formData);

  if (!name) throw new Error("Name required");
  if (!["checking", "savings", "cash"].includes(type)) {
    throw new Error("Invalid account type");
  }
  if (!isSupportedCurrency(currency)) throw new Error("Invalid currency");

  const updatedAt = new Date().toISOString();
  const existing = id
    ? db
        .select()
        .from(accounts)
        .where(eq(accounts.id, Number(id)))
        .limit(1)
        .all()[0]
    : null;

  const lastInterestDate = resolveLastInterestDate(
    type,
    interestRate,
    interestPeriod,
    existing,
  );

  if (id) {
    db.update(accounts)
      .set({
        name,
        type: type as "checking" | "savings" | "cash",
        currency,
        balance,
        note,
        interestRate,
        interestPeriod: type === "savings" ? interestPeriod : "month",
        lastInterestDate,
        updatedAt,
      })
      .where(eq(accounts.id, Number(id)))
      .run();
  } else {
    db.insert(accounts)
      .values({
        name,
        type: type as "checking" | "savings" | "cash",
        currency,
        balance,
        note,
        interestRate,
        interestPeriod: type === "savings" ? interestPeriod : "month",
        lastInterestDate,
        updatedAt,
      })
      .run();
  }

  revalidatePath("/accounts");
  revalidatePath("/");
  revalidatePath("/expenses");
}

export async function deleteAccount(formData: FormData) {
  const id = Number(formData.get("id"));
  db.delete(accounts).where(eq(accounts.id, id)).run();
  revalidatePath("/accounts");
  revalidatePath("/");
}

export async function transferFunds(formData: FormData) {
  const fromAccountId = Number(formData.get("fromAccountId"));
  const toAccountId = Number(formData.get("toAccountId"));
  const sentAmount = Math.abs(Number(formData.get("sentAmount")));
  const receivedAmount = Math.abs(Number(formData.get("receivedAmount")));
  const date = String(formData.get("date") ?? "").trim() || todayISO();
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!fromAccountId || !toAccountId) {
    throw new Error("Source and destination accounts are required");
  }
  if (fromAccountId === toAccountId) {
    throw new Error("Cannot transfer to the same account");
  }
  if (!(sentAmount > 0) || !(receivedAmount > 0)) {
    throw new Error("Transfer amounts must be positive");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid transfer date");
  }

  const fromAccount = db
    .select()
    .from(accounts)
    .where(eq(accounts.id, fromAccountId))
    .limit(1)
    .all()[0];
  const toAccount = db
    .select()
    .from(accounts)
    .where(eq(accounts.id, toAccountId))
    .limit(1)
    .all()[0];

  if (!fromAccount || !toAccount) {
    throw new Error("Account not found");
  }
  if (!isSupportedCurrency(fromAccount.currency)) {
    throw new Error("Invalid source currency");
  }
  if (!isSupportedCurrency(toAccount.currency)) {
    throw new Error("Invalid destination currency");
  }

  const updatedAt = new Date().toISOString();
  const createdAt = updatedAt;

  db.transaction((tx) => {
    tx.insert(accountTransfers)
      .values({
        fromAccountId,
        toAccountId,
        sentAmount,
        sentCurrency: fromAccount.currency,
        receivedAmount,
        receivedCurrency: toAccount.currency,
        date,
        note,
        createdAt,
      })
      .run();

    tx.update(accounts)
      .set({
        balance: fromAccount.balance - sentAmount,
        updatedAt,
      })
      .where(eq(accounts.id, fromAccountId))
      .run();

    tx.update(accounts)
      .set({
        balance: toAccount.balance + receivedAmount,
        updatedAt,
      })
      .where(eq(accounts.id, toAccountId))
      .run();
  });

  revalidatePath("/accounts");
  revalidatePath("/");
}

export async function updateTransfer(formData: FormData) {
  const id = Number(formData.get("id"));
  const fromAccountId = Number(formData.get("fromAccountId"));
  const toAccountId = Number(formData.get("toAccountId"));
  const sentAmount = Math.abs(Number(formData.get("sentAmount")));
  const receivedAmount = Math.abs(Number(formData.get("receivedAmount")));
  const date = String(formData.get("date") ?? "").trim() || todayISO();
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!id) throw new Error("Transfer not found");
  if (!fromAccountId || !toAccountId) {
    throw new Error("Source and destination accounts are required");
  }
  if (fromAccountId === toAccountId) {
    throw new Error("Cannot transfer to the same account");
  }
  if (!(sentAmount > 0) || !(receivedAmount > 0)) {
    throw new Error("Transfer amounts must be positive");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid transfer date");
  }

  const existing = db
    .select()
    .from(accountTransfers)
    .where(eq(accountTransfers.id, id))
    .limit(1)
    .all()[0];
  if (!existing) throw new Error("Transfer not found");

  const updatedAt = new Date().toISOString();

  db.transaction((tx) => {
    const oldFrom = tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, existing.fromAccountId))
      .limit(1)
      .all()[0];
    const oldTo = tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, existing.toAccountId))
      .limit(1)
      .all()[0];
    if (!oldFrom || !oldTo) throw new Error("Account not found");

    tx.update(accounts)
      .set({
        balance: oldFrom.balance + existing.sentAmount,
        updatedAt,
      })
      .where(eq(accounts.id, existing.fromAccountId))
      .run();

    tx.update(accounts)
      .set({
        balance: oldTo.balance - existing.receivedAmount,
        updatedAt,
      })
      .where(eq(accounts.id, existing.toAccountId))
      .run();

    const newFrom = tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, fromAccountId))
      .limit(1)
      .all()[0];
    const newTo = tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, toAccountId))
      .limit(1)
      .all()[0];
    if (!newFrom || !newTo) throw new Error("Account not found");
    if (!isSupportedCurrency(newFrom.currency)) {
      throw new Error("Invalid source currency");
    }
    if (!isSupportedCurrency(newTo.currency)) {
      throw new Error("Invalid destination currency");
    }
    if (newFrom.balance < sentAmount) {
      throw new Error("Insufficient balance in source account");
    }

    tx.update(accountTransfers)
      .set({
        fromAccountId,
        toAccountId,
        sentAmount,
        sentCurrency: newFrom.currency,
        receivedAmount,
        receivedCurrency: newTo.currency,
        date,
        note,
      })
      .where(eq(accountTransfers.id, id))
      .run();

    tx.update(accounts)
      .set({
        balance: newFrom.balance - sentAmount,
        updatedAt,
      })
      .where(eq(accounts.id, fromAccountId))
      .run();

    tx.update(accounts)
      .set({
        balance: newTo.balance + receivedAmount,
        updatedAt,
      })
      .where(eq(accounts.id, toAccountId))
      .run();
  });

  revalidatePath("/accounts");
  revalidatePath("/");
}

export async function deleteTransfer(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) throw new Error("Transfer not found");

  const existing = db
    .select()
    .from(accountTransfers)
    .where(eq(accountTransfers.id, id))
    .limit(1)
    .all()[0];
  if (!existing) throw new Error("Transfer not found");

  const updatedAt = new Date().toISOString();

  db.transaction((tx) => {
    const fromAccount = tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, existing.fromAccountId))
      .limit(1)
      .all()[0];
    const toAccount = tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, existing.toAccountId))
      .limit(1)
      .all()[0];
    if (!fromAccount || !toAccount) throw new Error("Account not found");

    tx.update(accounts)
      .set({
        balance: fromAccount.balance + existing.sentAmount,
        updatedAt,
      })
      .where(eq(accounts.id, existing.fromAccountId))
      .run();

    tx.update(accounts)
      .set({
        balance: toAccount.balance - existing.receivedAmount,
        updatedAt,
      })
      .where(eq(accounts.id, existing.toAccountId))
      .run();

    tx.delete(accountTransfers).where(eq(accountTransfers.id, id)).run();
  });

  revalidatePath("/accounts");
  revalidatePath("/");
}
