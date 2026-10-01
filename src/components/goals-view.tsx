"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { Button } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import {
  saveBudget,
  deleteBudget,
  rolloverBudget,
  rolloverAllBudgets,
} from "@/app/actions/budgets";
import { cn } from "@/lib/utils";
import type { CategoryWithChildren } from "@/lib/categories";
import type { BudgetWithSpending } from "@/lib/budgets";
import { Money } from "@/components/money";

type BudgetRow = BudgetWithSpending;

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

function renewLabel(month: string): string {
  const today = new Date();
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  if (month !== current) {
    const [y, m] = month.split("-").map(Number);
    return new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
    }).format(new Date(y, m - 1, 1));
  }
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const daysLeft = lastDay - today.getDate();
  if (daysLeft <= 0) return "Renews today";
  if (daysLeft === 1) return "Renews in 1 day";
  return `Renews in ${daysLeft} days`;
}

export function GoalsView({
  budgets,
  categoryTree,
  defaultCurrency,
  month,
}: {
  budgets: BudgetRow[];
  categoryTree: CategoryWithChildren[];
  defaultCurrency: string;
  month: string;
}) {
  return (
    <BudgetColumn
      budgets={budgets}
      categoryTree={categoryTree}
      defaultCurrency={defaultCurrency}
      month={month}
    />
  );
}

function BudgetColumn({
  budgets,
  categoryTree,
  defaultCurrency,
  month,
}: {
  budgets: BudgetRow[];
  categoryTree: CategoryWithChildren[];
  defaultCurrency: string;
  month: string;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<BudgetRow | null>(null);
  const selected = budgets.find((b) => b.id === selectedId) ?? null;
  const rollableCount = budgets.filter(
    (b) => b.previousLeftover > 0 && !b.previousRolledIn,
  ).length;

  const previousMonthLabel = (() => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return new Intl.DateTimeFormat("en-GB", {
      month: "short",
      year: "numeric",
    }).format(d);
  })();

  useEffect(() => {
    if (selectedId != null && !budgets.some((b) => b.id === selectedId)) {
      setSelectedId(null);
    }
  }, [budgets, selectedId]);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">To spend less</h2>
          <p className="text-sm text-muted-foreground">Set a limit on spending</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {rollableCount > 0 && (
            <form action={rolloverAllBudgets}>
              <input type="hidden" name="targetMonth" value={month} />
              <button
                type="submit"
                className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
              >
                Roll all from {previousMonthLabel} ({rollableCount})
              </button>
            </form>
          )}
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New budget
          </Button>
        </div>
      </header>

      {budgets.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            No budgets yet. Create your first limit to start tracking spending.
          </p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New budget
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            {budgets.map((b) => (
              <BudgetCard
                key={b.id}
                budget={b}
                month={month}
                previousMonthLabel={previousMonthLabel}
                selected={selectedId === b.id}
                onSelect={() =>
                  setSelectedId((current) =>
                    current === b.id ? null : b.id,
                  )
                }
                onEdit={() => setEditBudget(b)}
              />
            ))}
          </div>

          {!selected && budgets.length > 0 && (
            <p className="mb-4 text-center text-sm text-muted-foreground">
              Select a budget to view history and manage it
            </p>
          )}

          {selected && (
            <HistoryCard
              key={selected.id}
              title="History"
              subtitle={`Expenditure for ${selected.name}${selected.parentName ? ` (${selected.parentName})` : ""}`}
              items={selected.history}
              currency={selected.currency}
            />
          )}
        </>
      )}

      {createOpen && (
        <BudgetFormModal
          categoryTree={categoryTree}
          defaultCurrency={defaultCurrency}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {editBudget && (
        <BudgetFormModal
          budget={editBudget}
          categoryTree={categoryTree}
          defaultCurrency={defaultCurrency}
          onClose={() => setEditBudget(null)}
        />
      )}
    </div>
  );
}

