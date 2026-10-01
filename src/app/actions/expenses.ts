"use server";

import { db } from "@/db";
import { accounts, expenses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isSupportedCurrency } from "@/lib/currencies";
import { searchExpenses } from "@/lib/expense-stats";

export async function searchExpensesAction(query: string) {
  return searchExpenses(query);
}

export async function saveExpense(formData: FormData) {
  const id = formData.get("id");
  const accountId = Number(formData.get("accountId"));
  const categoryId = Number(formData.get("categoryId"));
  const subcategoryIdRaw = formData.get("subcategoryId");
  const subcategoryId =
    subcategoryIdRaw && String(subcategoryIdRaw) !== ""
      ? Number(subcategoryIdRaw)
      : null;
  const type = String(formData.get("type") ?? "expense");
  const amount = Math.abs(Number(formData.get("amount")));
  const currency = String(formData.get("currency") ?? "EUR");
  const description = String(formData.get("description") ?? "").trim() || null;
  const date = String(formData.get("date") ?? "");
  const createdAt = new Date().toISOString();

  if (!accountId || !categoryId || !amount || !date) {
    throw new Error("Missing required fields");
  }
  if (!["expense", "income"].includes(type)) throw new Error("Invalid type");
  if (!isSupportedCurrency(currency)) throw new Error("Invalid currency");

  const expenseType = type as "expense" | "income";
  const values = {
    accountId,
    categoryId,
    subcategoryId,
    type: expenseType,
    amount,
    currency,
    description,
    date,
    createdAt,
  };

  if (id) {
    const expenseId = Number(id);
    const existing = db
      .select()
      .from(expenses)
      .where(eq(expenses.id, expenseId))
      .limit(1)
      .all()[0];
    if (!existing) throw new Error("Expense not found");

    const updatedAt = new Date().toISOString();

    db.transaction((tx) => {
      const oldAccount = tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, existing.accountId))
        .limit(1)
        .all()[0];
      if (!oldAccount) throw new Error("Account not found");

      const reverseDelta =
        existing.type === "income" ? -existing.amount : existing.amount;
      tx.update(accounts)
        .set({
          balance: oldAccount.balance + reverseDelta,
          updatedAt,
        })
        .where(eq(accounts.id, existing.accountId))
        .run();

      const newAccount = tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .limit(1)
        .all()[0];
      if (!newAccount) throw new Error("Account not found");

      const applyDelta = expenseType === "income" ? amount : -amount;
      tx.update(accounts)
        .set({
          balance: newAccount.balance + applyDelta,
          updatedAt,
        })
        .where(eq(accounts.id, accountId))
        .run();

      tx.update(expenses)
        .set(values)
        .where(eq(expenses.id, expenseId))
        .run();
    });
  } else {
    db.insert(expenses).values(values).run();

    const account = db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1)
      .all()[0];
    if (account) {
      const delta = expenseType === "income" ? amount : -amount;
      db.update(accounts)
        .set({
          balance: account.balance + delta,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(accounts.id, accountId))
        .run();
    }
  }

  revalidatePath("/expenses");
  revalidatePath("/goals");
  revalidatePath("/accounts");
  revalidatePath("/");
}

export async function deleteExpense(formData: FormData) {
  const id = Number(formData.get("id"));
  const expense = db
    .select()
    .from(expenses)
    .where(eq(expenses.id, id))
    .limit(1)
    .all()[0];

  if (expense) {
    const account = db
      .select()
      .from(accounts)
      .where(eq(accounts.id, expense.accountId))
      .limit(1)
      .all()[0];
    if (account) {
      const delta =
        expense.type === "income" ? -expense.amount : expense.amount;
      db.update(accounts)
        .set({
          balance: account.balance + delta,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(accounts.id, expense.accountId))
        .run();
    }
  }

  db.delete(expenses).where(eq(expenses.id, id)).run();
  revalidatePath("/expenses");
  revalidatePath("/goals");
  revalidatePath("/accounts");
  revalidatePath("/");
}
