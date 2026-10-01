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
import { getExpenseStats } from "@/lib/expense-stats";
import { getSavingsGoalsWithHistory } from "@/lib/savings";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import {
  Card,
  OfflineBanner,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { NetWorthChart, BreakdownDonut } from "@/components/charts";
import { CategoryIcon } from "@/components/category-icon";
import { DashboardGoals } from "@/components/dashboard-goals";
import { DashboardRefreshButton } from "@/components/dashboard-refresh-button";
import { UpcomingBillsCard } from "@/components/upcoming-bills-card";
import { Money } from "@/components/money";
import { getBillAlerts } from "@/lib/bills";

export const metadata: Metadata = {
  title: "Dashboard | Personal Finance Monitor",
  description: "Net worth, portfolio trend, and recent activity",
};

function previousMonth(month: string): string {
  const d = new Date(`${month}-01`);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function DashboardPage() {
  noStore();
  await applyDueInterest();
  await ensureTodaySnapshot();
  const summary = await getPortfolioSummary();
  const history = getPortfolioHistory();
  const today = todayISO();
  const currentMonth = today.slice(0, 7);

  const [monthStats, prevMonthStats, savingsGoals, billAlerts] =
    await Promise.all([
      getExpenseStats(currentMonth),
      getExpenseStats(previousMonth(currentMonth)),
      getSavingsGoalsWithHistory(),
      getBillAlerts(),
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
    .sort((a, b) => b.percent - a.percent)
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
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
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <CategoryIcon
                      icon={e.categoryIcon}
                      color={e.categoryColor}
                      size={16}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {e.description || e.categoryName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {e.categoryName}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`tabular-nums font-medium ${
                        e.type === "income" ? "text-gain" : "text-foreground"
                      }`}
                    >
                      <Money>
                        {e.type === "income" ? "+" : "−"}
                        {formatMoney(e.amount, e.currency)}
                      </Money>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(e.date)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <DashboardGoals goals={topGoals} />
      </div>
    </>
  );
}
