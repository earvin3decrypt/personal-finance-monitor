"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui";
import { Money } from "@/components/money";
import { tooltipStyle, useChartTheme } from "@/components/charts";
import { formatCompactMoney, formatMoney, formatMonthLong } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MonthlyHistory as MonthlyHistoryData, MonthlyHistoryPoint } from "@/lib/expense-stats";

const INCOME_COLOR = "var(--color-gain)";

type TickProps = {
  x?: number;
  y?: number;
  index?: number;
  payload?: { value?: string };
};

export function MonthlyHistory({
  baseCurrency,
  points,
  totalExpense,
  totalIncome,
  avgExpense,
  avgMonths,
  selectedMonth,
}: MonthlyHistoryData & { selectedMonth?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useChartTheme();
  const activeMonth = selectedMonth ?? points[points.length - 1]?.month;
  const activeLabel = points.find((p) => p.month === activeMonth)?.label;
  const net = totalIncome - totalExpense;

  function selectMonth(month: string | undefined) {
    if (month) router.push(`${pathname}?month=${month}`, { scroll: false });
  }

  function renderTick(props: unknown) {
    const { x = 0, y = 0, index = 0, payload } = props as TickProps;
    const point = points[index];
    const isActive = point?.month === activeMonth;
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          y={12}
          textAnchor="middle"
          fontSize={10}
          fontWeight={isActive ? 600 : 400}
          fill={isActive ? theme.foreground : theme.mutedForeground}
          style={{ cursor: point ? "pointer" : "default" }}
          onClick={() => selectMonth(point?.month)}
        >
          {payload?.value ?? ""}
        </text>
        {point?.isPartial && (
          <text
            y={24}
            textAnchor="middle"
            fontSize={9}
            fill={theme.mutedForeground}
          >
            so far
          </text>
        )}
      </g>
    );
  }

  const summary = `Expenses and income for the last ${points.length} months: ${formatMoney(totalExpense, baseCurrency)} out, ${formatMoney(totalIncome, baseCurrency)} in. Select a month to view its details.`;

  return (
    <Card className="mb-6 min-w-0">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Last 12 months</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Select a bar to view that month
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
            Expenses
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-gain" aria-hidden />
            Income
          </span>
        </div>
      </div>

      <dl className="mb-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:flex sm:flex-wrap">
        <div>
          <dt className="text-xs text-muted-foreground">Total expenses</dt>
          <dd className="font-semibold tabular-nums">
            <Money amount={totalExpense} currency={baseCurrency} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Total income</dt>
          <dd className="font-semibold tabular-nums text-gain">
            <Money>+{formatMoney(totalIncome, baseCurrency)}</Money>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Net</dt>
          <dd
            className={cn(
              "font-semibold tabular-nums",
              net >= 0 ? "text-gain" : "text-loss",
            )}
          >
            <Money>
              {net >= 0 ? "+" : "−"}
              {formatMoney(Math.abs(net), baseCurrency)}
            </Money>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            Avg / month
            {avgMonths > 0 &&
              ` · ${avgMonths} full month${avgMonths === 1 ? "" : "s"}`}
          </dt>
          <dd className="font-semibold tabular-nums">
            {avgMonths > 0 ? (
              <Money amount={avgExpense} currency={baseCurrency} />
            ) : (
              <span className="text-muted-foreground">Not enough data</span>
            )}
          </dd>
        </div>
      </dl>

      <div role="figure" aria-label={summary} className="min-w-0">
        <p className="sr-only">{summary}</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={points}
            barCategoryGap="22%"
            barGap={2}
            margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
            accessibilityLayer
          >
            <CartesianGrid vertical={false} stroke={theme.border} />
            {activeLabel && (
              <ReferenceArea
                x1={activeLabel}
                x2={activeLabel}
                fill={theme.border}
                fillOpacity={0.45}
                ifOverflow="extendDomain"
              />
            )}
            <XAxis
              dataKey="label"
              interval={0}
              height={32}
              axisLine={false}
              tickLine={false}
              tick={renderTick}
            />
            <YAxis
              width={48}
              domain={[0, "auto"]}
              axisLine={false}
              tickLine={false}
              tickCount={4}
              allowDecimals={false}
              tick={{ fontSize: 10, fill: theme.mutedForeground }}
              tickFormatter={(v: number) => formatCompactMoney(v, baseCurrency)}
            />
            <Tooltip
              cursor={{ fill: theme.border, fillOpacity: 0.3 }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as MonthlyHistoryPoint | undefined;
                if (!active || !p) return null;
                const monthNet = p.income - p.expense;
                return (
                  <div style={tooltipStyle(theme)} className="px-3 py-2 text-xs">
                    <p className="font-medium">
                      {formatMonthLong(p.month)}
                      {p.isPartial && (
                        <span className="font-normal text-muted-foreground"> · so far</span>
                      )}
                    </p>
                    <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 tabular-nums">
                      <dt className="text-muted-foreground">Expenses</dt>
                      <dd className="text-right">
                        <Money amount={p.expense} currency={baseCurrency} />
                      </dd>
                      <dt className="text-muted-foreground">Income</dt>
                      <dd className="text-right text-gain">
                        <Money amount={p.income} currency={baseCurrency} />
                      </dd>
                      <dt className="text-muted-foreground">Net</dt>
                      <dd className="text-right">
                        <Money>
                          {monthNet >= 0 ? "+" : "−"}
                          {formatMoney(Math.abs(monthNet), baseCurrency)}
                        </Money>
                      </dd>
                    </dl>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="expense"
              name="Expenses"
              fill={theme.primary}
              radius={[3, 3, 0, 0]}
              cursor="pointer"
              isAnimationActive={false}
              onClick={(d) => selectMonth((d as { month?: string }).month)}
            >
              {points.map((p) => (
                <Cell key={p.month} fillOpacity={p.isPartial ? 0.45 : 1} />
              ))}
            </Bar>
            <Bar
              dataKey="income"
              name="Income"
              fill={INCOME_COLOR}
              radius={[3, 3, 0, 0]}
              cursor="pointer"
              isAnimationActive={false}
              onClick={(d) => selectMonth((d as { month?: string }).month)}
            >
              {points.map((p) => (
                <Cell key={p.month} fillOpacity={p.isPartial ? 0.45 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
