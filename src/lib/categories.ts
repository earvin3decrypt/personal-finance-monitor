import { db } from "@/db";
import { categories } from "@/db/schema";
import { isNull, eq, and } from "drizzle-orm";

export type CategoryWithChildren = {
  id: number;
  name: string;
  color: string;
  icon: string;
  children: { id: number; name: string; color: string; icon: string }[];
};

export function getCategoryTree(): CategoryWithChildren[] {
  const all = db.select().from(categories).all();
  const parents = all.filter((c) => c.parentId == null);
  return parents.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    icon: p.icon,
    children: all
      .filter((c) => c.parentId === p.id)
      .map((c) => ({
        id: c.id,
        name: c.name,
        color: p.color,
        icon: c.icon,
      })),
  }));
}

export function getParentCategories() {
  return db.select().from(categories).where(isNull(categories.parentId)).all();
}

export function getSubcategories(parentId: number) {
  const parent = db
    .select()
    .from(categories)
    .where(eq(categories.id, parentId))
    .limit(1)
    .all()[0];
  const parentColor = parent?.color ?? "#3b82f6";

  return db
    .select()
    .from(categories)
    .where(eq(categories.parentId, parentId))
    .all()
    .map((c) => ({ ...c, color: parentColor }));
}

export function ensureInterestCategory(): number {
  const existing = db
    .select()
    .from(categories)
    .where(and(isNull(categories.parentId), eq(categories.name, "Interest")))
    .limit(1)
    .all()[0];

  if (existing) return existing.id;

  const result = db
    .insert(categories)
    .values({
      name: "Interest",
      color: "#22c55e",
      icon: "percent",
      parentId: null,
    })
    .run();

  return Number(result.lastInsertRowid);
}

export function ensureCryptoCategory(): number {
  const existing = db
    .select()
    .from(categories)
    .where(and(isNull(categories.parentId), eq(categories.name, "Crypto")))
    .limit(1)
    .all()[0];

  if (existing) return existing.id;

  const result = db
    .insert(categories)
    .values({
      name: "Crypto",
      color: "#f59e0b",
      icon: "coins",
      parentId: null,
    })
    .run();

  return Number(result.lastInsertRowid);
}
