"use server";

import { db } from "@/db";
import { budgetRollovers, budgets, categories } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  getBudgetsWithSpending,
  previousMonth,
} from "@/lib/budgets";
import { isSupportedCurrency } from "@/lib/currencies";
import { todayISO } from "@/lib/format";

function revalidateBudgetPaths() {
  revalidatePath("/goals");
  revalidatePath("/");
}

export async function saveBudget(formData: FormData) {
  const id = formData.get("id");
  const categoryId = Number(formData.get("categoryId"));
  const subcategoryIdRaw = formData.get("subcategoryId");
  const subcategoryId =
    subcategoryIdRaw && String(subcategoryIdRaw) !== ""
      ? Number(subcategoryIdRaw)
      : null;
  const limitAmount = Number(formData.get("limitAmount"));
  const currency = String(formData.get("currency") ?? "EUR");
  const startDate = String(
    formData.get("startDate") ?? todayISO().slice(0, 7) + "-01",
  );

  if (!categoryId || !limitAmount) throw new Error("Missing fields");
  if (!isSupportedCurrency(currency)) throw new Error("Invalid currency");

  if (subcategoryId != null) {
    const sub = db
      .select()
      .from(categories)
      .where(eq(categories.id, subcategoryId))
      .limit(1)
      .all()[0];
    if (!sub) throw new Error("Subcategory not found");
    if (sub.parentId !== categoryId) {
      throw new Error("Subcategory does not belong to the selected category");
    }
  }

  const values = {
    categoryId,
    subcategoryId,
    limitAmount,
    currency,
    period: "month" as const,
    startDate,
  };

  if (id) {
    db.update(budgets).set(values).where(eq(budgets.id, Number(id))).run();
  } else {
    db.insert(budgets).values(values).run();
  }

  revalidateBudgetPaths();
}

export async function deleteBudget(formData: FormData) {
  db.delete(budgets).where(eq(budgets.id, Number(formData.get("id")))).run();
  revalidateBudgetPaths();
}

/**
 * Roll unused leftover from the previous month into `targetMonth`
 * (the month currently being viewed).
 */
async function insertRolloverFromPreviousIfNeeded(
  budgetId: number,
  targetMonth: string,
  previousLeftoverInBudgetCurrency: number,
  previousAlreadyRolled: boolean,
): Promise<boolean> {
  if (previousAlreadyRolled || previousLeftoverInBudgetCurrency <= 0) {
    return false;
  }

  const sourceMonth = previousMonth(targetMonth);

  const existing = db
    .select()
    .from(budgetRollovers)
    .where(
      and(
        eq(budgetRollovers.budgetId, budgetId),
        eq(budgetRollovers.sourceMonth, sourceMonth),
      ),
    )
    .limit(1)
    .all()[0];

  if (existing) return false;

  db.insert(budgetRollovers)
    .values({
      budgetId,
      sourceMonth,
      targetMonth,
      amount: previousLeftoverInBudgetCurrency,
      createdAt: new Date().toISOString(),
    })
    .run();

  return true;
}

export async function rolloverBudget(formData: FormData) {
  const id = Number(formData.get("id"));
  const targetMonth =
    String(formData.get("targetMonth") ?? "").trim() ||
    todayISO().slice(0, 7);

  if (!id) throw new Error("Missing budget");

  const rows = await getBudgetsWithSpending(targetMonth);
  const budget = rows.find((b) => b.id === id);
  if (!budget) throw new Error("Budget not found");

  await insertRolloverFromPreviousIfNeeded(
    id,
    targetMonth,
    budget.previousLeftoverInBudgetCurrency,
    budget.previousRolledIn,
  );

  revalidateBudgetPaths();
}

export async function rolloverAllBudgets(formData: FormData) {
  const targetMonth =
    String(formData.get("targetMonth") ?? "").trim() ||
    todayISO().slice(0, 7);

  const rows = await getBudgetsWithSpending(targetMonth);
  for (const budget of rows) {
    await insertRolloverFromPreviousIfNeeded(
      budget.id,
      targetMonth,
      budget.previousLeftoverInBudgetCurrency,
      budget.previousRolledIn,
    );
  }

  revalidateBudgetPaths();
}
