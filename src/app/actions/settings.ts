"use server";

import { db } from "@/db";
import { categories, settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordPortfolioSnapshot } from "@/lib/snapshot";
import { refreshAllPrices } from "@/lib/prices";
import { getFxRates } from "@/lib/fx";
import { getBaseCurrency } from "@/lib/settings";
import { isSupportedCurrency } from "@/lib/currencies";
import { isThemePreference, type ThemePreference } from "@/lib/theme";
import { importFromProjectDatabase } from "@/lib/db-import";
import { restoreDatabaseFromPath } from "@/lib/db-preserve";
import { resolveDatabasePath } from "@/lib/db-path";
import { resetDatabaseConnection } from "@/db";

export async function updateBaseCurrency(formData: FormData) {
  const currency = String(formData.get("baseCurrency") ?? "");
  if (!isSupportedCurrency(currency)) {
    throw new Error("Invalid currency");
  }
  const row = db.select().from(settings).limit(1).all()[0];
  if (row) {
    db.update(settings).set({ baseCurrency: currency }).where(eq(settings.id, row.id)).run();
  } else {
    db.insert(settings).values({ baseCurrency: currency }).run();
  }
  revalidatePath("/", "layout");
}

export async function updateTheme(theme: ThemePreference) {
  if (!isThemePreference(theme)) {
    throw new Error("Invalid theme");
  }
  const row = db.select().from(settings).limit(1).all()[0];
  if (row) {
    db.update(settings).set({ theme }).where(eq(settings.id, row.id)).run();
  } else {
    db.insert(settings).values({ baseCurrency: "EUR", theme }).run();
  }
  revalidatePath("/", "layout");
}

export async function updateBlurAmounts(blurAmounts: boolean) {
  const value = blurAmounts ? 1 : 0;
  const row = db.select().from(settings).limit(1).all()[0];
  if (row) {
    db.update(settings)
      .set({ blurAmounts: value })
      .where(eq(settings.id, row.id))
      .run();
  } else {
    db.insert(settings)
      .values({ baseCurrency: "EUR", blurAmounts: value })
      .run();
  }
  revalidatePath("/", "layout");
}

export async function addCategory(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#3b82f6");
  const icon = String(formData.get("icon") ?? "tag");
  const parentIdRaw = formData.get("parentId");
  const parentId =
    parentIdRaw && String(parentIdRaw) !== ""
      ? Number(parentIdRaw)
      : null;
  if (!name) throw new Error("Name required");

  let resolvedColor = color;
  if (parentId != null) {
    const parent = db
      .select()
      .from(categories)
      .where(eq(categories.id, parentId))
      .limit(1)
      .all()[0];
    if (!parent) throw new Error("Parent category not found");
    resolvedColor = parent.color;
  }

  db.insert(categories).values({ name, color: resolvedColor, icon, parentId }).run();
  revalidatePath("/expenses");
  revalidatePath("/goals");
  revalidatePath("/settings");
}

export async function updateCategory(formData: FormData) {
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const iconRaw = formData.get("icon");
  const colorRaw = formData.get("color");
  if (!id || Number.isNaN(id)) throw new Error("Invalid category");
  if (!name) throw new Error("Name required");

  const category = db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1)
    .all()[0];
  if (!category) throw new Error("Category not found");

  const updates: { name: string; icon?: string; color?: string } = { name };
  if (iconRaw != null && String(iconRaw).trim() !== "") {
    updates.icon = String(iconRaw).trim();
  }
  if (colorRaw != null && String(colorRaw).trim() !== "") {
    updates.color = String(colorRaw).trim();
  }

  db.update(categories).set(updates).where(eq(categories.id, id)).run();

  // Keep subcategory colors in sync when a parent color changes
  if (updates.color && category.parentId == null) {
    const children = db
      .select()
      .from(categories)
      .where(eq(categories.parentId, id))
      .all();
    for (const child of children) {
      db.update(categories)
        .set({ color: updates.color })
        .where(eq(categories.id, child.id))
        .run();
    }
  }

  revalidatePath("/expenses");
  revalidatePath("/goals");
  revalidatePath("/settings");
  revalidatePath("/");
}

/** @deprecated Use updateCategory */
export async function renameCategory(formData: FormData) {
  return updateCategory(formData);
}

export async function deleteCategory(formData: FormData) {
  const id = Number(formData.get("id"));
  db.delete(categories).where(eq(categories.id, id)).run();
  revalidatePath("/expenses");
  revalidatePath("/goals");
  revalidatePath("/settings");
}

export async function updateCategoryParent(formData: FormData) {
  const id = Number(formData.get("id"));
  const parentIdRaw = formData.get("parentId");
  const parentId =
    parentIdRaw && String(parentIdRaw) !== "" && String(parentIdRaw) !== "null"
      ? Number(parentIdRaw)
      : null;

  if (!id || Number.isNaN(id)) throw new Error("Invalid category");

  const all = db.select().from(categories).all();
  const category = all.find((c) => c.id === id);
  if (!category) throw new Error("Category not found");

  if (parentId === id) throw new Error("A category cannot be its own parent");

  if (parentId != null) {
    const parent = all.find((c) => c.id === parentId);
    if (!parent) throw new Error("Parent category not found");
    if (parent.parentId != null) {
      throw new Error("Categories can only be nested one level deep");
    }

    const childIds = all.filter((c) => c.parentId === id).map((c) => c.id);
    if (childIds.includes(parentId)) {
      throw new Error("Cannot nest a category under its own subcategory");
    }
  }

  const children = all.filter((c) => c.parentId === id);
  if (parentId != null && children.length > 0) {
    for (const child of children) {
      db.update(categories)
        .set({ parentId: null })
        .where(eq(categories.id, child.id))
        .run();
    }
  }

  db.update(categories).set({ parentId }).where(eq(categories.id, id)).run();

  if (parentId != null) {
    const parent = all.find((c) => c.id === parentId)!;
    db.update(categories)
      .set({ color: parent.color })
      .where(eq(categories.id, id))
      .run();
  }

  revalidatePath("/expenses");
  revalidatePath("/goals");
  revalidatePath("/settings");
}

export async function forceSnapshot() {
  await recordPortfolioSnapshot();
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/crypto");
}

export async function refreshMarketData() {
  const base = await getBaseCurrency();
  await getFxRates(base, { forceRefresh: true });
  await refreshAllPrices();
  revalidatePath("/", "layout");
}

export async function importProjectDatabase() {
  const result = importFromProjectDatabase();
  if (!result.ok) {
    throw new Error(result.message);
  }
  revalidatePath("/", "layout");
  revalidatePath("/accounts");
  revalidatePath("/settings");
}

export async function restoreDatabaseFromLegacy(formData: FormData) {
  const sourcePath = String(formData.get("sourcePath") ?? "").trim();
  if (!sourcePath) throw new Error("No source path selected");

  const result = restoreDatabaseFromPath(resolveDatabasePath(), sourcePath);
  if (!result.restored) {
    throw new Error(result.message);
  }

  resetDatabaseConnection();
  revalidatePath("/", "layout");
  revalidatePath("/accounts");
  revalidatePath("/portfolio");
  revalidatePath("/settings");
}

