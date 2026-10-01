"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, Edit2, Search, Trash2 } from "lucide-react";
import { searchExpensesAction, deleteExpense } from "@/app/actions/expenses";
import { CategoryIcon } from "@/components/category-icon";
import { ExpenseEditModal } from "@/components/expense-edit-modal";
import { Button, Input } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import type { CategoryWithChildren } from "@/lib/categories";
import type { ExpenseOperation } from "@/lib/expense-stats";
import { Money } from "@/components/money";

const RECENT_LIMIT = 5;

type AccountOption = { id: number; name: string; currency: string };

export function OperationsList({
  initialOperations,
  categories,
  accounts,
}: {
  initialOperations: ExpenseOperation[];
  categories: CategoryWithChildren[];
  accounts: AccountOption[];
}) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ExpenseOperation[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [editingOperation, setEditingOperation] =
    useState<ExpenseOperation | null>(null);
  const [pending, startTransition] = useTransition();

  const isSearching = query.trim().length > 0;
  const visibleRecent = showAll
    ? initialOperations
    : initialOperations.slice(0, RECENT_LIMIT);
  const hasMoreRecent = initialOperations.length > RECENT_LIMIT;

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

  const displayedOperations = isSearching ? searchResults : visibleRecent;

  return (
    <>
      <section className="mb-10">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 p-5">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-foreground/90">
                {isSearching ? "Search results" : "Recent operations"}
              </h2>
              {!isSearching && (
                <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  {initialOperations.length} this month
                </span>
              )}
            </div>
          </div>

          <div className="border-b border-border/50 p-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search past operations..."
                className="pl-9"
                aria-label="Search past operations"
              />
            </div>
          </div>

          <div className="p-2">
            {isSearching && pending && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Searching…
              </p>
            )}

            {isSearching && !pending && hasSearched && searchResults.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No matching operations.
              </p>
            )}

            {!isSearching && initialOperations.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No operations this month.
              </p>
            )}

            {((isSearching && !pending && searchResults.length > 0) ||
              (!isSearching && initialOperations.length > 0)) && (
              <ul className="divide-y divide-border/40">
                {displayedOperations.map((op) => (
                  <OperationRow
                    key={op.id}
                    operation={op}
                    onEdit={() => setEditingOperation(op)}
                  />
                ))}
              </ul>
            )}

            {!isSearching && hasMoreRecent && (
              <div className="border-t border-border/40 px-3 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full gap-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAll((value) => !value)}
                >
                  {showAll
                    ? "Show less"
                    : `See all ${initialOperations.length} operations`}
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showAll ? "rotate-180" : ""}`}
                  />
                </Button>
              </div>
            )}
          </div>
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

function OperationRow({
  operation: op,
  onEdit,
}: {
  operation: ExpenseOperation;
  onEdit: () => void;
}) {
  return (
    <li className="flex flex-col justify-between gap-3 rounded-xl p-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <CategoryIcon
          icon={op.categoryIcon}
          color={op.categoryColor}
          size={16}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {op.description || op.categoryName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {formatDate(op.date)} · {op.accountName}
          </p>
        </div>
      </div>

      <div className="ml-9 flex items-center justify-between gap-2 sm:ml-0 sm:justify-end">
        <span
          className={`text-sm font-medium tabular-nums ${
            op.type === "income" ? "text-gain" : ""
          }`}
        >
          <Money>
            {op.type === "income" ? "+" : "−"}
            {formatMoney(op.amount, op.currency)}
          </Money>
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-primary/10 hover:text-primary"
            title="Edit operation"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <form action={deleteExpense}>
            <input type="hidden" name="id" value={op.id} />
            <button
              type="submit"
              className="rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-loss/10 hover:text-loss"
              title="Delete operation"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </li>
  );
}