const HISTORY_PREVIEW_COUNT = 3;

function BudgetCard({
  budget,
  month,
  previousMonthLabel,
  selected,
  onSelect,
  onEdit,
}: {
  budget: BudgetRow;
  month: string;
  previousMonthLabel: string;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const percent = Math.round(budget.percent);
  const overBudget = budget.spent > budget.limit;
  const progressWidth = Math.min(100, budget.percent);
  const hasPendingRollover =
    budget.previousLeftover > 0 && !budget.previousRolledIn;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card shadow-sm transition",
        selected
          ? "border-primary/50 ring-2 ring-primary/20"
          : "border-border hover:border-primary/30",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        className="cursor-pointer p-5 outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <div className="mb-4 flex items-start gap-3">
          <CategoryIcon icon={budget.icon} color={budget.color} size={16} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{budget.name}</p>
                {budget.parentName && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {budget.parentName}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                    overBudget
                      ? "bg-loss/15 text-loss"
                      : "bg-gain/15 text-gain",
                  )}
                >
                  {percent}% used
                </span>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition",
                    selected && "text-primary",
                  )}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <p className="text-2xl font-bold tabular-nums tracking-tight">
            <Money amount={budget.spent} currency={budget.currency} />
            <span className="ml-1.5 text-sm font-medium text-muted-foreground">
              <Money>
                of {formatMoney(budget.limit, budget.currency)}
              </Money>
            </span>
          </p>
          <p
            className={cn(
              "shrink-0 text-sm font-medium tabular-nums",
              overBudget
                ? "text-loss"
                : budget.leftover > 0
                  ? "text-gain"
                  : "text-muted-foreground",
            )}
          >
            {overBudget ? (
              <Money>
                {formatMoney(budget.spent - budget.limit, budget.currency)} over
              </Money>
            ) : (
              <Money>
                {formatMoney(budget.leftover, budget.currency)} left
              </Money>
            )}
          </p>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progressWidth}%`,
              backgroundColor: overBudget ? "var(--loss)" : budget.color,
            }}
          />
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {budget.carriedIn > 0 ? (
              <Money>
                {formatMoney(budget.carriedIn, budget.currency)} carried over
              </Money>
            ) : (
              <Money>
                Base {formatMoney(budget.baseLimit, budget.currency)}
              </Money>
            )}
          </span>
          <span className="shrink-0">{renewLabel(month)}</span>
        </div>

        {!selected && hasPendingRollover && (
          <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
            Leftover from last month available to roll in
          </p>
        )}
      </div>

      {selected && (
        <div className="space-y-3 border-t border-border px-5 pb-5 pt-3">
          {budget.previousRolledIn ? (
            <p className="text-xs text-muted-foreground">
              Leftover from {previousMonthLabel} already rolled into this month
              {budget.carriedIn > 0 ? (
                <Money>
                  {" "}
                  ({formatMoney(budget.carriedIn, budget.currency)})
                </Money>
              ) : null}
              .
            </p>
          ) : budget.previousLeftover > 0 ? (
            <form action={rolloverBudget}>
              <input type="hidden" name="id" value={budget.id} />
              <input type="hidden" name="targetMonth" value={month} />
              <button
                type="submit"
                className="w-full rounded-xl bg-primary py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Roll leftover from {previousMonthLabel} (
                <Money
                  amount={budget.previousLeftover}
                  currency={budget.currency}
                />
                )
              </button>
            </form>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit budget
            </button>
            <form action={deleteBudget}>
              <input type="hidden" name="id" value={budget.id} />
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-loss transition hover:bg-loss/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete budget
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryCard({
  title,
  subtitle,
  items,
  currency,
}: {
  title: string;
  subtitle: string;
  items: { amount: number; date: string; time: string }[];
  currency: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = items.length > HISTORY_PREVIEW_COUNT;
  const visible = expanded ? items : items.slice(0, HISTORY_PREVIEW_COUNT);
  const hiddenCount = items.length - HISTORY_PREVIEW_COUNT;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{subtitle}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No entries yet.</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {visible.map((item, i) => (
              <li
                key={i}
                className="flex items-center justify-between py-3 first:pt-0"
              >
                <div>
                  <p className="font-semibold tabular-nums">
                    <Money amount={item.amount} currency={currency} />
                  </p>
                  <p className="text-sm text-muted-foreground">{item.date}</p>
                </div>
                <p className="text-sm text-muted-foreground">{item.time}</p>
              </li>
            ))}
          </ul>
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 w-full rounded-xl py-2 text-sm font-medium text-primary transition hover:bg-muted/60"
            >
              {expanded
                ? "Show less"
                : `Show ${hiddenCount} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ModalShell({
  children,
  onClose,
  labelledBy,
}: {
  children: React.ReactNode;
  onClose: () => void;
  labelledBy: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        {children}
      </div>
    </div>
  );
}

