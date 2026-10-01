"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { formatMoney } from "@/lib/format";
import type { MonthlyHistory } from "@/lib/expense-stats";
import { Money } from "@/components/money";

const EXPENSE_COLOR = "oklch(0.55 0.19 250)";
const INCOME_COLOR = "var(--color-gain)";

type ChartPayload = {
  month?: string;
};

type MonthAxisTickProps = {
  x?: number;
  y?: number;
  index?: number;
  payload?: { value?: string };
  points: { month: string; label: string }[];
  activeMonth?: string;
  onSelect: (month: string) => void;
};

function MonthAxisTick({
  x = 0,
  y = 0,
  index = 0,
  payload,
  points,
  activeMonth,
  onSelect,
}: MonthAxisTickProps) {
  const month = points[index]?.month;
  const isActive = month === activeMonth;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={16}
        textAnchor="end"
        fill={isActive ? "oklch(0.35 0.02 260)" : "oklch(0.52 0.02 260)"}
        fontSize={10}
        fontWeight={isActive ? 600 : 400}
        transform="rotate(-35)"
        style={{ cursor: month ? "pointer" : "default" }}
        onClick={() => month && onSelect(month)}
      >
        {payload?.value ?? ""}
      </text>
    </g>
  );
}

import { useChartTheme, tooltipStyle } from "./charts";

export function MonthlyHistory({
  baseCurrency,
  points,
  totalExpense,
  totalIncome,
  avgExpense,
  selectedMonth,
}: MonthlyHistory & { selectedMonth?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useChartTheme();
  const activeMonth = selectedMonth ?? points[points.length - 1]?.month;

  function handleMonthSelect(month: string) {
    router.push(`${pathname}?month=${month}`, { scroll: false });
  }

  function handleBarClick(data: ChartPayload) {
    if (data?.month) {
      handleMonthSelect(data.month);
    }
  }

  return (
    <section className="mb-10">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground/90">
            Last 12 months
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Expenses
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-gain" />
              Income
            </span>
            <span className="text-muted-foreground/80">
              Click a month to view details
            </span>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <p className="text-muted-foreground">Total expenses</p>
            <p className="font-semibold tabular-nums">
              <Money amount={totalExpense} currency={baseCurrency} />
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Total income</p>
            <p className="font-semibold tabular-nums text-gain">
              <Money>+{formatMoney(totalIncome, baseCurrency)}</Money>
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Avg / month</p>
            <p className="font-semibold tabular-nums">
              <Money amount={avgExpense} currency={baseCurrency} />
            </p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={160}>
          <BarChart
            data={points}
            barCategoryGap="18%"
            margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
          >
            <XAxis
              dataKey="label"
              interval={0}
              angle={-35}
              textAnchor="end"
              height={48}
              axisLine={false}
              tickLine={false}
              tick={(props) => (
                <MonthAxisTick
                  {...props}
                  points={points}
                  activeMonth={activeMonth}
                  onSelect={handleMonthSelect}
                />
              )}
            />
            <Tooltip
              contentStyle={tooltipStyle(theme)}
              itemStyle={{ color: theme.foreground }}
              cursor={{ fill: "transparent" }}
              formatter={(v: number, name: string) => [
                <Money key="v" amount={v} currency={baseCurrency} />,
                name === "expense" ? "Expense" : "Income",
              ]}
              labelFormatter={(_, payload) => {
                const month = payload?.[0]?.payload?.month as string | undefined;
                if (!month) return "";
                const [y, m] = month.split("-");
                const d = new Date(Number(y), Number(m) - 1, 1);
                return new Intl.DateTimeFormat("en-GB", {
                  month: "long",
                  year: "numeric",
                }).format(d);
              }}
            />
            <Bar
              dataKey="expense"
              fill={EXPENSE_COLOR}
              radius={[3, 3, 0, 0]}
              minPointSize={6}
              cursor="pointer"
              onClick={(data) => handleBarClick(data as ChartPayload)}
            >
              {points.map((p) => (
                <Cell
                  key={`expense-${p.month}`}
                  fillOpacity={p.month === activeMonth ? 1 : 0.35}
                />
              ))}
            </Bar>
            <Bar
              dataKey="income"
              fill={INCOME_COLOR}
              radius={[3, 3, 0, 0]}
              minPointSize={6}
              cursor="pointer"
              onClick={(data) => handleBarClick(data as ChartPayload)}
            >
              {points.map((p) => (
                <Cell
                  key={`income-${p.month}`}
                  fillOpacity={p.month === activeMonth ? 1 : 0.35}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
