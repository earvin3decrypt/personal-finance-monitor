import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { getCategoryTree } from "@/lib/categories";
import { getExpenseStats, getMonthlyExpenseHistory } from "@/lib/expense-stats";
import { MonthlyHistory } from "@/components/monthly-history";
import { getBaseCurrency } from "@/lib/settings";
import { todayISO } from "@/lib/format";
import { ExpenseEntry } from "@/components/expense-entry";
import { OperationsList } from "@/components/operations-list";
import {
  ExpenseCategoryBreakdown,
  ExpenseMonthlyStats,
} from "@/components/expense-stats-panel";

export const metadata: Metadata = {
  title: "Expenses | Personal Finance Monitor",
  description: "Log expenses and view spending statistics",
};

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(d);
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const currentMonth = todayISO().slice(0, 7);
  const baseCurrency = await getBaseCurrency();
  const categories = getCategoryTree();
  const accountRows = db.select().from(accounts).all();
  const accountOptions = accountRows.map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
  }));
  const monthlyHistory = await getMonthlyExpenseHistory();
  const validMonths = new Set(monthlyHistory.points.map((p) => p.month));
  const selectedMonth =
    monthParam && validMonths.has(monthParam) ? monthParam : currentMonth;
  const isCurrentMonth = selectedMonth === currentMonth;
  const monthLabel = formatMonthLabel(selectedMonth);
  const stats = await getExpenseStats(selectedMonth);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Operations</h1>
        <p className="mt-1 text-muted-foreground">
          Log income and expenses, then review your statistics
        </p>
      </header>

      <MonthlyHistory {...monthlyHistory} selectedMonth={selectedMonth} />

      {!isCurrentMonth && (
        <div className="mb-4">
          <Link
            href="/expenses"
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to current month
          </Link>
        </div>
      )}

      <ExpenseMonthlyStats
        baseCurrency={stats.baseCurrency}
        totalExpenseMonth={stats.totalExpenseMonth}
        totalIncomeMonth={stats.totalIncomeMonth}
        dailyAverage={stats.dailyAverage}
        trendPercent={stats.trendPercent}
        daily={stats.daily}
        monthLabel={monthLabel}
      />

      <div className="mb-10 grid w-full gap-6 lg:grid-cols-2 lg:gap-10">
        <div className="flex h-full min-w-0 flex-col lg:sticky lg:top-6">
          <ExpenseEntry
            categories={categories}
            accounts={accountOptions}
            defaultCurrency={baseCurrency}
            defaultDate={todayISO()}
          />
        </div>
        <div className="flex h-full min-w-0 flex-col">
          <ExpenseCategoryBreakdown
            baseCurrency={stats.baseCurrency}
            breakdown={stats.breakdown}
          />
        </div>
      </div>

      <OperationsList
        initialOperations={stats.operations}
        categories={categories}
        accounts={accountOptions}
      />
    </div>
  );
}
