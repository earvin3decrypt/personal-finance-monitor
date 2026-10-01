import { db } from "@/db";
import { accounts, categories, expenses } from "@/db/schema";
import { and, desc, eq, gte, like, lte, or } from "drizzle-orm";
import { convertToBase, getFxRates } from "@/lib/fx";
import { todayISO } from "@/lib/format";
import { getBaseCurrency } from "@/lib/settings";
import { getBudgetsWithSpending } from "@/lib/budgets";

export type DailySpend = { day: number; expense: number; income: number };
export type CategoryBreakdown = {
  categoryId: number;
  name: string;
  color: string;
  icon: string;
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
  accountId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  accountName: string;
};

export type MonthlyHistoryPoint = {
  month: string;
  label: string;
  expense: number;
  income: number;
};

export type MonthlyHistory = {
  baseCurrency: string;
  points: MonthlyHistoryPoint[];
  totalExpense: number;
  totalIncome: number;
  avgExpense: number;
};

function monthKeysBack(count: number, anchor: Date): string[] {
  const keys: string[] = [];
  const end = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    keys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
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
  const today = todayISO();
  const monthKeys = monthKeysBack(months, new Date(`${today}T00:00:00`));
  const startDate = `${monthKeys[0]}-01`;

  const rows = db
    .select({
      amount: expenses.amount,
      currency: expenses.currency,
      date: expenses.date,
      type: expenses.type,
    })
    .from(expenses)
    .where(gte(expenses.date, startDate))
    .all();

  const bucket = new Map<string, { expense: number; income: number }>();
  for (const key of monthKeys) {
    bucket.set(key, { expense: 0, income: 0 });
  }

  for (const e of rows) {
    const key = e.date.slice(0, 7);
    if (!bucket.has(key)) continue;
    const base = await convertToBase(e.amount, e.currency, baseCurrency, fx);
    const entry = bucket.get(key)!;
    if (e.type === "expense") {
      entry.expense += base;
    } else {
      entry.income += base;
    }
  }

  const spansYears = new Set(monthKeys.map((k) => k.slice(0, 4))).size > 1;
  const points: MonthlyHistoryPoint[] = monthKeys.map((month) => {
    const { expense, income } = bucket.get(month)!;
    return {
      month,
      label: formatMonthLabel(month, spansYears),
      expense,
      income,
    };
  });

  let totalExpense = 0;
  let totalIncome = 0;
  for (const p of points) {
    totalExpense += p.expense;
    totalIncome += p.income;
  }

  const avgExpense = points.length > 0 ? totalExpense / points.length : 0;

  return {
    baseCurrency,
    points,
    totalExpense,
    totalIncome,
    avgExpense,
  };
}

