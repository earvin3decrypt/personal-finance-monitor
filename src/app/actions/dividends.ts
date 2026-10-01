"use server";

import { db } from "@/db";
import { dividends } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isSupportedCurrency } from "@/lib/currencies";

export async function saveDividend(formData: FormData) {
  const id = formData.get("id");
  const amount = Number(formData.get("amount"));
  const currency = String(formData.get("currency") ?? "EUR");
  const date = String(formData.get("date") ?? "").trim();
  const descriptionRaw = formData.get("description");
  const description =
    descriptionRaw && String(descriptionRaw).trim() !== ""
      ? String(descriptionRaw).trim()
      : null;

  if (!amount || !date) {
    throw new Error("Amount and date are required");
  }
  if (!isSupportedCurrency(currency)) throw new Error("Invalid currency");

  const values = {
    holdingId: null as number | null,
    amount,
    currency,
    date,
    description,
    createdAt: new Date().toISOString(),
  };

  if (id) {
    db.update(dividends)
      .set({
        holdingId: null,
        amount: values.amount,
        currency: values.currency,
        date: values.date,
        description: values.description,
      })
      .where(eq(dividends.id, Number(id)))
      .run();
  } else {
    db.insert(dividends).values(values).run();
  }

  revalidatePath("/portfolio");
  revalidatePath("/");
}

export async function deleteDividend(formData: FormData) {
  const id = Number(formData.get("id"));
  db.delete(dividends).where(eq(dividends.id, id)).run();
  revalidatePath("/portfolio");
  revalidatePath("/");
}
