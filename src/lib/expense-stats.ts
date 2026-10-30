import { db } from "@/db";
import { accounts, categories, expenses } from "@/db/schema";
import { and, desc, eq, gte, like, lte, or } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { convertToBase, getFxRates } from "@/lib/fx";
import { formatMonthLong, localTodayISO } from "@/lib/format";
import { getBaseCurrency } from "@/lib/settings";
import { getBudgetsWithSpending } from "@/lib/budgets";

export type DailySpend = {
  day: number;
  date: string;
  /** All expenses booked that day (fixed + variable). */
  expense: number;
  fixed: number;
  variable: number;
  income: number;
  isToday: boolean;
  /** Day is after today; any amounts on it are scheduled, not spent. */
  isFuture: boolean;
};
export type CategoryBreakdown = {
  categoryId: number;
  name: string;
  color: string;
  icon: string;
  isFixed: boolean;
  total: number;
  percent: number;
  /** Effective monthly budget in base currency, if one exists. */
  budgetLimit: number | null;
  /** Spent / budget * 100 (can exceed 100). Null when no budget. */
  budgetPercent: number | null;
  subcategories: {
    id: number;
    name: string;
    total: number;
    budgetLimit: number | null;
    budgetPercent: number | null;
  }[];
};
export type ExpenseOperation = {
  id: number;
  amount: number;
  currency: string;
  date: string;
  type: string;
  description: string | null;
  categoryId: number;
  subcategoryId: number | null;
  subcategoryName: string | null;
  accountId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  accountName: string;
};

export type FixedCategorySummary = {
  categoryId: number;
  name: string;
  total: number;
  days: number[];
};

export type SpendingTrend = {
  /** Change vs the comparison period in percent; null when there is nothing to compare. */
  percent: number | null;
  current: number;
  previous: number;
  previousMonth: string;
  /** "to-date": same day range of the previous month; "full-month": both months complete. */
  basis: "to-date" | "full-month";
  /** Last day of the comparison range (to-date basis only). */
  throughDay: number;
};

export type MonthlyHistoryPoint = {
  month: string;
  label: string;
  expense: number;
  income: number;
  /** Current calendar month, still in progress. */
  isPartial: boolean;
  operationCount: number;
};

export type MonthlyHistory = {
  baseCurrency: string;
  points: MonthlyHistoryPoint[];
  totalExpense: number;
  totalIncome: number;
  /** Average expenses over complete months that have at least one operation. */
  avgExpense: number;
  avgMonths: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function daysInMonthOf(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthKeysBack(count: number, anchorMonth: string): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) keys.push(shiftMonth(anchorMonth, -i));
  return keys;
}

function formatMonthLabel(month: string, spansYears: boolean): string {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const d = new Date(year, monthIndex, 1);
  const short = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(d);
  if (spansYears || monthIndex === 0) {
    return `${short} '${String(year).slice(2)}`;
  }
  return short;
}

export async function getMonthlyExpenseHistory(
  months = 12,
): Promise<MonthlyHistory> {
  const baseCurrency = await getBaseCurrency();
  const fx = await getFxRates(baseCurrency);
  const today = localTodayISO();
  const currentMonth = today.slice(0, 7);
  const monthKeys = monthKeysBack(months, currentMonth);
  const startDate = `${monthKeys[0]}-01`;

  const rows = db
    .select({
      amount: expenses.amount,
      currency: expenses.currency,
      date: expenses.date,
      type: expenses.type,
    })
    .from(expenses)
    .where(and(gte(expenses.date, startDate), lte(expenses.date, today)))
    .all();

  const bucket = new Map<
    string,
    { expense: number; income: number; count: number }
  >();
  for (const key of monthKeys) {
    bucket.set(key, { expense: 0, income: 0, count: 0 });
  }

  for (const e of rows) {
    const entry = bucket.get(e.date.slice(0, 7));
    if (!entry) continue;
    const base = await convertToBase(e.amount, e.currency, baseCurrency, fx);
    entry.count += 1;
    if (e.type === "expense") {
      entry.expense += base;
    } else {
      entry.income += base;
    }
  }

  const spansYears = new Set(monthKeys.map((k) => k.slice(0, 4))).size > 1;
  const points: MonthlyHistoryPoint[] = monthKeys.map((month) => {
    const { expense, income, count } = bucket.get(month)!;
    return {
      month,
      label: formatMonthLabel(month, spansYears),
      expense: round2(expense),
      income: round2(income),
      isPartial: month === currentMonth,
      operationCount: count,
    };
  });

  const totalExpense = round2(points.reduce((s, p) => s + p.expense, 0));
  const totalIncome = round2(points.reduce((s, p) => s + p.income, 0));

  const completeMonths = points.filter(
    (p) => !p.isPartial && p.operationCount > 0,
  );
  const avgExpense =
    completeMonths.length > 0
      ? completeMonths.reduce((s, p) => s + p.expense, 0) /
        completeMonths.length
      : 0;

  return {
    baseCurrency,
    points,
    totalExpense,
    totalIncome,
    avgExpense,
    avgMonths: completeMonths.length,
  };
}

