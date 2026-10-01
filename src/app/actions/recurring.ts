"use server";

import { db } from "@/db";
import { recurringItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isSupportedCurrency } from "@/lib/currencies";

export async function saveRecurringItem(formData: FormData) {
  const id = formData.get("id");
  const name = String(formData.get("name") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const currency = String(formData.get("currency") ?? "EUR");
  const typeRaw = String(formData.get("type") ?? "expense");

  if (!name || !amount) throw new Error("Missing fields");
  if (!isSupportedCurrency(currency)) throw new Error("Invalid currency");
  if (typeRaw !== "expense" && typeRaw !== "income") {
    throw new Error("Invalid type");
  }

  const type = typeRaw as "expense" | "income";

  if (id) {
    db.update(recurringItems)
      .set({ name, amount, currency, type })
      .where(eq(recurringItems.id, Number(id)))
      .run();
  } else {
    db.insert(recurringItems)
      .values({
        name,
        amount,
        currency,
        type,
        createdAt: new Date().toISOString(),
      })
      .run();
  }

  revalidatePath("/forecast");
  revalidatePath("/bills");
  revalidatePath("/");
}

export async function deleteRecurringItem(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) throw new Error("Missing item");
  db.delete(recurringItems).where(eq(recurringItems.id, id)).run();
  revalidatePath("/forecast");
  revalidatePath("/bills");
  revalidatePath("/");
}
