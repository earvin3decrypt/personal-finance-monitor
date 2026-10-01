"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  deleteRecurringItem,
  saveRecurringItem,
} from "@/app/actions/recurring";
import { ForecastChart } from "@/components/charts";
import { Card, StatCard } from "@/components/ui";
import type { ForecastData } from "@/lib/forecast";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Money } from "@/components/money";

type Horizon = 12 | 24 | 60;

const HORIZONS: { months: Horizon; label: string }[] = [
  { months: 12, label: "1Y" },
  { months: 24, label: "2Y" },
  { months: 60, label: "5Y" },
];

function currencySymbol(currency: string, locale = "en-US"): string {
  return (
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? currency
  );
}

export function ForecastView({ data }: { data: ForecastData }) {
  const [horizon, setHorizon] = useState<Horizon>(24);
  const [type, setType] = useState<"expense" | "income">("expense");

  const visiblePoints = useMemo(
    () => data.points.filter((p) => p.month <= horizon),
    [data.points, horizon],
  );

  const projectedValue =
    visiblePoints[visiblePoints.length - 1]?.value ?? data.currentNetWorth;

  const incomeItems = data.items.filter((i) => i.type === "income");
  const expenseItems = data.items.filter((i) => i.type === "expense");

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Current net worth"
          value={formatMoney(data.currentNetWorth, data.baseCurrency)}
        />
        <StatCard
          label="Net monthly"
          value={`${data.netMonthly >= 0 ? "+" : ""}${formatMoney(
            data.netMonthly,
            data.baseCurrency,
          )}`}
          sub={
            <Money>
              {formatMoney(data.monthlyIncome, data.baseCurrency)} in ·{" "}
              {formatMoney(data.monthlyExpense, data.baseCurrency)} out
            </Money>
          }
          className={data.netMonthly >= 0 ? "[&_p:nth-child(2)]:text-gain" : "[&_p:nth-child(2)]:text-loss"}
        />
        <StatCard
          label={`Projected in ${HORIZONS.find((h) => h.months === horizon)?.label ?? ""}`}
          value={formatMoney(projectedValue, data.baseCurrency)}
          sub={
            data.netMonthly !== 0 ? (
              <Money>
                {data.netMonthly >= 0 ? "+" : ""}
                {formatMoney(
                  projectedValue - data.currentNetWorth,
                  data.baseCurrency,
                )}{" "}
                change
              </Money>
            ) : (
              "No recurring items yet"
            )
          }
        />
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Net worth projection
          </h2>
          <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
            {HORIZONS.map(({ months, label }) => (
              <button
                key={months}
                type="button"
                onClick={() => setHorizon(months)}
                aria-pressed={horizon === months}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  horizon === months
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {data.items.length === 0 ? (
          <p className="mb-4 text-sm text-muted-foreground">
            Add recurring monthly incomes and expenses below to see how your net
            worth may evolve.
          </p>
        ) : null}
        <ForecastChart
          data={visiblePoints}
          currency={data.baseCurrency}
          netMonthly={data.netMonthly}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecurringList
          title="Monthly income"
          items={incomeItems}
          baseCurrency={data.baseCurrency}
          emptyMessage="No recurring income yet."
        />
        <RecurringList
          title="Monthly expenses"
          items={expenseItems}
          baseCurrency={data.baseCurrency}
          emptyMessage="No recurring expenses yet."
        />
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold">Add recurring item</h2>
        <form action={saveRecurringItem} className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Type
            </p>
            <div className="flex gap-1 rounded-full bg-muted p-0.5 w-fit">
              <button
                type="button"
                onClick={() => setType("expense")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition",
                  type === "expense"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setType("income")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition",
                  type === "income"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Income
              </button>
            </div>
            <input type="hidden" name="type" value={type} />
          </div>
          <div>
            <label
              htmlFor="recurring-name"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Name
            </label>
            <input
              id="recurring-name"
              name="name"
              placeholder="e.g. Salary, Rent, Netflix"
              required
              className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label
              htmlFor="recurring-amount"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Monthly amount
            </label>
            <div className="flex overflow-hidden rounded-xl border border-border focus-within:ring-2 focus-within:ring-primary/20">
              <span className="flex shrink-0 items-center border-r border-border bg-muted/30 px-3 text-sm tabular-nums text-muted-foreground">
                {currencySymbol(data.baseCurrency)}
              </span>
              <input
                id="recurring-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                required
                className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>
          <input type="hidden" name="currency" value={data.baseCurrency} />
          <button
            type="submit"
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Add recurring item
          </button>
        </form>
      </Card>
    </div>
  );
}

function RecurringList({
  title,
  items,
  baseCurrency,
  emptyMessage,
}: {
  title: string;
  items: ForecastData["items"];
  baseCurrency: string;
  emptyMessage: string;
}) {
  return (
    <Card>
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{item.name}</p>
                <p
                  className={cn(
                    "text-sm tabular-nums",
                    item.type === "income" ? "text-gain" : "text-foreground",
                  )}
                >
                  <Money>
                    {item.type === "income" ? "+" : "−"}
                    {formatMoney(item.amountBase, baseCurrency)}
                    {item.currency !== baseCurrency && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({formatMoney(item.amount, item.currency)})
                      </span>
                    )}
                  </Money>
                </p>
              </div>
              <form action={deleteRecurringItem}>
                <input type="hidden" name="id" value={item.id} />
                <button
                  type="submit"
                  className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-loss"
                  aria-label={`Remove ${item.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
