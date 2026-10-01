"use server";

import { db } from "@/db";
import { savingsContributions, savingsGoals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isSupportedCurrency } from "@/lib/currencies";
import { todayISO } from "@/lib/format";

function parseDeadline(formData: FormData): string | null {
  const raw = String(formData.get("deadline") ?? "").trim();
  return raw || null;
}

export async function saveSavingsGoal(formData: FormData) {
  const id = formData.get("id");
  const name = String(formData.get("name") ?? "").trim();
  const icon = String(formData.get("icon") ?? "target");
  const targetAmount = Number(formData.get("targetAmount"));
  const currency = String(formData.get("currency") ?? "EUR");
  const deadline = parseDeadline(formData);

  if (!name || !targetAmount) throw new Error("Missing fields");
  if (!isSupportedCurrency(currency)) throw new Error("Invalid currency");

  if (id) {
    db.update(savingsGoals)
      .set({ name, icon, targetAmount, currency, deadline })
      .where(eq(savingsGoals.id, Number(id)))
      .run();
  } else {
    db.insert(savingsGoals)
      .values({
        name,
        icon,
        targetAmount,
        currentAmount: 0,
        currency,
        deadline,
        createdAt: new Date().toISOString(),
      })
      .run();
  }

  revalidatePath("/savings");
  revalidatePath("/");
}

export async function updateSavingsGoalDeadline(formData: FormData) {
  const id = Number(formData.get("id"));
  const deadline =
    formData.get("clear") === "1" ? null : parseDeadline(formData);

  if (!id) throw new Error("Missing goal");

  db.update(savingsGoals)
    .set({ deadline })
    .where(eq(savingsGoals.id, id))
    .run();

  revalidatePath("/savings");
  revalidatePath("/");
}

export async function addSavingsContribution(formData: FormData) {
  const goalId = Number(formData.get("goalId"));
  const amount = Number(formData.get("amount"));
  const currency = String(formData.get("currency") ?? "EUR");
  const date = String(formData.get("date") ?? todayISO());
  const createdAt = new Date().toISOString();

  if (!goalId || !amount) throw new Error("Missing fields");

  const goal = db
    .select()
    .from(savingsGoals)
    .where(eq(savingsGoals.id, goalId))
    .limit(1)
    .all()[0];
  if (!goal) throw new Error("Goal not found");

  db.insert(savingsContributions)
    .values({ goalId, amount, currency, date, createdAt })
    .run();

  db.update(savingsGoals)
    .set({ currentAmount: goal.currentAmount + amount })
    .where(eq(savingsGoals.id, goalId))
    .run();

  revalidatePath("/savings");
  revalidatePath("/");
}

export async function deleteSavingsGoal(formData: FormData) {
  db.delete(savingsGoals)
    .where(eq(savingsGoals.id, Number(formData.get("id"))))
    .run();
  revalidatePath("/savings");
  revalidatePath("/");
}