export async function getExpenseStats(month: string) {
  const baseCurrency = await getBaseCurrency();
  const fx = await getFxRates(baseCurrency);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`;

  const prevMonthDate = new Date(`${month}-01`);
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const prevStart = `${prevMonth}-01`;
  const prevEnd = `${prevMonth}-31`;

  const rows = db
    .select({
      id: expenses.id,
      amount: expenses.amount,
      currency: expenses.currency,
      date: expenses.date,
      type: expenses.type,
      description: expenses.description,
      categoryId: expenses.categoryId,
      subcategoryId: expenses.subcategoryId,
      accountId: expenses.accountId,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      accountName: accounts.name,
    })
    .from(expenses)
    .innerJoin(categories, eq(expenses.categoryId, categories.id))
    .innerJoin(accounts, eq(expenses.accountId, accounts.id))
    .where(
      and(
        gte(expenses.date, monthStart),
        lte(expenses.date, monthEnd),
      ),
    )
    .orderBy(desc(expenses.date), desc(expenses.id))
    .all();

  const prevRows = db
    .select({ amount: expenses.amount, currency: expenses.currency, type: expenses.type })
    .from(expenses)
    .where(
      and(
        gte(expenses.date, prevStart),
        lte(expenses.date, prevEnd),
      ),
    )
    .all();

  let totalExpenseMonth = 0;
  let totalIncomeMonth = 0;
  const dailyMap = new Map<number, { expense: number; income: number }>();
  const categoryMap = new Map<
    number,
    {
      name: string;
      color: string;
      icon: string;
      total: number;
      subs: Map<number, { name: string; total: number }>;
    }
  >();

  const allCats = db.select().from(categories).all();
  const subName = new Map(allCats.map((c) => [c.id, c.name]));

  for (const e of rows) {
    const base = await convertToBase(e.amount, e.currency, baseCurrency, fx);
    const day = Number(e.date.slice(8, 10));
    
    if (!dailyMap.has(day)) {
      dailyMap.set(day, { expense: 0, income: 0 });
    }
    const dayData = dailyMap.get(day)!;

    if (e.type === "expense") {
      totalExpenseMonth += base;
      dayData.expense += base;

      if (!categoryMap.has(e.categoryId)) {
        categoryMap.set(e.categoryId, {
          name: e.categoryName,
          color: e.categoryColor,
          icon: e.categoryIcon,
          total: 0,
          subs: new Map(),
        });
      }
      const cat = categoryMap.get(e.categoryId)!;
      cat.total += base;
      if (e.subcategoryId) {
        const subTotal = cat.subs.get(e.subcategoryId)?.total ?? 0;
        cat.subs.set(e.subcategoryId, {
          name: subName.get(e.subcategoryId) ?? "Other",
          total: subTotal + base,
        });
      }
    } else {
      totalIncomeMonth += base;
      dayData.income += base;
    }
  }

  let prevExpenseTotal = 0;
  for (const e of prevRows) {
    if (e.type === "expense") {
      prevExpenseTotal += await convertToBase(
        e.amount,
        e.currency,
        baseCurrency,
        fx,
      );
    }
  }

  const daysInMonth = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();

  const daily: DailySpend[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dData = dailyMap.get(d);
    daily.push({ day: d, expense: dData?.expense ?? 0, income: dData?.income ?? 0 });
  }

  const dailyAverage = daysInMonth > 0 ? totalExpenseMonth / daysInMonth : 0;
  const trendPercent =
    prevExpenseTotal > 0 ? ((totalExpenseMonth - prevExpenseTotal) / prevExpenseTotal) * 100 : 0;

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
      const budgetLimit = parentBudgetByCategory.get(categoryId) ?? null;
      const budgetPercent =
        budgetLimit != null && budgetLimit > 0
          ? (c.total / budgetLimit) * 100
          : null;

      return {
        categoryId,
        name: c.name,
        color: c.color,
        icon: c.icon,
        total: c.total,
        percent: totalExpenseMonth > 0 ? (c.total / totalExpenseMonth) * 100 : 0,
        budgetLimit,
        budgetPercent,
        subcategories: [...c.subs.entries()].map(([id, s]) => {
          const subLimit = subBudgetById.get(id) ?? null;
          return {
            id,
            name: s.name,
            total: s.total,
            budgetLimit: subLimit,
            budgetPercent:
              subLimit != null && subLimit > 0
                ? (s.total / subLimit) * 100
                : null,
          };
        }),
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    baseCurrency,
    totalExpenseMonth,
    totalIncomeMonth,
    dailyAverage,
    trendPercent,
    daily,
    breakdown,
    daysInMonth,
    operations: rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      currency: r.currency,
      date: r.date,
      type: r.type,
      description: r.description,
      categoryId: r.categoryId,
      subcategoryId: r.subcategoryId,
      accountId: r.accountId,
      categoryName: r.categoryName,
      categoryColor: r.categoryColor,
      categoryIcon: r.categoryIcon,
      accountName: r.accountName,
    })),
  };
}

function mapExpenseOperationRow(r: {
  id: number;
  amount: number;
  currency: string;
  date: string;
  type: string;
  description: string | null;
  categoryId: number;
  subcategoryId: number | null;
  accountId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  accountName: string;
}): ExpenseOperation {
  return {
    id: r.id,
    amount: r.amount,
    currency: r.currency,
    date: r.date,
    type: r.type,
    description: r.description,
    categoryId: r.categoryId,
    subcategoryId: r.subcategoryId,
    accountId: r.accountId,
    categoryName: r.categoryName,
    categoryColor: r.categoryColor,
    categoryIcon: r.categoryIcon,
    accountName: r.accountName,
  };
}

export function searchExpenses(
  query: string,
  limit = 50,
): ExpenseOperation[] {
  const q = query.trim();
  if (!q) return [];

  const pattern = `%${q}%`;

  const rows = db
    .select({
      id: expenses.id,
      amount: expenses.amount,
      currency: expenses.currency,
      date: expenses.date,
      type: expenses.type,
      description: expenses.description,
      categoryId: expenses.categoryId,
      subcategoryId: expenses.subcategoryId,
      accountId: expenses.accountId,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      accountName: accounts.name,
    })
    .from(expenses)
    .innerJoin(categories, eq(expenses.categoryId, categories.id))
    .innerJoin(accounts, eq(expenses.accountId, accounts.id))
    .where(
      or(
        like(expenses.description, pattern),
        like(categories.name, pattern),
        like(accounts.name, pattern),
      ),
    )
    .orderBy(desc(expenses.date), desc(expenses.id))
    .limit(limit)
    .all();

  return rows.map(mapExpenseOperationRow);
}
