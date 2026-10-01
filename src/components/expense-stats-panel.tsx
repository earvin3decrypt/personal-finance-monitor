"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CategoryIcon } from "@/components/category-icon";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CategoryBreakdown, DailySpend } from "@/lib/expense-stats";
import { Money } from "@/components/money";

type MonthlyStatsProps = {
  baseCurrency: string;
  totalExpenseMonth: number;
  totalIncomeMonth: number;
  dailyAverage: number;
  trendPercent: number;
  daily: DailySpend[];
  monthLabel?: string;
};

export function ExpenseMonthlyStats({
  baseCurrency,
  totalExpenseMonth,
  totalIncomeMonth,
  dailyAverage,
  trendPercent,
  daily,
  monthLabel,
}: MonthlyStatsProps) {
  return (
    <section className="mb-10">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        {monthLabel && (
          <h2 className="mb-4 text-sm font-semibold text-foreground/90">
            Statistics · {monthLabel}
          </h2>
        )}
        <div className="mb-6 flex flex-wrap gap-6 border-b border-border/50 pb-5">
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Expenses</p>
            <p className="text-2xl font-bold tabular-nums">
              <Money amount={totalExpenseMonth} currency={baseCurrency} />
            </p>
          </div>
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Income</p>
            <p className="text-2xl font-bold tabular-nums text-gain">
              <Money>+{formatMoney(totalIncomeMonth, baseCurrency)}</Money>
            </p>
          </div>
          <div>
            <p className="mb-1 text-sm text-muted-foreground">
              Daily avg (expenses)
            </p>
            <p className="text-2xl font-bold tabular-nums">
              <Money amount={dailyAverage} currency={baseCurrency} />
            </p>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Daily activity</span>
          <div className="flex gap-3">
            <span className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-primary" /> Expenses
            </span>
            <span className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-gain" /> Income
            </span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={daily}
            barCategoryGap={2}
            margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
          >
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: "oklch(0.52 0.02 260)" }}
              interval={4}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "0.75rem",
                border: "1px solid oklch(0.91 0.01 250)",
                boxShadow: "0 4px 12px oklch(0.22 0.02 260 / 0.08)",
              }}
              formatter={(v: number, name: string) => [
                <Money key="v" amount={v} currency={baseCurrency} />,
                name === "expense" ? "Expense" : "Income",
              ]}
              labelFormatter={(d) => `Day ${d}`}
              cursor={{ fill: "oklch(0.95 0.01 250 / 0.5)" }}
            />
            <Bar
              dataKey="expense"
              fill="oklch(0.55 0.19 250)"
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="income"
              fill="var(--color-gain)"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>

        {trendPercent !== 0 && (
          <div className="mt-5 flex items-start gap-2 rounded-xl bg-primary-light/40 px-3 py-2 text-sm text-primary">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Your average consumption has{" "}
              {trendPercent > 0 ? "increased" : "decreased"} by{" "}
              <strong>{Math.abs(trendPercent).toFixed(0)}%</strong> compared to
              the previous month.
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

export function ExpenseCategoryBreakdown({
  baseCurrency,
  breakdown,
}: {
  baseCurrency: string;
  breakdown: CategoryBreakdown[];
}) {
  const [expandedId, setExpandedId] = useState<number | null>(
    breakdown[0]?.categoryId ?? null,
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border/50 p-5">
        <h3 className="font-semibold text-foreground/90">Categories</h3>
      </div>
      <div className="flex-1 p-5">
        {breakdown.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No expenses for this month.
          </p>
        ) : (
          <ul className="space-y-6">
            {breakdown.map((cat) => {
              const hasBudget = cat.budgetLimit != null && cat.budgetLimit > 0;
              const barPercent = hasBudget
                ? Math.min(100, cat.budgetPercent ?? 0)
                : cat.percent;
              const overspent =
                hasBudget && (cat.budgetPercent ?? 0) > 100;

              return (
                <li key={cat.categoryId}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(
                        expandedId === cat.categoryId ? null : cat.categoryId,
                      )
                    }
                    className="group w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-3">
                        <CategoryIcon
                          icon={cat.icon}
                          color={cat.color}
                          size={18}
                        />
                        <span className="truncate font-medium transition-colors group-hover:text-primary">
                          {cat.name}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-medium tabular-nums">
                        <Money amount={cat.total} currency={baseCurrency} />
                        {hasBudget && (
                          <span className="font-normal text-muted-foreground">
                            <Money>
                              {" "}
                              / {formatMoney(cat.budgetLimit!, baseCurrency)}
                            </Money>
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(barPercent, 0)}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                    <p
                      className={`mt-1.5 text-right text-xs ${
                        overspent ? "font-medium text-loss" : "text-muted-foreground"
                      }`}
                    >
                      {hasBudget
                        ? `${(cat.budgetPercent ?? 0).toFixed(2)}% of budget used`
                        : `${cat.percent.toFixed(0)}% of spending`}
                    </p>
                  </button>
                  {expandedId === cat.categoryId &&
                    cat.subcategories.length > 0 && (
                      <ul className="ml-[9px] mt-3 space-y-2.5 border-l-2 border-border/60 pl-5">
                        {cat.subcategories.map((sub) => {
                          const subHasBudget =
                            sub.budgetLimit != null && sub.budgetLimit > 0;
                          const subOverspent =
                            subHasBudget && (sub.budgetPercent ?? 0) > 100;

                          return (
                          <li
                            key={sub.id}
                            className="space-y-1.5 text-sm text-muted-foreground"
                          >
                            <div className="flex justify-between gap-3">
                              <span>{sub.name}</span>
                              <span
                                className={cn(
                                  "shrink-0 font-medium tabular-nums",
                                  subOverspent
                                    ? "text-loss"
                                    : "text-foreground/80",
                                )}
                              >
                                <Money amount={sub.total} currency={baseCurrency} />
                                {subHasBudget && (
                                  <span className="font-normal text-muted-foreground">
                                    <Money>
                                      {" "}
                                      / {formatMoney(sub.budgetLimit!, baseCurrency)}
                                    </Money>
                                  </span>
                                )}
                              </span>
                            </div>
                            {subHasBudget && (
                              <>
                                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${Math.min(100, sub.budgetPercent ?? 0)}%`,
                                      backgroundColor: cat.color,
                                    }}
                                  />
                                </div>
                                <p
                                  className={cn(
                                    "text-right text-xs",
                                    subOverspent
                                      ? "font-medium text-loss"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {(sub.budgetPercent ?? 0).toFixed(2)}% of budget
                                  used
                                </p>
                              </>
                            )}
                          </li>
                          );
                        })}
                      </ul>
                    )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
