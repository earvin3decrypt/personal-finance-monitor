"use server";

import { db } from "@/db";
import {
  budgets,
  categories,
  categorizationRules,
  expenses,
  recurringItems,
  settings,
} from "@/db/schema";
import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordPortfolioSnapshot } from "@/lib/snapshot";
import { refreshAllPrices } from "@/lib/prices";
import { getFxRates } from "@/lib/fx";
import {
  getBaseCurrency,
  isAiProvider,
  type AiProvider,
} from "@/lib/settings";
import { isSupportedCurrency } from "@/lib/currencies";
import { isThemePreference, type ThemePreference } from "@/lib/theme";
import { AVAILABLE_ICONS, isHexColor, safeHexColor } from "@/components/category-icon";
import { runDailyBackupIfNeeded } from "@/lib/backups";
import {
  isRuleOperator,
  nextRulePriority,
  validateCategoryTarget,
} from "@/lib/categorization";
import { testAiCategorizationConnection } from "@/lib/ai-categorization";
import { hostnameFromHostHeader, isLoopbackAddress } from "@/lib/loopback";
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

export async function updateBillNotifications(enabled: boolean) {
  const value = enabled ? 1 : 0;
  const row = db.select().from(settings).limit(1).all()[0];
  if (row) {
    db.update(settings)
      .set({ billNotifications: value })
      .where(eq(settings.id, row.id))
      .run();
  } else {
    db.insert(settings)
      .values({ baseCurrency: "EUR", billNotifications: value })
      .run();
  }
  revalidatePath("/settings");
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
  if (!isHexColor(color)) throw new Error("Invalid color");
  if (!AVAILABLE_ICONS.includes(icon)) throw new Error("Invalid icon");

  let resolvedColor = color;
  if (parentId != null) {
    const parent = db
      .select()
      .from(categories)
      .where(eq(categories.id, parentId))
      .limit(1)
      .all()[0];
    if (!parent) throw new Error("Parent category not found");
    resolvedColor = safeHexColor(parent.color);
  }

  const result = db
    .insert(categories)
    .values({ name, color: resolvedColor, icon, parentId })
    .run();
  revalidatePath("/expenses");
  revalidatePath("/goals");
  revalidatePath("/settings");
  return { id: Number(result.lastInsertRowid) };
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
    const icon = String(iconRaw).trim();
    if (!AVAILABLE_ICONS.includes(icon)) throw new Error("Invalid icon");
    updates.icon = icon;
  }
  if (colorRaw != null && String(colorRaw).trim() !== "") {
    const color = String(colorRaw).trim();
    if (!isHexColor(color)) throw new Error("Invalid color");
    updates.color = color;
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
  if (!id || Number.isNaN(id)) return { error: "Invalid category" };

  const category = db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1)
    .all()[0];
  if (!category) return { error: "Category not found" };

  // Subcategories can always be removed: keep operations on the parent category.
  if (category.parentId != null) {
    const parentId = category.parentId;
    try {
      db.transaction((tx) => {
        // Operations that used this subcategory stay under the parent category.
        tx.update(expenses)
          .set({ categoryId: parentId, subcategoryId: null })
          .where(eq(expenses.subcategoryId, id))
          .run();
        // Legacy rows that used the subcategory as categoryId → move to parent.
        tx.update(expenses)
          .set({ categoryId: parentId, subcategoryId: null })
          .where(eq(expenses.categoryId, id))
          .run();

        tx.update(recurringItems)
          .set({ categoryId: parentId, subcategoryId: null })
          .where(eq(recurringItems.subcategoryId, id))
          .run();
        tx.update(recurringItems)
          .set({ categoryId: parentId, subcategoryId: null })
          .where(eq(recurringItems.categoryId, id))
          .run();

        tx.update(categorizationRules)
          .set({ categoryId: parentId, subcategoryId: null })
          .where(eq(categorizationRules.subcategoryId, id))
          .run();
        tx.update(categorizationRules)
          .set({ categoryId: parentId, subcategoryId: null })
          .where(eq(categorizationRules.categoryId, id))
          .run();

        // Prefer moving subcategory budgets onto the parent; drop only if a
        // parent-level budget already exists for that category.
        const parentBudget = tx
          .select()
          .from(budgets)
          .where(and(eq(budgets.categoryId, parentId), isNull(budgets.subcategoryId)))
          .limit(1)
          .all()[0];
        if (parentBudget) {
          tx.delete(budgets).where(eq(budgets.subcategoryId, id)).run();
        } else {
          tx.update(budgets)
            .set({ categoryId: parentId, subcategoryId: null })
            .where(eq(budgets.subcategoryId, id))
            .run();
        }
        tx.update(budgets)
          .set({ categoryId: parentId, subcategoryId: null })
          .where(eq(budgets.categoryId, id))
          .run();

        tx.delete(categories).where(eq(categories.id, id)).run();
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not delete subcategory";
      console.error("[deleteCategory]", err);
      return { error: message };
    }
    revalidatePath("/expenses");
    revalidatePath("/goals");
    revalidatePath("/bills");
    revalidatePath("/settings");
    revalidatePath("/");
    return { ok: true as const };
  }

  const children = db
    .select()
    .from(categories)
    .where(eq(categories.parentId, id))
    .all();
  const ids = [id, ...children.map((c) => c.id)];

  const usage = db
    .select({ count: sql<number>`count(*)` })
    .from(expenses)
    .where(
      or(inArray(expenses.categoryId, ids), inArray(expenses.subcategoryId, ids)),
    )
    .all()[0];
  const count = Number(usage?.count ?? 0);
  if (count > 0) {
    return {
      error: `Used by ${count} operation${count === 1 ? "" : "s"} — reassign them first`,
    };
  }

  db.transaction((tx) => {
    for (const child of children) {
      tx.update(expenses)
        .set({ subcategoryId: null })
        .where(eq(expenses.subcategoryId, child.id))
        .run();
      tx.update(recurringItems)
        .set({ subcategoryId: null })
        .where(eq(recurringItems.subcategoryId, child.id))
        .run();
      tx.update(categorizationRules)
        .set({ subcategoryId: null })
        .where(eq(categorizationRules.subcategoryId, child.id))
        .run();
      tx.delete(budgets).where(eq(budgets.subcategoryId, child.id)).run();
      tx.delete(categories).where(eq(categories.id, child.id)).run();
    }
    tx.delete(categories).where(eq(categories.id, id)).run();
  });
  revalidatePath("/expenses");
  revalidatePath("/goals");
  revalidatePath("/bills");
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true as const };
}

