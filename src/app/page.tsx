import type { Metadata } from "next";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { ChevronRight } from "lucide-react";
import { db } from "@/db";
import { categories, expenses, accounts } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { ensureTodaySnapshot, getPortfolioHistory } from "@/lib/snapshot";
import { applyDueInterest } from "@/lib/interest";
import { getPortfolioSummary } from "@/lib/portfolio";
import {
  buildNetWorthChartData,
  computeSnapshotTrend,
  filterMultiSeriesForRange,
} from "@/lib/chart-data";
import { getSavingsGoalsWithHistory } from "@/lib/savings";
import { getBudgetsWithSpending } from "@/lib/budgets";
import {
  displayTransactionTitle,
  formatMoney,
  formatRelativeDate,
  todayISO,
} from "@/lib/format";
import {
  Card,
  OfflineBanner,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { NetWorthChart, BreakdownDonut } from "@/components/charts";
import { CategoryIcon } from "@/components/category-icon";
import { DashboardGoals } from "@/components/dashboard-goals";
import { DashboardMonthlyBudget } from "@/components/dashboard-monthly-budget";
import { DashboardRefreshButton } from "@/components/dashboard-refresh-button";
import { UpcomingBillsCard } from "@/components/upcoming-bills-card";
import { Money } from "@/components/money";
import { getBillAlerts } from "@/lib/bills";

export const metadata: Metadata = {
  title: "Dashboard | Personal Finance Monitor",
  description: "Net worth, portfolio trend, and recent activity",
};

export default async function DashboardPage() {
  noStore();
  await applyDueInterest();
  await ensureTodaySnapshot();
  const summary = await getPortfolioSummary();
  const history = getPortfolioHistory();
  const today = todayISO();
  const currentMonth = today.slice(0, 7);

  const [savingsGoals, billAlerts, budgets] = await Promise.all([
    getSavingsGoalsWithHistory(),
    getBillAlerts(),
    getBudgetsWithSpending(currentMonth),
  ]);

  const recentExpenses = db
    .select({
      id: expenses.id,
      amount: expenses.amount,
      currency: expenses.currency,
      description: expenses.description,
      date: expenses.date,
      type: expenses.type,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      accountName: accounts.name,
    })
    .from(expenses)
    .innerJoin(categories, eq(expenses.categoryId, categories.id))
    .innerJoin(accounts, eq(expenses.accountId, accounts.id))
    .orderBy(desc(expenses.date), desc(expenses.id))
    .limit(5)
    .all();

  const chartData = buildNetWorthChartData(history, summary, today);
  const chartData1M = filterMultiSeriesForRange(chartData, "1M");

  const sparklines = {
    netWorth: chartData1M.map((d) => d.total),
    investments: chartData1M.map((d) => d.investments),
    cash: chartData1M.map((d) => d.cash),
    crypto: chartData1M.map((d) => d.crypto),
  };

  const breakdown = [
    { name: "Cash", value: summary.cashTotalBase },
    { name: "Investments", value: summary.investmentsTotalBase },
    ...(summary.cryptoTotalBase > 0
      ? [{ name: "Crypto", value: summary.cryptoTotalBase }]
      : []),
  ];

  const netWorthTrend = computeSnapshotTrend(
    history,
    summary.netWorthBase,
    (row) => row.totalValueBase,
  );
  const investmentsTrend = computeSnapshotTrend(
    history,
    summary.investmentsTotalBase,
    (row) => row.investmentsValueBase,
  );
  const cashTrend = computeSnapshotTrend(
    history,
    summary.cashTotalBase,
    (row) => row.cashValueBase,
  );
  const cryptoTrend = computeSnapshotTrend(
    history,
    summary.cryptoTotalBase,
    (row) => row.cryptoValueBase,
  );

  const topGoals = savingsGoals
    .slice()
    .sort((a, b) => {
      const aDone = a.percent >= 100 ? 1 : 0;
      const bDone = b.percent >= 100 ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return b.percent - a.percent;
    })
    .slice(0, 3)
    .map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      current: g.current,
      target: g.target,
      percent: g.percent,
      currency: g.currency,
    }));

  const budgetItems = budgets
    .slice()
    .sort((a, b) => b.percent - a.percent)
    .map((b) => ({
      id: b.id,
      name: b.parentName ? `${b.parentName} · ${b.name}` : b.name,
      icon: b.icon,
      color: b.color,
      spent: b.spent,
      limit: b.limit,
      percent: b.percent,
      currency: summary.baseCurrency,
    }));
  const totalBudgetLimit = budgets.reduce((sum, b) => sum + b.limit, 0);
  const totalBudgetSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const showBudgetCompanion = topGoals.length <= 1;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your net worth and recent activity"
        action={<DashboardRefreshButton />}
      />
      <OfflineBanner
        fxStale={summary.fxStale}
        pricesStale={summary.pricesStale}
        refreshAction={<DashboardRefreshButton />}
      />

      <UpcomingBillsCard bills={billAlerts.bills} />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total net worth"
          value={formatMoney(summary.netWorthBase, summary.baseCurrency)}
          trend={netWorthTrend}
          sparklineData={sparklines.netWorth}
          accentColor="oklch(0.7 0.16 250)"
        />
        <StatCard
          label="Investments"
          value={formatMoney(
            summary.investmentsTotalBase,
            summary.baseCurrency,
          )}
          href="/portfolio"
          trend={investmentsTrend}
          sparklineData={sparklines.investments}
          accentColor="oklch(0.72 0.14 300)"
        />
        <StatCard
          label="Cash balance"
          value={formatMoney(summary.cashTotalBase, summary.baseCurrency)}
          href="/accounts"
          trend={cashTrend}
          sparklineData={sparklines.cash}
          accentColor="oklch(0.7 0.14 165)"
        />
        <StatCard
          label="Crypto balance"
          value={formatMoney(summary.cryptoTotalBase, summary.baseCurrency)}
          href="/crypto"
          trend={cryptoTrend}
          sparklineData={sparklines.crypto}
          accentColor="oklch(0.74 0.15 75)"
        />
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col lg:col-span-2">
          <NetWorthChart
            data={chartData}
            currency={summary.baseCurrency}
            title="Portfolio performance"
          />
        </Card>
        <Card className="flex h-full flex-col">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">
            Asset allocation
          </h2>
          <BreakdownDonut data={breakdown} currency={summary.baseCurrency} />
          <Link
            href="/accounts"
            className="mt-auto flex items-center gap-0.5 pt-8 text-xs font-medium text-primary hover:underline"
          >
            View full allocation
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <Card className="flex h-full flex-col">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              Recent transactions
            </h2>
            <Link
              href="/expenses"
              className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
            >
              View all
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recentExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentExpenses.map((e) => (
                <li
                  key={e.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 py-3 first:pt-0 last:pb-0"
                >
                  <CategoryIcon
                    icon={e.categoryIcon}
                    color={e.categoryColor}
                    size={16}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium leading-5">
                      {displayTransactionTitle(e.description, e.categoryName)}
                    </p>
                    <p className="truncate text-xs leading-4 text-muted-foreground">
                      {e.categoryName}
                      {e.accountName ? ` · ${e.accountName}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-sm font-medium tabular-nums leading-5 ${
                        e.type === "income" ? "text-gain" : "text-foreground"
                      }`}
                    >
                      <Money>
                        {e.type === "income" ? "+" : "−"}
                        {formatMoney(e.amount, e.currency)}
                      </Money>
                    </p>
                    <p className="text-xs leading-4 text-muted-foreground">
                      {formatRelativeDate(e.date, today)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div
          className={`flex flex-col gap-6 ${showBudgetCompanion ? "" : "h-full"}`}
        >
          <div className={showBudgetCompanion ? undefined : "min-h-0 flex-1"}>
            <DashboardGoals goals={topGoals} />
          </div>
          {showBudgetCompanion && (
            <DashboardMonthlyBudget
              budgets={budgetItems}
              currency={summary.baseCurrency}
              totalSpent={totalBudgetSpent}
              totalLimit={totalBudgetLimit}
            />
          )}
        </div>
      </div>
    </>
  );
}
