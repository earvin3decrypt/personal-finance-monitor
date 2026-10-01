"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Label,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { formatCompactMoney, formatMoney } from "@/lib/format";
import {
  allocateRoundedPercents,
  type ChartRange,
  countPointsInRange,
  filterMultiSeriesForRange,
  filterSeriesForRange,
  formatChartXTick,
  pickBestChartRange,
  pickChartXTicks,
  yAxisDomain,
} from "@/lib/chart-data";
import { Money } from "@/components/money";

const DISPLAY_RANGES: ChartRange[] = ["1M", "3M", "6M", "1Y"];

export function useChartTheme() {
  const [theme, setTheme] = useState({
    mutedForeground: "oklch(0.52 0.02 260)",
    border: "oklch(0.91 0.01 250)",
    card: "oklch(1 0 0)",
    foreground: "oklch(0.22 0.02 260)",
    primary: "oklch(0.55 0.19 250)",
    loss: "oklch(0.55 0.18 25)",
  });

  useEffect(() => {
    function read() {
      const s = getComputedStyle(document.documentElement);
      setTheme({
        mutedForeground:
          s.getPropertyValue("--muted-foreground").trim() ||
          "oklch(0.52 0.02 260)",
        border: s.getPropertyValue("--border").trim() || "oklch(0.91 0.01 250)",
        card: s.getPropertyValue("--card").trim() || "oklch(1 0 0)",
        foreground:
          s.getPropertyValue("--foreground").trim() || "oklch(0.22 0.02 260)",
        primary: s.getPropertyValue("--primary").trim() || "oklch(0.55 0.19 250)",
        loss: s.getPropertyValue("--loss").trim() || "oklch(0.55 0.18 25)",
      });
    }
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}

export function tooltipStyle(theme: ReturnType<typeof useChartTheme>) {
  return {
    borderRadius: "0.75rem",
    border: `1px solid ${theme.border}`,
    background: theme.card,
    color: theme.foreground,
    boxShadow: "0 4px 12px oklch(0 0 0 / 0.12)",
  };
}

function ChartRangeToggle({
  range,
  setRange,
  rangeCounts,
  className,
}: {
  range: ChartRange;
  setRange: (r: ChartRange) => void;
  rangeCounts: Record<ChartRange, number>;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-1 rounded-lg bg-muted/50 p-1 ${className ?? ""}`}
    >
      {DISPLAY_RANGES.map((r) => {
        const disabled = rangeCounts[r] < 2;
        return (
          <button
            key={r}
            type="button"
            onClick={() => !disabled && setRange(r)}
            disabled={disabled}
            aria-pressed={range === r}
            aria-disabled={disabled}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              disabled
                ? "cursor-not-allowed text-muted-foreground/40"
                : range === r
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {r}
          </button>
        );
      })}
    </div>
  );
}

type SeriesPoint = { date: string; total: number };

function EvolutionAreaChart({
  title,
  titleClassName = "text-sm font-medium text-muted-foreground",
  data,
  currency,
  gradientId,
  strokeColor,
  tooltipLabel,
}: {
  title: string;
  titleClassName?: string;
  data: SeriesPoint[];
  currency: string;
  gradientId: string;
  strokeColor: string;
  tooltipLabel: string;
}) {
  const theme = useChartTheme();
  const [range, setRange] = useState<ChartRange>(() => pickBestChartRange(data));

  const rangeCounts = useMemo(() => {
    const counts = {} as Record<ChartRange, number>;
    for (const r of DISPLAY_RANGES) {
      counts[r] = countPointsInRange(data, r);
    }
    return counts;
  }, [data]);

  useEffect(() => {
    if (rangeCounts[range] < 2) {
      setRange(pickBestChartRange(data));
    }
  }, [data, range, rangeCounts]);

  const filtered = useMemo(
    () => filterSeriesForRange(data, range),
    [data, range],
  );

  const totals = filtered.map((d) => d.total);
  const domain = yAxisDomain(totals);
  const singlePoint = filtered.length === 1;
  const xDates = filtered.map((d) => d.date);
  const xTicks = pickChartXTicks(xDates);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className={titleClassName}>{title}</h2>
        <ChartRangeToggle
          range={range}
          setRange={setRange}
          rangeCounts={rangeCounts}
        />
      </div>
      <div className="blur-amount">
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart
            data={filtered}
            margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              height={44}
              tickMargin={14}
              padding={{ left: 8, right: 20 }}
              minTickGap={48}
              interval={xTicks ? 0 : "preserveStartEnd"}
              ticks={xTicks}
              tick={{
                fontSize: 12,
                fill: theme.mutedForeground,
                dy: 4,
              }}
              tickFormatter={(v) => formatChartXTick(String(v), xDates)}
              axisLine={{ stroke: theme.border }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: theme.mutedForeground }}
              width={72}
              domain={domain}
              tickCount={4}
              tickMargin={6}
              tickFormatter={(v) => formatCompactMoney(Number(v), currency)}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle(theme)}
              wrapperClassName="blur-amount"
              formatter={(value: number) => [
                formatMoney(value, currency),
                tooltipLabel,
              ]}
              labelFormatter={(label) => {
                const parts = String(label).split("-");
                if (parts.length === 3) {
                  const [year, month, day] = parts;
                  return `${day}/${month}/${year}`;
                }
                return label;
              }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke={strokeColor}
              strokeWidth={2.5}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
              dot={
                singlePoint
                  ? {
                      r: 5,
                      fill: strokeColor,
                      strokeWidth: 2,
                      stroke: theme.card,
                    }
                  : false
              }
              activeDot={{
                r: 6,
                strokeWidth: 2,
                stroke: theme.card,
                fill: strokeColor,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

const BREAKDOWN_COLORS: Record<string, string> = {
  Cash: "oklch(0.58 0.14 165)",
  Investments: "oklch(0.72 0.12 300)",
  Crypto: "oklch(0.72 0.16 75)",
};

type ChartProps = {
  data: { date: string; total: number }[];
  currency: string;
};

type NetWorthChartProps = {
  data: { date: string; total: number; cash: number; investments: number; crypto: number }[];
  currency: string;
};

function ChartEmptyState({
  title,
  titleClassName,
  message,
}: {
  title: string;
  titleClassName?: string;
  message: string;
}) {
  return (
    <>
      <div className="mb-4">
        <h2 className={titleClassName ?? "text-sm font-medium text-muted-foreground"}>
          {title}
        </h2>
      </div>
      <p className="py-12 text-center text-sm text-muted-foreground">{message}</p>
    </>
  );
}

export function NetWorthChart({
  data,
  currency,
  title = "Net worth over time",
}: NetWorthChartProps & { title?: string }) {
  const theme = useChartTheme();
  const [range, setRange] = useState<ChartRange>(() => pickBestChartRange(data));
  const [visible, setVisible] = useState({
    total: true,
    cash: false,
    investments: false,
    crypto: false,
  });

  const rangeCounts = useMemo(() => {
    const counts = {} as Record<ChartRange, number>;
    for (const r of DISPLAY_RANGES) {
      counts[r] = countPointsInRange(data, r);
    }
    return counts;
  }, [data]);

  useEffect(() => {
    if (rangeCounts[range] < 2) {
      setRange(pickBestChartRange(data));
    }
  }, [data, range, rangeCounts]);

  const filtered = useMemo(
    () => filterMultiSeriesForRange(data, range),
    [data, range],
  );

  const toggleLine = (key: keyof typeof visible) => {
    setVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const anyVisible = Object.values(next).some(Boolean);
      return anyVisible ? next : prev;
    });
  };

  const visibleValues = useMemo(() => {
    const values: number[] = [];
    for (const d of filtered) {
      if (visible.total) values.push(d.total);
      if (visible.cash) values.push(d.cash);
      if (visible.investments) values.push(d.investments);
      if (visible.crypto) values.push(d.crypto);
    }
    return values;
  }, [filtered, visible]);

  const domain = yAxisDomain(
    visibleValues.length > 0 ? visibleValues : filtered.map((d) => d.total),
  );
  const singlePoint = filtered.length === 1;
  const xDates = filtered.map((d) => d.date);
  const xTicks = pickChartXTicks(xDates);

  if (data.length === 0) {
    return (
      <ChartEmptyState
        title={title}
        message="No snapshot history yet. Your current net worth will appear after the first visit."
      />
    );
  }

  const labels = { total: "Net worth", cash: "Cash", investments: "Investments", crypto: "Crypto" };
  const colors = {
    total: theme.primary,
    cash: BREAKDOWN_COLORS.Cash,
    investments: BREAKDOWN_COLORS.Investments,
    crypto: BREAKDOWN_COLORS.Crypto,
  };

  const seriesLayers: {
    key: keyof typeof visible;
    dataKey: keyof NetWorthChartProps["data"][number];
    name: string;
    gradientId: string;
  }[] = [
    { key: "total", dataKey: "total", name: "Net worth", gradientId: "colorNetWorth" },
    { key: "investments", dataKey: "investments", name: "Investments", gradientId: "colorInvestments" },
    { key: "crypto", dataKey: "crypto", name: "Crypto", gradientId: "colorCrypto" },
    { key: "cash", dataKey: "cash", name: "Cash", gradientId: "colorCash" },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(visible) as Array<keyof typeof visible>).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleLine(key)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                visible[key]
                  ? "bg-muted text-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: colors[key] }}
              />
              {labels[key]}
            </button>
          ))}
        </div>
      </div>
      <div className="blur-amount">
      <ResponsiveContainer width="100%" height={340}>
        <AreaChart
          data={filtered}
          margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.total} stopOpacity={0.3} />
              <stop offset="95%" stopColor={colors.total} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.cash} stopOpacity={0.3} />
              <stop offset="95%" stopColor={colors.cash} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorInvestments" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.investments} stopOpacity={0.3} />
              <stop offset="95%" stopColor={colors.investments} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorCrypto" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.crypto} stopOpacity={0.3} />
              <stop offset="95%" stopColor={colors.crypto} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            height={44}
            tickMargin={14}
            padding={{ left: 8, right: 20 }}
            minTickGap={48}
            interval={xTicks ? 0 : "preserveStartEnd"}
            ticks={xTicks}
            tick={{
              fontSize: 12,
              fill: theme.mutedForeground,
              dy: 4,
            }}
            tickFormatter={(v) => formatChartXTick(String(v), xDates)}
            axisLine={{ stroke: theme.border }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: theme.mutedForeground }}
            width={72}
            domain={domain}
            tickCount={4}
            tickMargin={6}
            tickFormatter={(v) => formatCompactMoney(Number(v), currency)}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle(theme)}
            itemStyle={{ color: theme.foreground }}
            wrapperClassName="blur-amount"
            formatter={(value: number, name: string) => [
              formatMoney(value, currency),
              name,
            ]}
            labelFormatter={(label) => {
              const parts = String(label).split("-");
              if (parts.length === 3) {
                const [year, month, day] = parts;
                return `${day}/${month}/${year}`;
              }
              return label;
            }}
          />
          {seriesLayers.map(({ key, dataKey, name, gradientId }) => {
            if (!visible[key]) return null;
            const stroke = colors[key];
            return (
              <Area
                key={dataKey}
                type="monotoneX"
                dataKey={dataKey}
                name={name}
                stroke={stroke}
                strokeWidth={2.5}
                fillOpacity={1}
                fill={`url(#${gradientId})`}
                dot={
                  singlePoint
                    ? { r: 5, fill: stroke, strokeWidth: 2, stroke: theme.card }
                    : false
                }
                activeDot={{
                  r: 6,
                  strokeWidth: 2,
                  stroke: theme.card,
                  fill: stroke,
                }}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
      </div>
      <div className="mt-3 flex justify-start">
        <ChartRangeToggle
          range={range}
          setRange={setRange}
          rangeCounts={rangeCounts}
        />
      </div>
    </>
  );
}

export function ForecastChart({
  data,
  currency,
  netMonthly,
}: {
  data: { label: string; value: number }[];
  currency: string;
  netMonthly: number;
}) {
  const theme = useChartTheme();
  const strokeColor = netMonthly >= 0 ? theme.primary : theme.loss;
  const values = data.map((d) => d.value);
  const domain = yAxisDomain(values.length > 0 ? values : [0]);
  const xTicks =
    data.length <= 8
      ? data.map((d) => d.label)
      : data
          .filter(
            (_, i) =>
              i === 0 ||
              i === data.length - 1 ||
              i === Math.floor(data.length / 2),
          )
          .map((d) => d.label);

  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No projection data available.
      </p>
    );
  }

  return (
    <div className="blur-amount">
      <ResponsiveContainer width="100%" height={340}>
        <AreaChart
          data={data}
          margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            height={44}
            tickMargin={14}
            padding={{ left: 8, right: 20 }}
            minTickGap={48}
            interval={0}
            ticks={xTicks}
            tick={{
              fontSize: 12,
              fill: theme.mutedForeground,
              dy: 4,
            }}
            axisLine={{ stroke: theme.border }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: theme.mutedForeground }}
            width={72}
            domain={domain}
            tickCount={4}
            tickMargin={6}
            tickFormatter={(v) => formatCompactMoney(Number(v), currency)}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle(theme)}
            itemStyle={{ color: theme.foreground }}
            wrapperClassName="blur-amount"
            formatter={(value: number, name: string) => [
              formatMoney(value, currency),
              name,
            ]}
            labelFormatter={(label) => String(label)}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorForecast)"
            dot={
              data.length === 1
                ? {
                    r: 5,
                    fill: strokeColor,
                    strokeWidth: 2,
                    stroke: theme.card,
                  }
                : false
            }
            activeDot={{
              r: 6,
              strokeWidth: 2,
              stroke: theme.card,
              fill: strokeColor,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function InvestmentsChart({ data, currency }: ChartProps) {
  if (data.length === 0) {
    return (
      <ChartEmptyState
        title="Investments evolution"
        titleClassName="text-sm font-medium text-foreground"
        message="No snapshot history yet. Your current investments value will appear after the first visit."
      />
    );
  }

  return (
    <EvolutionAreaChart
      title="Investments evolution"
      titleClassName="text-sm font-medium text-foreground"
      data={data}
      currency={currency}
      gradientId="colorInvestments"
      strokeColor="oklch(0.6 0.15 145)"
      tooltipLabel="Investments"
    />
  );
}

export function CryptoChart({ data, currency }: ChartProps) {
  if (data.length === 0 || data.every((d) => d.total === 0)) {
    return (
      <ChartEmptyState
        title="Crypto evolution"
        titleClassName="text-sm font-medium text-foreground"
        message="No snapshot history yet. Your current crypto value will appear after the first visit."
      />
    );
  }

  return (
    <EvolutionAreaChart
      title="Crypto evolution"
      titleClassName="text-sm font-medium text-foreground"
      data={data}
      currency={currency}
      gradientId="colorCrypto"
      strokeColor="oklch(0.72 0.16 75)"
      tooltipLabel="Crypto"
    />
  );
}

type BreakdownDonutProps = {
  data: { name: string; value: number }[];
  currency: string;
};

function DonutCenterLabel({
  viewBox,
  total,
  currency,
  mutedFill,
}: {
  viewBox?: { cx?: number; cy?: number };
  total: number;
  currency: string;
  mutedFill: string;
}) {
  const cx = viewBox?.cx ?? 0;
  const cy = viewBox?.cy ?? 0;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan
        x={cx}
        y={cy - 6}
        className="blur-amount fill-foreground text-lg font-semibold"
        style={{ fontSize: "1.125rem", fontWeight: 600 }}
      >
        {formatMoney(total, currency)}
      </tspan>
      <tspan
        x={cx}
        y={cy + 16}
        className="fill-muted-foreground"
        style={{ fontSize: "0.75rem", fill: mutedFill }}
      >
        Total assets
      </tspan>
    </text>
  );
}

export function BreakdownDonut({ data, currency }: BreakdownDonutProps) {
  const theme = useChartTheme();
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total <= 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No assets to display.
      </p>
    );
  }

  const percents = allocateRoundedPercents(data.map((d) => d.value));
  const enriched = data
    .map((d, i) => ({
      ...d,
      percent: percents[i] ?? 0,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="flex flex-col items-center">
      <div className="blur-amount w-full">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={enriched}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={96}
              paddingAngle={3}
              stroke={theme.card}
              strokeWidth={3}
            >
              {enriched.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={BREAKDOWN_COLORS[entry.name] ?? "oklch(0.65 0.1 250)"}
                />
              ))}
              <Label
                content={(props) => (
                  <DonutCenterLabel
                    viewBox={props.viewBox as { cx?: number; cy?: number }}
                    total={total}
                    currency={currency}
                    mutedFill={theme.mutedForeground}
                  />
                )}
                position="center"
              />
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle(theme)}
              itemStyle={{ color: theme.foreground }}
              wrapperClassName="blur-amount"
              formatter={(value: number, name: string) => [
                formatMoney(value, currency),
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-8 w-full max-w-xs space-y-2">
        {enriched.map((entry) => (
          <li
            key={entry.name}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    BREAKDOWN_COLORS[entry.name] ?? "oklch(0.65 0.1 250)",
                }}
              />
              <span className="font-medium">{entry.name}</span>
            </span>
            <span className="tabular-nums text-muted-foreground">
              <Money>
                {formatMoney(entry.value, currency)}
                <span className="ml-1.5 text-xs">({entry.percent}%)</span>
              </Money>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ExpensesByCategoryChart({
  data,
  categories,
}: {
  data: Record<string, Record<string, number>>;
  categories: { id: number; name: string; color: string }[];
}) {
  const theme = useChartTheme();
  const months = Object.keys(data).sort();
  if (months.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No expenses for this period.
      </p>
    );
  }

  const chartData = months.map((month) => {
    const row: Record<string, string | number> = { month };
    for (const cat of categories) {
      row[cat.name] = data[month]?.[cat.name] ?? 0;
    }
    return row;
  });

  return (
    <div className="blur-amount">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: theme.mutedForeground }}
            axisLine={{ stroke: theme.border }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: theme.mutedForeground }}
            width={60}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "0.75rem",
              border: `1px solid ${theme.border}`,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              backgroundColor: theme.card,
              color: theme.foreground,
            }}
            itemStyle={{ color: theme.foreground }}
            wrapperClassName="blur-amount"
            cursor={{ fill: "transparent" }}
          />
          <Legend wrapperStyle={{ color: theme.foreground }} />
          {categories.map((cat) => (
            <Bar
              key={cat.id}
              dataKey={cat.name}
              stackId="a"
              fill={cat.color}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