export async function setCategoryFixed(id: number, isFixed: boolean) {
  if (!id || Number.isNaN(id)) throw new Error("Invalid category");

  const category = db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1)
    .all()[0];
  if (!category) throw new Error("Category not found");
  if (category.parentId != null) {
    throw new Error("Only top-level categories can be marked fixed");
  }

  db.update(categories)
    .set({ isFixed: isFixed ? 1 : 0 })
    .where(eq(categories.id, id))
    .run();

  revalidatePath("/settings");
  revalidatePath("/expenses");
  revalidatePath("/");
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
      .set({ color: safeHexColor(parent.color) })
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

export async function forceDatabaseBackup() {
  const result = runDailyBackupIfNeeded({ force: true });
  if (!result.created && !result.path) {
    throw new Error(result.message);
  }
  revalidatePath("/settings");
}

function parseOptionalSubcategoryId(raw: FormDataEntryValue | null): number | null {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function createCategorizationRule(formData: FormData) {
  const pattern = String(formData.get("pattern") ?? "").trim();
  const operatorRaw = String(formData.get("operator") ?? "contains");
  const categoryId = Number(formData.get("categoryId"));
  const subcategoryId = parseOptionalSubcategoryId(formData.get("subcategoryId"));

  if (!pattern) throw new Error("Pattern is required");
  if (!isRuleOperator(operatorRaw)) throw new Error("Invalid operator");
  if (!categoryId || Number.isNaN(categoryId)) {
    throw new Error("Category is required");
  }
  const valid = validateCategoryTarget(categoryId, subcategoryId);
  if (!valid.ok) throw new Error(valid.message);

  db.insert(categorizationRules)
    .values({
      pattern,
      operator: operatorRaw,
      priority: nextRulePriority(),
      enabled: 1,
      categoryId,
      subcategoryId,
      createdAt: new Date().toISOString(),
    })
    .run();

  revalidatePath("/settings");
  revalidatePath("/expenses");
}

export async function updateCategorizationRule(formData: FormData) {
  const id = Number(formData.get("id"));
  const pattern = String(formData.get("pattern") ?? "").trim();
  const operatorRaw = String(formData.get("operator") ?? "contains");
  const categoryId = Number(formData.get("categoryId"));
  const subcategoryId = parseOptionalSubcategoryId(formData.get("subcategoryId"));

  if (!id || Number.isNaN(id)) throw new Error("Invalid rule");
  if (!pattern) throw new Error("Pattern is required");
  if (!isRuleOperator(operatorRaw)) throw new Error("Invalid operator");
  if (!categoryId || Number.isNaN(categoryId)) {
    throw new Error("Category is required");
  }
  const valid = validateCategoryTarget(categoryId, subcategoryId);
  if (!valid.ok) throw new Error(valid.message);

  const existing = db
    .select()
    .from(categorizationRules)
    .where(eq(categorizationRules.id, id))
    .limit(1)
    .all()[0];
  if (!existing) throw new Error("Rule not found");

  db.update(categorizationRules)
    .set({
      pattern,
      operator: operatorRaw,
      categoryId,
      subcategoryId,
    })
    .where(eq(categorizationRules.id, id))
    .run();

  revalidatePath("/settings");
  revalidatePath("/expenses");
}

export async function setCategorizationRuleEnabled(id: number, enabled: boolean) {
  if (!id || Number.isNaN(id)) throw new Error("Invalid rule");
  db.update(categorizationRules)
    .set({ enabled: enabled ? 1 : 0 })
    .where(eq(categorizationRules.id, id))
    .run();
  revalidatePath("/settings");
  revalidatePath("/expenses");
}

export async function deleteCategorizationRule(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id || Number.isNaN(id)) throw new Error("Invalid rule");
  db.delete(categorizationRules).where(eq(categorizationRules.id, id)).run();
  revalidatePath("/settings");
  revalidatePath("/expenses");
}

