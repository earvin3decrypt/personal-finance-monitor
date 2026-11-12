"use server";

import { db } from "@/db";
import { holdings, holdingTrades } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isSupportedCurrency } from "@/lib/currencies";
import { todayISO } from "@/lib/format";
import { syncHoldingFromTrades } from "@/lib/holding-trades";
import { recordPortfolioSnapshot } from "@/lib/snapshot";

function revalidateHoldingPaths() {
  revalidatePath("/portfolio");
  revalidatePath("/");
}

/** Set or update the first purchase date for an existing holding. */
export async function setHoldingPurchaseDate(formData: FormData) {
  const holdingId = Number(formData.get("holdingId"));
  const date = String(formData.get("date") ?? "").trim();

  if (!holdingId) throw new Error("Holding required");
  if (!date) throw new Error("Date required");

  const holding = db
    .select()
    .from(holdings)
    .where(eq(holdings.id, holdingId))
    .limit(1)
    .all()[0];

  if (!holding) throw new Error("Holding not found");

  const earliestBuy = db
    .select()
    .from(holdingTrades)
    .where(eq(holdingTrades.holdingId, holdingId))
    .orderBy(asc(holdingTrades.date), asc(holdingTrades.id))
    .all()
    .find((t) => t.side === "buy");

  if (earliestBuy) {
    db.update(holdingTrades)
      .set({ date })
      .where(eq(holdingTrades.id, earliestBuy.id))
      .run();
  } else {
    if (!(holding.quantity > 0) || !(holding.costBasis > 0)) {
      throw new Error("Holding needs quantity and cost basis");
    }
    db.insert(holdingTrades)
      .values({
        holdingId,
        side: "buy",
        quantity: holding.quantity,
        unitPrice: holding.costBasis,
        totalAmount: holding.quantity * holding.costBasis,
        currency: holding.currency,
        date,
        accountId: holding.accountId,
        createdAt: new Date().toISOString(),
      })
      .run();
    syncHoldingFromTrades(holdingId);
  }

  await recordPortfolioSnapshot();
  revalidateHoldingPaths();
}

export async function updateHoldingTradeDate(formData: FormData) {
  const id = Number(formData.get("id"));
  const date = String(formData.get("date") ?? "").trim();

  if (!id) throw new Error("Trade required");
  if (!date) throw new Error("Date required");

  const row = db
    .select({ holdingId: holdingTrades.holdingId })
    .from(holdingTrades)
    .where(eq(holdingTrades.id, id))
    .get();

  if (!row) throw new Error("Trade not found");

  db.update(holdingTrades)
    .set({ date })
    .where(eq(holdingTrades.id, id))
    .run();

  revalidateHoldingPaths();
}

export async function addHoldingTrade(formData: FormData) {
  const holdingId = Number(formData.get("holdingId"));
  const side = String(formData.get("side") ?? "buy");
  const quantity = Number(formData.get("quantity"));
  const unitPrice = Number(formData.get("unitPrice"));
  const totalAmountRaw = formData.get("totalAmount");
  const totalAmount =
    totalAmountRaw != null && String(totalAmountRaw).trim() !== ""
      ? Number(totalAmountRaw)
      : quantity * unitPrice;
  const currency = String(formData.get("currency") ?? "EUR");
  const date = String(formData.get("date") ?? "").trim() || todayISO();
  const accountIdRaw = formData.get("accountId");
  const accountId =
    accountIdRaw && String(accountIdRaw) !== ""
      ? Number(accountIdRaw)
      : null;

  if (!holdingId) throw new Error("Holding required");
  if (!["buy", "sell"].includes(side)) throw new Error("Invalid side");
  if (!(quantity > 0)) throw new Error("Quantity must be positive");
  if (!(unitPrice > 0)) throw new Error("Unit price must be positive");
  if (!(totalAmount > 0)) throw new Error("Total amount must be positive");
  if (!isSupportedCurrency(currency)) throw new Error("Invalid currency");

  db.insert(holdingTrades)
    .values({
      holdingId,
      side: side as "buy" | "sell",
      quantity,
      unitPrice,
      totalAmount,
      currency,
      date,
      accountId,
      createdAt: new Date().toISOString(),
    })
    .run();

  syncHoldingFromTrades(holdingId);
  await recordPortfolioSnapshot();
  revalidateHoldingPaths();
}

export async function deleteHoldingTrade(formData: FormData) {
  const id = Number(formData.get("id"));
  const row = db
    .select({ holdingId: holdingTrades.holdingId })
    .from(holdingTrades)
    .where(eq(holdingTrades.id, id))
    .get();

  if (!row) throw new Error("Trade not found");

  db.delete(holdingTrades).where(eq(holdingTrades.id, id)).run();
  syncHoldingFromTrades(row.holdingId);
  await recordPortfolioSnapshot();
  revalidateHoldingPaths();
}
