import { db } from "@/db";
import { budgetRollovers, budgets, categories, expenses } from "@/db/schema";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { convertToBase, getFxRates, type FxFetchResult } from "@/lib/fx";
import { getBaseCurrency } from "@/lib/settings";

export type BudgetWithSpending = {
  id: number;
  categoryId: number;
  subcategoryId: number | null;
  name: string;
  parentName: string | null;
  color: string;
  icon: string;
  /** Effective limit in base currency (base + carried in). */
  limit: number;
  /** Stored monthly limit in base currency (no rollover). */
  baseLimit: number;
  /** Amount carried into this month in base currency. */
  carriedIn: number;
  spent: number;
  /** Unused amount this month in base currency (floored at 0). */
  leftover: number;
  /** Leftover in the budget's own currency (for storing rollovers). */
  leftoverInBudgetCurrency: number;
  percent: number;
  period: string;
  startDate: string;
  /** Stored monthly limit in the budget's own currency. */
  limitAmount: number;
  currency: string;
  budgetCurrency: string;
  /** Whether this month's leftover was already rolled out. */
  rolledToNext: boolean;
  /** Previous calendar month (`YYYY-MM`). */
  previousMonth: string;
  /** Unused leftover from the previous month in base currency. */
  previousLeftover: number;
  /** Previous leftover in the budget's own currency. */
  previousLeftoverInBudgetCurrency: number;
  /** Whether previous month's leftover was already rolled into this month. */
  previousRolledIn: boolean;
  history: { amount: number; date: string; time: string }[];
};

export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Convert an amount from `fromCurrency` into `toCurrency` via base FX rates. */
async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  baseCurrency: string,
  fx: FxFetchResult,
): Promise<number> {
  if (fromCurrency === toCurrency) return amount;
  const inBase = await convertToBase(amount, fromCurrency, baseCurrency, fx);
  if (toCurrency === baseCurrency) return inBase;
  const rate = fx.rates.get(toCurrency);
  if (rate && rate > 0) return inBase * rate;
  console.warn(
    `[FX] No rate for ${baseCurrency} → ${toCurrency}; excluding conversion`,
  );
  fx.stale = true;
  return 0;
}

type BudgetMonthRow = Omit<
  BudgetWithSpending,
  | "previousMonth"
  | "previousLeftover"
  | "previousLeftoverInBudgetCurrency"
  | "previousRolledIn"
>;

async function computeBudgetsForMonth(
  month: string,
  baseCurrency: string,
  fx: FxFetchResult,
): Promise<BudgetMonthRow[]> {
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`;

  const budgetRows = db
    .select({
      budget: budgets,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
    })
    .from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id))
    .all();

  const allCategories = db.select().from(categories).all();
  const categoryById = new Map(allCategories.map((c) => [c.id, c]));

  const carriedInRows = db
    .select()
    .from(budgetRollovers)
    .where(eq(budgetRollovers.targetMonth, month))
    .all();
  const carriedInByBudget = new Map(
    carriedInRows.map((r) => [r.budgetId, r.amount]),
  );

  const rolledOutRows = db
    .select()
    .from(budgetRollovers)
    .where(eq(budgetRollovers.sourceMonth, month))
    .all();
  const rolledOutIds = new Set(rolledOutRows.map((r) => r.budgetId));

  const result: BudgetMonthRow[] = [];

  for (const row of budgetRows) {
    const subId = row.budget.subcategoryId;
    const sub = subId != null ? categoryById.get(subId) : null;
    const budgetCurrency = row.budget.currency;

    const expenseFilter =
      subId != null
        ? and(
            eq(expenses.subcategoryId, subId),
            eq(expenses.type, "expense"),
            gte(expenses.date, monthStart),
            lte(expenses.date, monthEnd),
          )
        : and(
            eq(expenses.categoryId, row.budget.categoryId),
            eq(expenses.type, "expense"),
            gte(expenses.date, monthStart),
            lte(expenses.date, monthEnd),
          );

    const expenseRows = db
      .select({
        amount: expenses.amount,
        currency: expenses.currency,
        createdAt: expenses.createdAt,
        date: expenses.date,
      })
      .from(expenses)
      .where(expenseFilter)
      .orderBy(desc(expenses.createdAt))
      .all();

    let spent = 0;
    let spentInBudgetCurrency = 0;
    const history: { amount: number; date: string; time: string }[] = [];
    for (const e of expenseRows) {
      const base = await convertToBase(
        e.amount,
        e.currency,
        baseCurrency,
        fx,
      );
      spent += base;
      spentInBudgetCurrency += await convertCurrency(
        e.amount,
        e.currency,
        budgetCurrency,
        baseCurrency,
        fx,
      );
      const created = e.createdAt ? new Date(e.createdAt) : new Date(e.date);
      history.push({
        amount: base,
        date: created.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        time: created.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
      });
    }

    const carriedInAmount = carriedInByBudget.get(row.budget.id) ?? 0;
    const baseLimit = await convertToBase(
      row.budget.limitAmount,
      budgetCurrency,
      baseCurrency,
      fx,
    );
    const carriedIn = await convertToBase(
      carriedInAmount,
      budgetCurrency,
      baseCurrency,
      fx,
    );
    const limit = baseLimit + carriedIn;
    const leftover = Math.max(0, limit - spent);
    const effectiveInBudgetCurrency =
      row.budget.limitAmount + carriedInAmount;
    const leftoverInBudgetCurrency = Math.max(
      0,
      effectiveInBudgetCurrency - spentInBudgetCurrency,
    );

    result.push({
      id: row.budget.id,
      categoryId: row.budget.categoryId,
      subcategoryId: subId ?? null,
      name: sub?.name ?? row.categoryName,
      parentName: sub ? row.categoryName : null,
      color: row.categoryColor,
      icon: sub?.icon ?? row.categoryIcon,
      limit,
      baseLimit,
      carriedIn,
      spent,
      leftover,
      leftoverInBudgetCurrency,
      percent: limit > 0 ? Math.min(100, (spent / limit) * 100) : 0,
      period: row.budget.period,
      startDate: row.budget.startDate,
      limitAmount: row.budget.limitAmount,
      currency: baseCurrency,
      budgetCurrency,
      rolledToNext: rolledOutIds.has(row.budget.id),
      history,
    });
  }

  return result;
}

export async function getBudgetsWithSpending(
  month: string,
): Promise<BudgetWithSpending[]> {
  const baseCurrency = await getBaseCurrency();
  const fx = await getFxRates(baseCurrency);
  const prev = previousMonth(month);

  const [current, previous] = await Promise.all([
    computeBudgetsForMonth(month, baseCurrency, fx),
    computeBudgetsForMonth(prev, baseCurrency, fx),
  ]);

  const previousById = new Map(previous.map((b) => [b.id, b]));

  return current.map((b) => {
    const prevBudget = previousById.get(b.id);
    return {
      ...b,
      previousMonth: prev,
      previousLeftover: prevBudget?.leftover ?? 0,
      previousLeftoverInBudgetCurrency:
        prevBudget?.leftoverInBudgetCurrency ?? 0,
      previousRolledIn: prevBudget?.rolledToNext ?? false,
    };
  });
}