function BudgetFormModal({
  budget,
  categoryTree,
  defaultCurrency,
  onClose,
}: {
  budget?: BudgetRow;
  categoryTree: CategoryWithChildren[];
  defaultCurrency: string;
  onClose: () => void;
}) {
  const isEditing = budget != null;
  const titleId = useId();
  const currency = budget?.budgetCurrency ?? defaultCurrency;
  const symbol = currencySymbol(currency);
  const [pending, startTransition] = useTransition();
  const [parentId, setParentId] = useState<number>(
    budget?.categoryId ?? categoryTree[0]?.id ?? 0,
  );
  const [subcategoryId, setSubcategoryId] = useState(
    budget?.subcategoryId != null ? String(budget.subcategoryId) : "",
  );
  const selectedParent = categoryTree.find((c) => c.id === parentId);
  const subcategories = selectedParent?.children ?? [];

  function handleParentChange(id: number) {
    setParentId(id);
    setSubcategoryId("");
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await saveBudget(formData);
      onClose();
    });
  }

  return (
    <ModalShell onClose={onClose} labelledBy={titleId}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {isEditing ? "Edit budget" : "New budget"}
          </p>
          <h2 id={titleId} className="mt-1 text-xl font-semibold">
            {isEditing ? "Update spending limit" : "Set a spending limit"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form action={handleSubmit} className="space-y-4">
        {isEditing && (
          <input type="hidden" name="id" value={budget.id} />
        )}
        <input type="hidden" name="currency" value={currency} />
        {isEditing && (
          <input type="hidden" name="startDate" value={budget.startDate} />
        )}

        <div>
          <label
            htmlFor="budget-form-category"
            className="mb-1.5 block text-sm font-medium"
          >
            Category
          </label>
          <select
            id="budget-form-category"
            name="categoryId"
            required
            value={parentId || ""}
            onChange={(e) => handleParentChange(Number(e.target.value))}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          >
            {categoryTree.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="budget-form-subcategory"
            className="mb-1.5 block text-sm font-medium"
          >
            Subcategory{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <select
            id="budget-form-subcategory"
            name="subcategoryId"
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Whole category</option>
            {subcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="budget-form-amount"
            className="mb-1.5 block text-sm font-medium"
          >
            Limit amount
          </label>
          <div className="flex overflow-hidden rounded-xl border border-border focus-within:ring-2 focus-within:ring-primary/20">
            <span className="flex shrink-0 items-center border-r border-border bg-muted/40 px-3 text-sm tabular-nums text-muted-foreground">
              {symbol}
            </span>
            <input
              id="budget-form-amount"
              name="limitAmount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              required
              defaultValue={budget?.limitAmount}
              className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending
            ? isEditing
              ? "Saving…"
              : "Creating…"
            : isEditing
              ? "Save changes"
              : "Create budget"}
        </button>
      </form>
    </ModalShell>
  );
}
