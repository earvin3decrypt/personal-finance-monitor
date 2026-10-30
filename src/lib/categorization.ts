import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categorizationRules, categories } from "@/db/schema";

export type RuleOperator = "contains" | "starts_with" | "exact";

export type CategorizationMatch = {
  categoryId: number;
  subcategoryId: number | null;
  ruleId: number;
};

export type CategorizationRuleRow = {
  id: number;
  pattern: string;
  operator: RuleOperator;
  priority: number;
  enabled: boolean;
  categoryId: number;
  subcategoryId: number | null;
  categoryName: string;
  subcategoryName: string | null;
  createdAt: string;
};

const OPERATORS: RuleOperator[] = ["contains", "starts_with", "exact"];

export function isRuleOperator(value: string): value is RuleOperator {
  return OPERATORS.includes(value as RuleOperator);
}

/** Collapse whitespace and lowercase for case-insensitive matching. */
export function normalizeDescription(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function descriptionMatchesRule(
  description: string,
  pattern: string,
  operator: RuleOperator,
): boolean {
  const haystack = normalizeDescription(description);
  const needle = normalizeDescription(pattern);
  if (!haystack || !needle) return false;

  switch (operator) {
    case "contains":
      return haystack.includes(needle);
    case "starts_with":
      return haystack.startsWith(needle);
    case "exact":
      return haystack === needle;
    default:
      return false;
  }
}

export function validateCategoryTarget(
  categoryId: number,
  subcategoryId: number | null,
): { ok: true } | { ok: false; message: string } {
  const category = db
    .select()
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1)
    .all()[0];
  if (!category) return { ok: false, message: "Category not found" };
  if (category.parentId != null) {
    return { ok: false, message: "Target must be a top-level category" };
  }

  if (subcategoryId == null) return { ok: true };

  const sub = db
    .select()
    .from(categories)
    .where(eq(categories.id, subcategoryId))
    .limit(1)
    .all()[0];
  if (!sub) return { ok: false, message: "Subcategory not found" };
  if (sub.parentId !== categoryId) {
    return { ok: false, message: "Subcategory does not belong to that category" };
  }
  return { ok: true };
}

export function listCategorizationRules(): CategorizationRuleRow[] {
  const rows = db
    .select({
      id: categorizationRules.id,
      pattern: categorizationRules.pattern,
      operator: categorizationRules.operator,
      priority: categorizationRules.priority,
      enabled: categorizationRules.enabled,
      categoryId: categorizationRules.categoryId,
      subcategoryId: categorizationRules.subcategoryId,
      createdAt: categorizationRules.createdAt,
      categoryName: categories.name,
    })
    .from(categorizationRules)
    .innerJoin(categories, eq(categorizationRules.categoryId, categories.id))
    .orderBy(asc(categorizationRules.priority), asc(categorizationRules.id))
    .all();

  const allCategories = db.select().from(categories).all();
  const byId = new Map(allCategories.map((c) => [c.id, c]));

  return rows.map((r) => ({
    id: r.id,
    pattern: r.pattern,
    operator: r.operator as RuleOperator,
    priority: r.priority,
    enabled: r.enabled === 1,
    categoryId: r.categoryId,
    subcategoryId: r.subcategoryId,
    categoryName: r.categoryName,
    subcategoryName:
      r.subcategoryId != null
        ? (byId.get(r.subcategoryId)?.name ?? null)
        : null,
    createdAt: r.createdAt,
  }));
}

export function matchCategorizationRule(
  description: string,
): CategorizationMatch | null {
  const text = description.trim();
  if (!text) return null;

  const rules = db
    .select()
    .from(categorizationRules)
    .where(eq(categorizationRules.enabled, 1))
    .orderBy(asc(categorizationRules.priority), asc(categorizationRules.id))
    .all();

  for (const rule of rules) {
    if (
      !descriptionMatchesRule(
        text,
        rule.pattern,
        rule.operator as RuleOperator,
      )
    ) {
      continue;
    }
    const valid = validateCategoryTarget(rule.categoryId, rule.subcategoryId);
    if (!valid.ok) continue;
    return {
      categoryId: rule.categoryId,
      subcategoryId: rule.subcategoryId,
      ruleId: rule.id,
    };
  }
  return null;
}

export function nextRulePriority(): number {
  const rows = db
    .select({ priority: categorizationRules.priority })
    .from(categorizationRules)
    .orderBy(asc(categorizationRules.priority))
    .all();
  if (rows.length === 0) return 0;
  return Math.max(...rows.map((r) => r.priority)) + 1;
}
