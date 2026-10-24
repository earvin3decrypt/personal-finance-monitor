"use client";

import {
  CategoryIcon,
  resolveCategoryIcon,
  safeHexColor,
} from "@/components/category-icon";
import { useExpenseFilters } from "@/components/expense-filter-context";
import { Card } from "@/components/ui";
import { Money } from "@/components/money";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CategoryBreakdown } from "@/lib/expense-stats";

/** Same template on every row so the bar tracks line up. */
const ROW_GRID =
  "grid grid-cols-[2.25rem_minmax(0,7rem)_minmax(0,1fr)_5.75rem] items-center gap-x-3 sm:grid-cols-[2.25rem_minmax(0,8.5rem)_minmax(0,1fr)_6rem]";

function FixedBadge() {
  return (
    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      Fixed
    </span>
  );
}

export function ExpenseCategoryBreakdown({
  baseCurrency,
  breakdown,
  totalExpense,
}: {
  baseCurrency: string;
  breakdown: CategoryBreakdown[];
  totalExpense: number;
}) {
  const { categoryId: activeId, setCategoryId } = useExpenseFilters();
  const active = breakdown.find((c) => c.categoryId === activeId) ?? null;

  return (
    <Card className="flex h-full min-w-0 flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Where it went</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Select a category to filter activity
          </p>
        </div>
        {active && (
          <button
            type="button"
            onClick={() => setCategoryId(null)}
            className="rounded-md text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
          >
            Clear filter
          </button>
        )}
      </div>

      {breakdown.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No expenses for this month.
        </p>
      ) : (
        <>
          <ul className="-mx-2 space-y-1">
            {breakdown.map((cat) => {
              const selected = cat.categoryId === activeId;
              const hasBudget = cat.budgetLimit != null && cat.budgetLimit > 0;
              const overspent = hasBudget && (cat.budgetPercent ?? 0) > 100;
              return (
                <li key={cat.categoryId}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setCategoryId(selected ? null : cat.categoryId)}
                    className={cn(
                      ROW_GRID,
                      "w-full rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10",
                      selected && "bg-primary-light/40 hover:bg-primary-light/40",
                    )}
                  >
                    <CategoryIcon
                      icon={resolveCategoryIcon(cat.icon, cat.name)}
                      color={cat.color}
                      size={16}
                    />
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                          {cat.name}
                        </span>
                        {cat.isFixed && <FixedBadge />}
                      </span>
                      <span
                        className={cn(
                          "block truncate text-xs tabular-nums",
                          overspent ? "font-medium text-loss" : "text-muted-foreground",
                        )}
                      >
                        {cat.percent > 0 && cat.percent < 1
                          ? "<1"
                          : cat.percent.toFixed(0)}
                        %
                        {hasBudget &&
                          ` · ${(cat.budgetPercent ?? 0).toFixed(0)}% of budget`}
                      </span>
                    </span>
                    <span
                      className="h-2 overflow-hidden rounded-full bg-muted"
                      aria-hidden
                    >
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, cat.percent))}%`,
                          backgroundColor: safeHexColor(cat.color),
                        }}
                      />
                    </span>
                    <span className="text-right text-sm font-medium tabular-nums">
                      <Money amount={cat.total} currency={baseCurrency} />
                    </span>
                  </button>

                  {selected && cat.subcategories.length > 0 && (
                    <ul className="mb-2 ml-[3.25rem] mr-2 mt-1 space-y-1.5 border-l border-border pl-3 text-xs text-muted-foreground">
                      {cat.subcategories.map((sub) => {
                        const subHasBudget =
                          sub.budgetLimit != null && sub.budgetLimit > 0;
                        const subOverspent =
                          subHasBudget && (sub.budgetPercent ?? 0) > 100;
                        return (
                          <li key={sub.id} className="flex justify-between gap-3">
                            <span className="truncate">{sub.name}</span>
                            <span
                              className={cn(
                                "shrink-0 tabular-nums",
                                subOverspent ? "font-medium text-loss" : "text-foreground",
                              )}
                            >
                              <Money amount={sub.total} currency={baseCurrency} />
                              {subHasBudget && (
                                <span className="text-muted-foreground">
                                  <Money>
                                    {" "}
                                    / {formatMoney(sub.budgetLimit!, baseCurrency)}
                                  </Money>
                                </span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold tabular-nums">
              <Money amount={totalExpense} currency={baseCurrency} />
            </span>
          </div>
          {active && (
            <a
              href="#activity"
              className="mt-2 self-end rounded-md text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
            >
              View {active.name} in activity
            </a>
          )}
        </>
      )}
    </Card>
  );
}
