import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { getCategoryTree } from "@/lib/categories";
import { getExpenseStats, getMonthlyExpenseHistory } from "@/lib/expense-stats";
import { getBaseCurrency } from "@/lib/settings";
import { formatMoney, localTodayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/ui";
import { MonthlyHistory } from "@/components/monthly-history";
import { NewOperationButton } from "@/components/expense-entry";
import { OperationsList } from "@/components/operations-list";
import { ExpenseCategoryBreakdown } from "@/components/expense-stats-panel";
import { ExpenseDailyChart } from "@/components/expense-daily-chart";
import { ExpenseFilterProvider } from "@/components/expense-filter-context";

export const metadata: Metadata = {
  title: "Expenses | Personal Finance Monitor",
  description: "Log expenses and view spending statistics",
};

function MonthLink({
  month,
  direction,
}: {
  month: string | null;
  direction: "prev" | "next";
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const label = direction === "prev" ? "Previous month" : "Next month";
  const className =
    "flex h-9 w-9 items-center justify-center rounded-[10px] text-muted-foreground transition-colors";
  if (!month) {
    return (
      <span aria-disabled="true" aria-label={label} className={cn(className, "opacity-50")}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
    );
  }
  return (
    <Link
      href={`/expenses?month=${month}`}
      scroll={false}
      aria-label={label}
      className={cn(
        className,
        "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </Link>
  );
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const today = localTodayISO();
  const currentMonth = today.slice(0, 7);
  const baseCurrency = await getBaseCurrency();
  const categories = getCategoryTree();
  const accountOptions = db
    .select()
    .from(accounts)
    .all()
    .map((a) => ({ id: a.id, name: a.name, currency: a.currency }));
  const monthlyHistory = await getMonthlyExpenseHistory();
  const months = monthlyHistory.points.map((p) => p.month);
  const selectedMonth =
    monthParam && months.includes(monthParam) ? monthParam : currentMonth;
  const monthIndex = months.indexOf(selectedMonth);
  const prevMonth = monthIndex > 0 ? months[monthIndex - 1] : null;
  const nextMonth =
    monthIndex >= 0 && monthIndex < months.length - 1
      ? months[monthIndex + 1]
      : null;

  const stats = await getExpenseStats(selectedMonth);
  const { isCurrentMonth, monthLabel } = stats;
  const net = monthlyHistory.totalIncome - monthlyHistory.totalExpense;

  const largestFixed = stats.breakdown.find((c) => c.isFixed);
  const fixedShare =
    stats.totalExpenseMonth > 0
      ? (stats.fixedTotal / stats.totalExpenseMonth) * 100
      : 0;
  const fixedNames = stats.fixedCategories.map((c) => c.name);
  const spentSub =
    stats.fixedTotal > 0
      ? fixedNames.length === 1 && largestFixed
        ? `${Math.round(fixedShare)}% of it is ${largestFixed.name} (fixed)`
        : `${Math.round(fixedShare)}% of it is fixed (${fixedNames.join(", ")})`
      : `Across ${stats.breakdown.length} categor${stats.breakdown.length === 1 ? "y" : "ies"}`;
  const dayWord = stats.elapsedDays === 1 ? "day" : "days";
  const variableSub =
    stats.elapsedDays > 0
      ? `${formatMoney(stats.variableDailyAverage, stats.baseCurrency)} / day over ${stats.elapsedDays} ${isCurrentMonth ? "elapsed " : ""}${dayWord}`
      : "No days elapsed yet";
  const incomeCount = stats.operations.filter(
    (o) => o.type === "income" && o.date <= today,
  ).length;
  const scope = isCurrentMonth ? "this month" : `in ${monthLabel.split(" ")[0]}`;

  return (
    <div className="pb-20">
      <ExpenseFilterProvider>
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Money
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-[-0.02em]">Expenses</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track spending, see where it goes, and log new operations
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <nav
              aria-label="Month"
              className="flex select-none items-center gap-1 rounded-[10px] border border-border bg-card p-0.5 [border-width:0.5px]"
            >
              <MonthLink month={prevMonth} direction="prev" />
              <span
                className="min-w-[8.5rem] text-center text-sm font-medium"
                aria-live="polite"
              >
                {monthLabel}
              </span>
              <MonthLink month={nextMonth} direction="next" />
            </nav>
            {!isCurrentMonth && (
              <Link
                href="/expenses"
                className="rounded-md text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
              >
                Today
              </Link>
            )}
            <Suspense fallback={null}>
              <NewOperationButton
                categories={categories}
                accounts={accountOptions}
                defaultCurrency={baseCurrency}
                defaultDate={today}
              />
            </Suspense>
          </div>
        </header>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={`Spent ${scope}`}
            value={formatMoney(stats.totalExpenseMonth, stats.baseCurrency)}
            sub={spentSub}
          />
          <StatCard
            label="Variable spending"
            value={formatMoney(stats.variableTotal, stats.baseCurrency)}
            sub={variableSub}
          />
          <StatCard
            label={`Income ${scope}`}
            value={
              <span className="text-gain">
                +{formatMoney(stats.totalIncomeMonth, stats.baseCurrency)}
              </span>
            }
            sub={`${incomeCount} income operation${incomeCount === 1 ? "" : "s"}`}
          />
          <StatCard
            label="Net, last 12 months"
            value={
              <span className={net >= 0 ? "text-gain" : "text-loss"}>
                {net >= 0 ? "+" : "−"}
                {formatMoney(Math.abs(net), monthlyHistory.baseCurrency)}
              </span>
            }
            sub={`${formatMoney(monthlyHistory.totalIncome, monthlyHistory.baseCurrency)} in · ${formatMoney(monthlyHistory.totalExpense, monthlyHistory.baseCurrency)} out`}
          />
        </div>

        <div className="mb-6 grid gap-6 min-[900px]:grid-cols-2">
          <ExpenseDailyChart
            baseCurrency={stats.baseCurrency}
            monthLabel={monthLabel}
            daily={stats.daily}
            isCurrentMonth={isCurrentMonth}
            elapsedDays={stats.elapsedDays}
            dailyAverage={stats.dailyAverage}
            fixedCategories={stats.fixedCategories}
            scheduledExpense={stats.scheduledExpense}
            trend={stats.trend}
          />
          <ExpenseCategoryBreakdown
            baseCurrency={stats.baseCurrency}
            breakdown={stats.breakdown}
            totalExpense={stats.totalExpenseMonth}
          />
        </div>

        <MonthlyHistory {...monthlyHistory} selectedMonth={selectedMonth} />

        <OperationsList
          key={selectedMonth}
          initialOperations={stats.operations}
          categories={categories}
          accounts={accountOptions}
          monthLabel={monthLabel}
          today={today}
        />
      </ExpenseFilterProvider>
    </div>
  );
}
