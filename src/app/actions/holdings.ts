"use server";

import { db } from "@/db";
import { holdings, holdingTrades } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isSupportedCurrency } from "@/lib/currencies";
import { todayISO } from "@/lib/format";
import { syncHoldingFromTrades } from "@/lib/holding-trades";
import { recordPortfolioSnapshot } from "@/lib/snapshot";

export async function saveHolding(formData: FormData) {
  const id = formData.get("id");
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const assetType = String(formData.get("assetType") ?? "stock");
  const quantity = Number(formData.get("quantity"));
  const costBasis = Number(formData.get("costBasis"));
  const currency = String(formData.get("currency") ?? "USD");
  const date = String(formData.get("date") ?? "").trim() || todayISO();
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
    const result = db.insert(holdings).values(values).run();
    const holdingId = Number(result.lastInsertRowid);

    db.insert(holdingTrades)
      .values({
        holdingId,
        side: "buy",
        quantity,
        unitPrice: costBasis,
        totalAmount: quantity * costBasis,
        currency,
        date,
        accountId,
        createdAt: new Date().toISOString(),
      })
      .run();

    syncHoldingFromTrades(holdingId);
    await recordPortfolioSnapshot();
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
