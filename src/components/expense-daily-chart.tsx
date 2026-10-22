"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui";
import { Money } from "@/components/money";
import { tooltipStyle, useChartTheme } from "@/components/charts";
import {
  formatCompactMoney,
  formatDayHeading,
  formatMoney,
  formatMonthLong,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  DailySpend,
  FixedCategorySummary,
  SpendingTrend,
} from "@/lib/expense-stats";

type ChartDatum = DailySpend & { value: number };

type SlotProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: ChartDatum;
};

type TickProps = {
  x?: number;
  y?: number;
  payload?: { value?: number };
};

function formatDayList(days: number[]): string {
  if (days.length === 1) return `on day ${days[0]}`;
  return `on days ${days.join(", ")}`;
}

export function ExpenseDailyChart({
  baseCurrency,
  monthLabel,
  daily,
  isCurrentMonth,
  elapsedDays,
  dailyAverage,
  fixedCategories,
  scheduledExpense,
  trend,
}: {
  baseCurrency: string;
  monthLabel: string;
  daily: DailySpend[];
  isCurrentMonth: boolean;
  elapsedDays: number;
  dailyAverage: number;
  fixedCategories: FixedCategorySummary[];
  scheduledExpense: number;
  trend: SpendingTrend;
}) {
  const theme = useChartTheme();
  const [includeFixed, setIncludeFixed] = useState(false);
  const hasFixed = fixedCategories.length > 0;

  const data: ChartDatum[] = useMemo(
    () =>
      daily.map((d) => ({
        ...d,
        value: includeFixed ? d.expense : d.variable,
      })),
    [daily, includeFixed],
  );

  const todayDay = daily.find((d) => d.isToday)?.day ?? null;
  const lastDay = daily.length;
  const visibleTicks = useMemo(() => {
    const base = [1, 5, 10, 15, 20, 25, lastDay];
    const ticks = new Set(
      todayDay == null
        ? base
        : base.filter((t) => t === 1 || Math.abs(t - todayDay) > 2),
    );
    if (todayDay != null) ticks.add(todayDay);
    return ticks;
  }, [todayDay, lastDay]);

  const spentDays = data.filter((d) => !d.isFuture);
  const plotted = spentDays.reduce((s, d) => s + d.value, 0);
  const peak = spentDays.reduce<ChartDatum | null>(
    (best, d) => (d.value > (best?.value ?? 0) ? d : best),
    null,
  );
  const summary = `Daily ${includeFixed ? "" : "variable "}spending for ${monthLabel}: ${formatMoney(plotted, baseCurrency)} over ${elapsedDays} days${
    peak ? `, highest on ${formatDayHeading(peak.date)} at ${formatMoney(peak.value, baseCurrency)}` : ""
  }.`;

  function renderSlot(props: unknown) {
    const { x = 0, y = 0, width = 0, height = 0, payload } = props as SlotProps;
    if (!payload?.isFuture || payload.value > 0) return <g />;
    return (
      <rect
        x={x + 0.5}
        y={y + 0.5}
        width={Math.max(0, width - 1)}
        height={Math.max(0, height - 1)}
        rx={2}
        fill="none"
        stroke={theme.border}
        strokeDasharray="3 3"
      />
    );
  }

  function renderTick(props: unknown) {
    const { x = 0, y = 0, payload } = props as TickProps;
    const day = payload?.value;
    if (day == null || !visibleTicks.has(day)) return <g />;
    const isToday = day === todayDay;
    return (
      <text
        x={x}
        y={y + 12}
        textAnchor="middle"
        fontSize={10}
        fontWeight={isToday ? 600 : 400}
        fill={isToday ? theme.foreground : theme.mutedForeground}
      >
        {isToday ? "Today" : day}
      </text>
    );
  }

  const prevLabel = formatMonthLong(trend.previousMonth).split(" ")[0];

  return (
    <Card className="flex h-full min-w-0 flex-col">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Daily spending</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {includeFixed ? "All expenses" : "Variable spending only"}
          </p>
        </div>
        <p className="text-right text-sm">
          <span className="font-semibold tabular-nums">
            <Money amount={dailyAverage} currency={baseCurrency} />
          </span>
          <span className="text-muted-foreground">
            {isCurrentMonth ? " / day so far" : " / day"}
          </span>
        </p>
      </div>

      {(hasFixed || scheduledExpense > 0) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {!includeFixed &&
            fixedCategories.map((c) => (
              <span
                key={c.categoryId}
                className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
              >
                {c.name}{" "}
                <Money amount={c.total} currency={baseCurrency} />{" "}
                {formatDayList(c.days)}, shown separately
              </span>
            ))}
          {scheduledExpense > 0 && (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              <Money amount={scheduledExpense} currency={baseCurrency} />{" "}
              scheduled later this month
            </span>
          )}
          {hasFixed && (
            <button
              type="button"
              aria-pressed={includeFixed}
              onClick={() => setIncludeFixed((v) => !v)}
              className={cn(
                "rounded-full border border-border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10",
                includeFixed
                  ? "border-primary/40 bg-primary-light text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              Include fixed
            </button>
          )}
        </div>
      )}

      <div role="figure" aria-label={summary} className="min-w-0">
        <p className="sr-only">{summary}</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={data}
            barCategoryGap={2}
            margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
            accessibilityLayer
          >
            <CartesianGrid vertical={false} stroke={theme.border} />
            <XAxis
              dataKey="day"
              interval={0}
              axisLine={false}
              tickLine={false}
              tick={renderTick}
            />
            <YAxis
              width={44}
              axisLine={false}
              tickLine={false}
              tickCount={4}
              allowDecimals={false}
              tick={{ fontSize: 10, fill: theme.mutedForeground }}
              tickFormatter={(v: number) => formatCompactMoney(v, baseCurrency)}
            />
            <Tooltip
              cursor={{ fill: theme.border, fillOpacity: 0.4 }}
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload as ChartDatum | undefined;
                if (!active || !d) return null;
                return (
                  <div style={tooltipStyle(theme)} className="px-3 py-2 text-xs">
                    <p className="font-medium">{formatDayHeading(d.date)}</p>
                    <p className="mt-0.5 tabular-nums">
                      <Money amount={d.value} currency={baseCurrency} />
                      <span className="text-muted-foreground">
                        {d.isFuture
                          ? d.value > 0
                            ? " scheduled"
                            : " · upcoming"
                          : includeFixed
                            ? " spent"
                            : " variable"}
                      </span>
                    </p>
                    {!includeFixed && d.fixed > 0 && (
                      <p className="mt-0.5 tabular-nums text-muted-foreground">
                        + <Money amount={d.fixed} currency={baseCurrency} /> fixed
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Bar
              dataKey="value"
              name="Spending"
              fill={theme.primary}
              radius={[2, 2, 0, 0]}
              background={renderSlot}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell
                  key={d.day}
                  fill={theme.primary}
                  fillOpacity={d.isToday ? 1 : d.isFuture ? 0.15 : 0.55}
                  stroke={d.isFuture ? theme.primary : undefined}
                  strokeDasharray={d.isFuture ? "3 3" : undefined}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {trend.percent != null && Math.round(trend.percent) !== 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-primary-light/40 px-3 py-2 text-sm text-primary">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            {trend.basis === "to-date" ? "Spending so far is " : "Spending was "}
            <strong>
              {Math.abs(trend.percent).toFixed(0)}%{" "}
              {trend.percent > 0 ? "higher" : "lower"}
            </strong>{" "}
            than {prevLabel}
            {trend.basis === "to-date" ? (
              <>
                {" "}
                at the same point (1–{trend.throughDay} {prevLabel.slice(0, 3)}:{" "}
                <Money amount={trend.previous} currency={baseCurrency} />)
              </>
            ) : (
              <>
                {" "}
                (<Money amount={trend.previous} currency={baseCurrency} />)
              </>
            )}
            .
          </p>
        </div>
      )}
    </Card>
  );
}
