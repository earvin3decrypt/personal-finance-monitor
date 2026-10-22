"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { ChevronDown, Pencil, Search } from "lucide-react";
import { searchExpensesAction } from "@/app/actions/expenses";
import { CategoryIcon, resolveCategoryIcon } from "@/components/category-icon";
import { ExpenseEditModal } from "@/components/expense-edit-modal";
import { useExpenseFilters } from "@/components/expense-filter-context";
import { Button, Input, Label, Select } from "@/components/ui";
import { Money } from "@/components/money";
import {
  displayTransactionTitle,
  formatDayHeading,
  formatMoney,
} from "@/lib/format";
import type { CategoryWithChildren } from "@/lib/categories";
import type { ExpenseOperation } from "@/lib/expense-stats";
import { cn } from "@/lib/utils";

const RECENT_LIMIT = 6;

type AccountOption = { id: number; name: string; currency: string };

export function OperationsList({
  initialOperations,
  categories,
  accounts,
  monthLabel,
  today,
}: {
  initialOperations: ExpenseOperation[];
  categories: CategoryWithChildren[];
  accounts: AccountOption[];
  monthLabel: string;
  today: string;
}) {
  const ids = useId();
  const { categoryId, accountId, setCategoryId, setAccountId } =
    useExpenseFilters();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ExpenseOperation[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [editingOperation, setEditingOperation] =
    useState<ExpenseOperation | null>(null);
  const [pending, startTransition] = useTransition();

  const isSearching = query.trim().length > 0;

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        const rows = await searchExpensesAction(trimmed);
        setSearchResults(rows);
        setHasSearched(true);
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const parentOf = useMemo(() => {
    const map = new Map<number, number>();
    for (const c of categories) {
      map.set(c.id, c.id);
      for (const child of c.children) map.set(child.id, c.id);
    }
    return map;
  }, [categories]);

  const source = isSearching ? searchResults : initialOperations;
  const filtered = source.filter(
    (op) =>
      (categoryId == null ||
        (parentOf.get(op.categoryId) ?? op.categoryId) === categoryId) &&
      (accountId == null || op.accountId === accountId),
  );
  const visible = showAll ? filtered : filtered.slice(0, RECENT_LIMIT);
  const hasMore = filtered.length > RECENT_LIMIT;
  const groups = groupByDay(visible);
  const currentYear = today.slice(0, 4);
  const filtersActive = categoryId != null || accountId != null;

  return (
    <>
      <section
        id="activity"
        aria-labelledby={`${ids}-title`}
        className="scroll-mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-16px_rgb(0_0_0/0.1)] [border-width:0.5px]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <h2 id={`${ids}-title`} className="text-sm font-semibold">
              {isSearching ? "Search results" : "Activity"}
            </h2>
            {!isSearching && (
              <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                {initialOperations.length} in {monthLabel}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-3 border-b border-border p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_minmax(0,12rem)]">
          <div>
            <Label htmlFor={`${ids}-search`}>Search</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id={`${ids}-search`}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Merchant, category or account"
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`${ids}-category`}>Category</Label>
            <Select
              id={`${ids}-category`}
              value={categoryId ?? ""}
              onChange={(e) =>
                setCategoryId(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`${ids}-account`}>Account</Label>
            <Select
              id={`${ids}-account`}
              value={accountId ?? ""}
              onChange={(e) =>
                setAccountId(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="px-3 py-2" aria-live="polite" aria-busy={pending}>
          {isSearching && pending && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Searching…
            </p>
          )}

          {!(isSearching && pending) &&
            (isSearching ? hasSearched : true) &&
            filtered.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <p>
                  {isSearching
                    ? "No matching operations."
                    : filtersActive
                      ? "No operations match these filters this month."
                      : "No operations this month."}
                </p>
                {filtersActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryId(null);
                      setAccountId(null);
                    }}
                    className="mt-2 rounded-md text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}

          {!(isSearching && pending) && groups.length > 0 && (
            <div className="space-y-3">
              {groups.map((group) => (
                <section key={group.date} aria-label={formatDayHeading(group.date)}>
                  <h3 className="flex items-center justify-between gap-3 px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                    <span>
                      {formatDayHeading(group.date)}
                      {group.date.slice(0, 4) !== currentYear &&
                        ` ${group.date.slice(0, 4)}`}
                    </span>
                    {group.date > today && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                        Scheduled
                      </span>
                    )}
                  </h3>
                  <ul>
                    {group.operations.map((op) => (
                      <OperationRow
                        key={op.id}
                        operation={op}
                        onEdit={() => setEditingOperation(op)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {hasMore && !(isSearching && pending) && (
            <div className="mt-2 border-t border-border px-2 py-2">
              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground"
                onClick={() => setShowAll((value) => !value)}
                aria-expanded={showAll}
              >
                {showAll ? "Show less" : `View all ${filtered.length} operations`}
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", showAll && "rotate-180")}
                  aria-hidden
                />
              </Button>
            </div>
          )}
        </div>
      </section>

      <ExpenseEditModal
        operation={editingOperation}
        categories={categories}
        accounts={accounts}
        open={editingOperation !== null}
        onClose={() => setEditingOperation(null)}
      />
    </>
  );
}

function groupByDay(operations: ExpenseOperation[]) {
  const groups: { date: string; operations: ExpenseOperation[] }[] = [];
  for (const op of operations) {
    const last = groups[groups.length - 1];
    if (last && last.date === op.date) last.operations.push(op);
    else groups.push({ date: op.date, operations: [op] });
  }
  return groups;
}

function OperationRow({
  operation: op,
  onEdit,
}: {
  operation: ExpenseOperation;
  onEdit: () => void;
}) {
  const title = displayTransactionTitle(op.description, op.categoryName);
  const meta = [op.categoryName, op.subcategoryName, op.accountName]
    .filter(Boolean)
    .join(" · ");
  const isIncome = op.type === "income";

  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${title}, ${isIncome ? "+" : "−"}${formatMoney(op.amount, op.currency)}, ${meta}`}
        className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto_1rem] items-center gap-x-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
      >
        <CategoryIcon
          icon={resolveCategoryIcon(op.categoryIcon, op.categoryName)}
          color={op.categoryColor}
          size={16}
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium leading-5">
            {title}
          </span>
          <span className="block truncate text-xs leading-4 text-muted-foreground">
            {meta}
          </span>
        </span>
        <span
          className={cn(
            "text-right text-sm font-medium tabular-nums",
            isIncome ? "text-gain" : "text-foreground",
          )}
        >
          <Money>
            {isIncome ? "+" : "−"}
            {formatMoney(op.amount, op.currency)}
          </Money>
        </span>
        <Pencil
          className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
          aria-hidden
        />
      </button>
    </li>
  );
}
