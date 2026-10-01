"use server";

import { db } from "@/db";
import { cryptoHoldings, expenses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ensureCryptoCategory } from "@/lib/categories";
import { cryptoDisplayName } from "@/lib/crypto-symbols";
import { formatTradeQty, weightedAverageCost } from "@/lib/crypto-trades";
import { isSupportedCurrency } from "@/lib/currencies";
import { todayISO } from "@/lib/format";
import { recordPortfolioSnapshot } from "@/lib/snapshot";

function revalidateCryptoPaths() {
  revalidatePath("/crypto");
  revalidatePath("/");
  revalidatePath("/portfolio");
  revalidatePath("/settings");
  revalidatePath("/expenses");
  revalidatePath("/accounts");
}

/** Log trade as expense/income without changing account balance. */
function logTradeExpense(params: {
  accountId: number;
  categoryId: number;
  type: "expense" | "income";
  amount: number;
  currency: string;
  description: string;
  date: string;
}) {
  db.insert(expenses)
    .values({
      accountId: params.accountId,
      categoryId: params.categoryId,
      subcategoryId: null,
      type: params.type,
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      date: params.date,
      createdAt: new Date().toISOString(),
    })
    .run();
}

export async function saveCryptoHolding(formData: FormData) {
  const id = formData.get("id");
  const symbol = String(formData.get("symbol") ?? "")
    .trim()
    .toUpperCase();
  let name = String(formData.get("name") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 0);
  const costBasisRaw = formData.get("costBasis");
  const costBasis =
    costBasisRaw != null && String(costBasisRaw).trim() !== ""
      ? Number(costBasisRaw)
      : null;
  const currency = String(formData.get("currency") ?? "USD");

  if (!symbol) throw new Error("Symbol required");
  if (!name) name = cryptoDisplayName(symbol);
  if (quantity <= 0) throw new Error("Quantity must be positive");
  if (!isSupportedCurrency(currency)) throw new Error("Invalid currency");

  const updatedAt = new Date().toISOString();

  if (id) {
    db.update(cryptoHoldings)
      .set({
        symbol,
        name,
        quantity,
        costBasis,
        currency,
        updatedAt,
      })
      .where(eq(cryptoHoldings.id, Number(id)))
      .run();
  } else {
    db.insert(cryptoHoldings)
      .values({
        symbol,
        name,
        quantity,
        costBasis,
        currency,
        updatedAt,
      })
      .run();
  }

  await recordPortfolioSnapshot();
  revalidateCryptoPaths();
}

export async function deleteCryptoHolding(formData: FormData) {
  const id = Number(formData.get("id"));
  db.delete(cryptoHoldings).where(eq(cryptoHoldings.id, id)).run();
  await recordPortfolioSnapshot();
  revalidateCryptoPaths();
}

export async function buyCrypto(formData: FormData) {
  const symbol = String(formData.get("symbol") ?? "")
    .trim()
    .toUpperCase();
  let name = String(formData.get("name") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 0);
  const price = Number(formData.get("price") ?? 0);
  const currency = String(formData.get("currency") ?? "USD");
  const date = String(formData.get("date") ?? "").trim() || todayISO();
  const accountId = Number(formData.get("accountId"));

  if (!symbol) throw new Error("Symbol required");
  if (!name) name = cryptoDisplayName(symbol);
  if (!(quantity > 0)) throw new Error("Quantity must be positive");
  if (!(price > 0)) throw new Error("Price must be positive");
  if (!isSupportedCurrency(currency)) throw new Error("Invalid currency");
  if (!accountId) throw new Error("Account required");

  const amount = quantity * price;
  const updatedAt = new Date().toISOString();
  const categoryId = ensureCryptoCategory();

  const existing = db
    .select()
    .from(cryptoHoldings)
    .where(eq(cryptoHoldings.symbol, symbol))
    .limit(1)
    .all()[0];

  if (existing) {
    const newQty = existing.quantity + quantity;
    const newCost = weightedAverageCost(
      existing.quantity,
      existing.costBasis,
      quantity,
      price,
    );
    db.update(cryptoHoldings)
      .set({
        name: name || existing.name,
        quantity: newQty,
        costBasis: newCost,
        currency,
        updatedAt,
      })
      .where(eq(cryptoHoldings.id, existing.id))
      .run();
  } else {
    db.insert(cryptoHoldings)
      .values({
        symbol,
        name,
        quantity,
        costBasis: price,
        currency,
        updatedAt,
      })
      .run();
  }

  logTradeExpense({
    accountId,
    categoryId,
    type: "expense",
    amount,
    currency,
    description: `Buy ${formatTradeQty(quantity)} ${symbol}`,
    date,
  });

  await recordPortfolioSnapshot();
  revalidateCryptoPaths();
}

export async function sellCrypto(formData: FormData) {
  const id = Number(formData.get("id"));
  const quantity = Number(formData.get("quantity") ?? 0);
  const price = Number(formData.get("price") ?? 0);
  const currency = String(formData.get("currency") ?? "USD");
  const date = String(formData.get("date") ?? "").trim() || todayISO();
  const accountId = Number(formData.get("accountId"));

  if (!id) throw new Error("Holding required");
  if (!(quantity > 0)) throw new Error("Quantity must be positive");
  if (!(price > 0)) throw new Error("Price must be positive");
  if (!isSupportedCurrency(currency)) throw new Error("Invalid currency");
  if (!accountId) throw new Error("Account required");

  const holding = db
    .select()
    .from(cryptoHoldings)
    .where(eq(cryptoHoldings.id, id))
    .limit(1)
    .all()[0];

  if (!holding) throw new Error("Holding not found");
  if (quantity > holding.quantity + 1e-12) {
    throw new Error("Cannot sell more than you own");
  }

  const amount = quantity * price;
  const remaining = holding.quantity - quantity;
  const categoryId = ensureCryptoCategory();
  const updatedAt = new Date().toISOString();

  if (remaining <= 1e-12) {
    db.delete(cryptoHoldings).where(eq(cryptoHoldings.id, id)).run();
  } else {
    db.update(cryptoHoldings)
      .set({
        quantity: remaining,
        // Keep existing avg cost basis on partial sell
        currency: currency || holding.currency,
        updatedAt,
      })
      .where(eq(cryptoHoldings.id, id))
      .run();
  }

  logTradeExpense({
    accountId,
    categoryId,
    type: "income",
    amount,
    currency,
    description: `Sell ${formatTradeQty(quantity)} ${holding.symbol}`,
    date,
  });

  await recordPortfolioSnapshot();
  revalidateCryptoPaths();
}