export async function moveCategorizationRule(formData: FormData) {
  const id = Number(formData.get("id"));
  const direction = String(formData.get("direction") ?? "");
  if (!id || Number.isNaN(id)) throw new Error("Invalid rule");
  if (direction !== "up" && direction !== "down") {
    throw new Error("Invalid direction");
  }

  const rules = db
    .select()
    .from(categorizationRules)
    .orderBy(asc(categorizationRules.priority), asc(categorizationRules.id))
    .all();
  const index = rules.findIndex((r) => r.id === id);
  if (index < 0) throw new Error("Rule not found");

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= rules.length) return;

  const reordered = [...rules];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(swapWith, 0, moved);

  db.transaction((tx) => {
    for (let i = 0; i < reordered.length; i++) {
      tx.update(categorizationRules)
        .set({ priority: i })
        .where(eq(categorizationRules.id, reordered[i].id))
        .run();
    }
  });

  revalidatePath("/settings");
  revalidatePath("/expenses");
}

function ensureSettingsRow() {
  const row = db.select().from(settings).limit(1).all()[0];
  if (row) return row;
  db.insert(settings).values({ baseCurrency: "EUR" }).run();
  return db.select().from(settings).limit(1).all()[0]!;
}

function assertOllamaBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Ollama URL is invalid");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Ollama URL must use http or https");
  }
  const host = hostnameFromHostHeader(url.host) || url.hostname;
  if (!isLoopbackAddress(host)) {
    throw new Error("Ollama URL must be a loopback address");
  }
  return url.toString().replace(/\/$/, "");
}

export async function updateAiCategorizationSettings(formData: FormData) {
  const enabled = String(formData.get("enabled") ?? "") === "1";
  const providerRaw = String(formData.get("provider") ?? "ollama");
  const model = String(formData.get("model") ?? "").trim();
  const ollamaBaseUrlRaw = String(formData.get("ollamaBaseUrl") ?? "").trim();
  const apiKeyRaw = String(formData.get("apiKey") ?? "");
  const clearApiKey = String(formData.get("clearApiKey") ?? "") === "1";

  if (!isAiProvider(providerRaw)) throw new Error("Invalid AI provider");
  if (!model) throw new Error("Model is required");

  const provider = providerRaw as AiProvider;
  const ollamaBaseUrl = assertOllamaBaseUrl(
    ollamaBaseUrlRaw || "http://127.0.0.1:11434",
  );

  const row = ensureSettingsRow();
  const updates: {
    aiCategorizationEnabled: number;
    aiProvider: AiProvider;
    aiModel: string;
    aiOllamaBaseUrl: string;
    aiApiKey?: string | null;
  } = {
    aiCategorizationEnabled: enabled ? 1 : 0,
    aiProvider: provider,
    aiModel: model,
    aiOllamaBaseUrl: ollamaBaseUrl,
  };

  if (clearApiKey) {
    updates.aiApiKey = null;
  } else if (apiKeyRaw.trim()) {
    updates.aiApiKey = apiKeyRaw.trim();
  }

  db.update(settings).set(updates).where(eq(settings.id, row.id)).run();
  revalidatePath("/settings");
  revalidatePath("/expenses");
}

export async function clearAiApiKey() {
  const row = ensureSettingsRow();
  db.update(settings)
    .set({ aiApiKey: null })
    .where(eq(settings.id, row.id))
    .run();
  revalidatePath("/settings");
}

export async function testAiCategorizationSettings(): Promise<{
  ok: boolean;
  message: string;
}> {
  return testAiCategorizationConnection();
}