const subcategories = alias(categories, "subcategories");

const operationColumns = {
  id: expenses.id,
  amount: expenses.amount,
  currency: expenses.currency,
  date: expenses.date,
  type: expenses.type,
  description: expenses.description,
  categoryId: expenses.categoryId,
  subcategoryId: expenses.subcategoryId,
  subcategoryName: subcategories.name,
  accountId: expenses.accountId,
  categoryName: categories.name,
  categoryColor: categories.color,
  categoryIcon: categories.icon,
  categoryParentId: categories.parentId,
  categoryIsFixed: categories.isFixed,
  accountName: accounts.name,
};

function selectOperations() {
  return db
    .select(operationColumns)
    .from(expenses)
    .innerJoin(categories, eq(expenses.categoryId, categories.id))
    .innerJoin(accounts, eq(expenses.accountId, accounts.id))
    .leftJoin(subcategories, eq(expenses.subcategoryId, subcategories.id));
}

type OperationRow = ReturnType<
  ReturnType<typeof selectOperations>["all"]
>[number];

function mapExpenseOperationRow(r: OperationRow): ExpenseOperation {
  return {
    id: r.id,
    amount: r.amount,
    currency: r.currency,
    date: r.date,
    type: r.type,
    description: r.description,
    categoryId: r.categoryId,
    subcategoryId: r.subcategoryId,
    subcategoryName: r.subcategoryName ?? null,
    accountId: r.accountId,
    categoryName: r.categoryName,
    categoryColor: r.categoryColor,
    categoryIcon: r.categoryIcon,
    accountName: r.accountName,
  };
}

