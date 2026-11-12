"use client";

import { useMemo, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteDividend, saveDividend } from "@/app/actions/dividends";
import type { DividendWithMetrics } from "@/lib/portfolio";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { formatMoney, localTodayISO } from "@/lib/format";
import { Button, Input, Label, Select } from "@/components/ui";
import { Money } from "@/components/money";

function parseLocalDate(date: string): Date {
  return new Date(`${date.slice(0, 10)}T00:00:00`);
}

function dateParts(date: string): { day: string; month: string; year: string } {
  const d = parseLocalDate(date);
  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: new Intl.DateTimeFormat("en-GB", { month: "short" })
      .format(d)
      .toUpperCase(),
    year: String(d.getFullYear()),
  };
}

export function DividendsBoard({
  dividends,
  baseCurrency,
  dividendsTotalBase,
}: {
  dividends: DividendWithMetrics[];
  baseCurrency: string;
  dividendsTotalBase: number;
}) {
  const [pending, startTransition] = useTransition();

  const sorted = useMemo(
    () => [...dividends].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    [dividends],
  );

  function handleAdd(formData: FormData) {
    startTransition(async () => {
      await saveDividend(formData);
    });
  }

  function handleDelete(formData: FormData) {
    if (!confirm("Delete this dividend?")) return;
    startTransition(async () => {
      await deleteDividend(formData);
    });
  }

  return (
    <div>
      <div className="mb-6 min-w-0">
        <p className="text-sm text-muted-foreground">Dividends</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
          <Money amount={dividendsTotalBase} currency={baseCurrency} />
        </p>
      </div>

      <form
        action={handleAdd}
        className="mb-6 flex flex-col gap-3 border-b border-border pb-6 lg:flex-row lg:items-end"
      >
        <div className="flex min-w-0 flex-1 gap-2">
          <div className="min-w-0 flex-[1.4]">
            <Label htmlFor="div-amount" className="sr-only">
              Amount
            </Label>
            <Input
              id="div-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="42.50"
            />
          </div>
          <div className="w-[5.25rem] shrink-0">
            <Label htmlFor="div-currency" className="sr-only">
              Currency
            </Label>
            <Select
              id="div-currency"
              name="currency"
              defaultValue={baseCurrency}
              aria-label="Currency"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <Label htmlFor="div-date" className="sr-only">
            Payment date
          </Label>
          <Input
            id="div-date"
            name="date"
            type="date"
            required
            defaultValue={localTodayISO()}
          />
        </div>

        <div className="min-w-0 flex-[1.4]">
          <Label htmlFor="div-description" className="sr-only">
            Note
          </Label>
          <Input
            id="div-description"
            name="description"
            placeholder="ETF distributions"
          />
        </div>

        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? "Adding…" : "Add dividend"}
        </Button>
      </form>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No dividends recorded yet.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {sorted.map((d) => {
            const parts = dateParts(d.date);
            return (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-muted/60">
                    <span className="text-sm font-semibold tabular-nums leading-none">
                      {parts.day}
                    </span>
                    <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {parts.month}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {d.description?.trim() || "Dividend"}
                    </p>
                    <p className="text-xs text-muted-foreground">{parts.year}</p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <p className="font-medium tabular-nums text-gain">
                    <Money>
                      +{formatMoney(d.amountBase, baseCurrency)}
                    </Money>
                  </p>
                  <form action={handleDelete}>
                    <input type="hidden" name="id" value={d.id} />
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-loss disabled:opacity-50"
                      aria-label="Delete dividend"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
