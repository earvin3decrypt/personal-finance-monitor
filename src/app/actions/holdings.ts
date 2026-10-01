"use server";

import { db } from "@/db";
import { holdings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isSupportedCurrency } from "@/lib/currencies";

export async function saveHolding(formData: FormData) {
  const id = formData.get("id");
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const assetType = String(formData.get("assetType") ?? "stock");
  const quantity = Number(formData.get("quantity"));
  const costBasis = Number(formData.get("costBasis"));
  const currency = String(formData.get("currency") ?? "USD");
  const accountIdRaw = formData.get("accountId");
  const accountId =
    accountIdRaw && String(accountIdRaw) !== ""
      ? Number(accountIdRaw)
      : null;

  if (!symbol || !name || !quantity || !costBasis) {
    throw new Error("Missing required fields");
  }
  if (!["stock", "etf"].includes(assetType)) throw new Error("Invalid type");
  if (!isSupportedCurrency(currency)) throw new Error("Invalid currency");

  const values = {
    symbol,
    name,
    assetType: assetType as "stock" | "etf",
    quantity,
    costBasis,
    currency,
    accountId,
  };

  if (id) {
    db.update(holdings)
      .set(values)
      .where(eq(holdings.id, Number(id)))
      .run();
  } else {
    db.insert(holdings).values(values).run();
  }

  revalidatePath("/portfolio");
  revalidatePath("/");
}

export async function deleteHolding(formData: FormData) {
  const id = Number(formData.get("id"));
  db.delete(holdings).where(eq(holdings.id, id)).run();
  revalidatePath("/portfolio");
  revalidatePath("/");
}