export async function getExpenseStats(month: string) {
  const baseCurrency = await getBaseCurrency();
  const fx = await getFxRates(baseCurrency);
  const today = localTodayISO();
  const currentMonth = today.slice(0, 7);
  const isCurrentMonth = month === currentMonth;
  const daysInMonth = daysInMonthOf(month);
  const elapsedDays = isCurrentMonth
    ? Number(today.slice(8, 10))
    : month < currentMonth
      ? daysInMonth
      : 0;

  const prevMonth = shiftMonth(month, -1);

  const rows = selectOperations()
    .where(
      and(gte(expenses.date, `${month}-01`), lte(expenses.date, `${month}-31`)),
    )
    .orderBy(desc(expenses.date), desc(expenses.id))
    .all();

  const prevRows = db
    .select({
      amount: expenses.amount,
      currency: expenses.currency,
      type: expenses.type,
      date: expenses.date,
    })
    .from(expenses)
    .where(
      and(
        gte(expenses.date, `${prevMonth}-01`),
        lte(expenses.date, `${prevMonth}-31`),
      ),
    )
    .all();

  const allCats = db.select().from(categories).all();
  const catById = new Map(allCats.map((c) => [c.id, c]));

  const dailyMap = new Map<
    number,
    { expense: number; fixed: number; income: number }
  >();
  const categoryMap = new Map<
    number,
    {
      name: string;
      color: string;
      icon: string;
      isFixed: boolean;
      total: number;
      days: Set<number>;
      subs: Map<number, { name: string; total: number }>;
    }
  >();
  let totalIncomeMonth = 0;
  let scheduledExpense = 0;
  let scheduledCount = 0;

  for (const e of rows) {
    const base = await convertToBase(e.amount, e.currency, baseCurrency, fx);
    const day = Number(e.date.slice(8, 10));
    const isScheduled = e.date > today;

    // Operations filed directly under a subcategory roll up into their parent.
    const parent =
      e.categoryParentId != null ? catById.get(e.categoryParentId) : undefined;
    const categoryId = parent?.id ?? e.categoryId;
    const isFixed = (parent?.isFixed ?? e.categoryIsFixed) === 1;

    const dayData = dailyMap.get(day) ?? { expense: 0, fixed: 0, income: 0 };
    dailyMap.set(day, dayData);

    if (e.type === "expense") {
      dayData.expense += base;
      if (isFixed) dayData.fixed += base;

      if (isScheduled) {
        scheduledExpense += base;
        scheduledCount += 1;
        continue;
      }

      const cat = categoryMap.get(categoryId) ?? {
        name: parent?.name ?? e.categoryName,
        color: parent?.color ?? e.categoryColor,
        icon: parent?.icon ?? e.categoryIcon,
        isFixed,
        total: 0,
        days: new Set<number>(),
        subs: new Map(),
      };
      categoryMap.set(categoryId, cat);
      cat.total += base;
      cat.days.add(day);

      const subId = e.subcategoryId ?? (parent ? e.categoryId : null);
      if (subId != null) {
        const sub = cat.subs.get(subId) ?? {
          name: catById.get(subId)?.name ?? "Other",
          total: 0,
        };
        sub.total += base;
        cat.subs.set(subId, sub);
      }
    } else if (!isScheduled) {
      totalIncomeMonth += base;
      dayData.income += base;
    }
  }

  // Header total is derived from the rounded category totals so the list always adds up.
  const categoryTotals = [...categoryMap.values()].map((c) => round2(c.total));
  const totalExpenseMonth = round2(categoryTotals.reduce((s, v) => s + v, 0));
  const fixedTotal = round2(
    [...categoryMap.values()]
      .filter((c) => c.isFixed)
      .reduce((s, c) => s + round2(c.total), 0),
  );
  const variableTotal = round2(totalExpenseMonth - fixedTotal);

  const daily: DailySpend[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const data = dailyMap.get(d);
    const date = `${month}-${String(d).padStart(2, "0")}`;
    const expense = round2(data?.expense ?? 0);
    const fixed = round2(data?.fixed ?? 0);
    daily.push({
      day: d,
      date,
      expense,
      fixed,
      variable: round2(expense - fixed),
      income: round2(data?.income ?? 0),
      isToday: date === today,
      isFuture: date > today,
    });
  }

  const dailyAverage = elapsedDays > 0 ? totalExpenseMonth / elapsedDays : 0;
  const variableDailyAverage =
    elapsedDays > 0 ? variableTotal / elapsedDays : 0;

  // Like-for-like: an in-progress month is compared with the same days of the previous month.
  const prevDays = daysInMonthOf(prevMonth);
  const throughDay = isCurrentMonth ? Math.min(elapsedDays, prevDays) : prevDays;
  let previousComparable = 0;
  for (const e of prevRows) {
    if (e.type !== "expense") continue;
    if (Number(e.date.slice(8, 10)) > throughDay) continue;
    previousComparable += await convertToBase(
      e.amount,
      e.currency,
      baseCurrency,
      fx,
    );
  }
  previousComparable = round2(previousComparable);
  const trend: SpendingTrend = {
    percent:
      previousComparable > 0
        ? ((totalExpenseMonth - previousComparable) / previousComparable) * 100
        : null,
    current: totalExpenseMonth,
    previous: previousComparable,
    previousMonth: prevMonth,
    basis: isCurrentMonth ? "to-date" : "full-month",
    throughDay,
  };

  const budgetRows = await getBudgetsWithSpending(month);
  const parentBudgetByCategory = new Map<number, number>();
  const subBudgetById = new Map<number, number>();

  for (const b of budgetRows) {
    if (b.subcategoryId != null) {
      subBudgetById.set(b.subcategoryId, b.limit);
    } else {
      parentBudgetByCategory.set(b.categoryId, b.limit);
    }
  }

  const breakdown: CategoryBreakdown[] = [...categoryMap.entries()]
    .map(([categoryId, c]) => {
      const total = round2(c.total);
      const budgetLimit = parentBudgetByCategory.get(categoryId) ?? null;
      const budgetPercent =
        budgetLimit != null && budgetLimit > 0
          ? (total / budgetLimit) * 100
          : null;

      return {
        categoryId,
        name: c.name,
        color: c.color,
        icon: c.icon,
        isFixed: c.isFixed,
        total,
        percent: totalExpenseMonth > 0 ? (total / totalExpenseMonth) * 100 : 0,
        budgetLimit,
        budgetPercent,
        subcategories: [...c.subs.entries()]
          .map(([id, s]) => {
            const subLimit = subBudgetById.get(id) ?? null;
            const subTotal = round2(s.total);
            return {
              id,
              name: s.name,
              total: subTotal,
              budgetLimit: subLimit,
              budgetPercent:
                subLimit != null && subLimit > 0
                  ? (subTotal / subLimit) * 100
                  : null,
            };
          })
          .sort((a, b) => b.total - a.total),
      };
    })
    .sort((a, b) => b.total - a.total);

  const fixedCategories: FixedCategorySummary[] = [...categoryMap.entries()]
    .filter(([, c]) => c.isFixed && c.total > 0)
    .map(([categoryId, c]) => ({
      categoryId,
      name: c.name,
      total: round2(c.total),
      days: [...c.days].sort((a, b) => a - b),
    }));

  return {
    baseCurrency,
    month,
    monthLabel: formatMonthLong(month),
    today,
    isCurrentMonth,
    elapsedDays,
    daysInMonth,
    totalExpenseMonth,
    totalIncomeMonth: round2(totalIncomeMonth),
    fixedTotal,
    variableTotal,
    fixedCategories,
    dailyAverage,
    variableDailyAverage,
    scheduledExpense: round2(scheduledExpense),
    scheduledCount,
    trend,
    daily,
    breakdown,
    operations: rows.map(mapExpenseOperationRow),
  };
}

export type ExpenseStats = Awaited<ReturnType<typeof getExpenseStats>>;

export function searchExpenses(
  query: string,
  limit = 50,
): ExpenseOperation[] {
  const q = query.trim();
  if (!q) return [];

  const pattern = `%${q}%`;

  const rows = selectOperations()
    .where(
      or(
        like(expenses.description, pattern),
        like(categories.name, pattern),
        like(subcategories.name, pattern),
        like(accounts.name, pattern),
      ),
    )
    .orderBy(desc(expenses.date), desc(expenses.id))
    .limit(limit)
    .all();

  return rows.map(mapExpenseOperationRow);
}
