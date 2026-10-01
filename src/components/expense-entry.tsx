"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { saveExpense } from "@/app/actions/expenses";
import { AccountBrandIcon } from "@/components/account-brand-icon";
import { CategoryIcon } from "@/components/category-icon";
import { Input } from "@/components/ui";
import type { CategoryWithChildren } from "@/lib/categories";
import { cn } from "@/lib/utils";

type Account = { id: number; name: string; currency: string; type?: string };

type OpenPicker = "account" | "category" | null;

function inferAccountType(name: string, type?: string): string {
  if (type) return type;
  const lower = name.toLowerCase();
  if (
    lower.includes("espèce") ||
    lower.includes("espece") ||
    lower.includes("liquide") ||
    lower.includes("cash")
  ) {
    return "cash";
  }
  if (
    lower.includes("livret") ||
    lower.includes("épargne") ||
    lower.includes("epargne") ||
    lower.includes("economies") ||
    lower.includes("économies") ||
    lower.includes("savings") ||
    lower.includes("ldds")
  ) {
    return "savings";
  }
  return "checking";
}

export function ExpenseEntry({
  categories,
  accounts,
  defaultCurrency,
  defaultDate,
}: {
  categories: CategoryWithChildren[];
  accounts: Account[];
  defaultCurrency: string;
  defaultDate: string;
}) {
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null,
  );
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryWithChildren | null>(categories[0] ?? null);
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [openPicker, setOpenPicker] = useState<OpenPicker>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const operationCurrency = selectedAccount?.currency ?? defaultCurrency;
  const canSave =
    !!amount && !!selectedAccountId && !!selectedCategory && !!date && !pending;

  function handleSave() {
    if (!amount || !selectedCategory || !selectedAccountId) return;
    const formData = new FormData();
    formData.set("accountId", String(selectedAccountId));
    formData.set("categoryId", String(selectedCategory.id));
    if (selectedSubId) formData.set("subcategoryId", String(selectedSubId));
    formData.set("type", type);
    formData.set("amount", amount.replace(/\s/g, "").replace(",", "."));
    formData.set("currency", operationCurrency);
    formData.set("description", note);
    formData.set("date", date);

    startTransition(async () => {
      await saveExpense(formData);
      setAmount("");
      setNote("");
      setSelectedSubId(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  if (accounts.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-5 text-sm text-loss">
        Add an account on the Accounts page before logging operations.
      </p>
    );
  }

  return (
    <div className="flex h-full w-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">New operation</h2>
        <div className="flex shrink-0 gap-1 rounded-full bg-muted p-0.5">
          <TogglePill active={type === "expense"} onClick={() => setType("expense")}>
            Expense
          </TogglePill>
          <TogglePill active={type === "income"} onClick={() => setType("income")}>
            Income
          </TogglePill>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border pb-4">
        <span className="text-2xl text-muted-foreground">
          {type === "expense" ? "−" : "+"}
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="min-w-0 flex-1 bg-transparent text-3xl font-semibold tabular-nums outline-none focus-visible:outline-none"
        />
        <span className="text-lg text-muted-foreground">{operationCurrency}</span>
        {amount && (
          <button
            type="button"
            onClick={() => setAmount("")}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Date">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="rounded-xl py-2.5"
          />
        </Field>

        <Field label="Account">
          <Dropdown
            open={openPicker === "account"}
            onOpenChange={(open) => setOpenPicker(open ? "account" : null)}
            trigger={
              selectedAccount ? (
                <span className="flex min-w-0 items-center gap-2.5">
                  <AccountBrandIcon
                    name={selectedAccount.name}
                    type={inferAccountType(
                      selectedAccount.name,
                      selectedAccount.type,
                    )}
                    currency={selectedAccount.currency}
                    size="md"
                  />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium">
                      {selectedAccount.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {selectedAccount.currency}
                    </span>
                  </span>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Select account
                </span>
              )
            }
          >
            <ul className="max-h-64 overflow-y-auto py-1">
              {accounts.map((acc) => {
                const selected = selectedAccountId === acc.id;
                const accountType = inferAccountType(acc.name, acc.type);
                return (
                  <li key={acc.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAccountId(acc.id);
                        setOpenPicker(null);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted",
                        selected && "bg-primary-light/40",
                      )}
                    >
                      <AccountBrandIcon
                        name={acc.name}
                        type={accountType}
                        currency={acc.currency}
                        size="md"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {acc.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {acc.currency}
                        </span>
                      </span>
                      {selected && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Dropdown>
        </Field>

        <Field label="Category">
          <Dropdown
            open={openPicker === "category"}
            onOpenChange={(open) => setOpenPicker(open ? "category" : null)}
            trigger={
              selectedCategory ? (
                <span className="flex min-w-0 items-center gap-2.5">
                  <CategoryIcon
                    icon={selectedCategory.icon}
                    color={selectedCategory.color}
                    size={16}
                  />
                  <span className="truncate text-sm font-medium">
                    {selectedCategory.name}
                  </span>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Select category
                </span>
              )
            }
          >
            <ul className="max-h-64 overflow-y-auto py-1">
              {categories.map((cat) => {
                const selected = selectedCategory?.id === cat.id;
                return (
                  <li key={cat.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat);
                        setSelectedSubId(null);
                        setOpenPicker(null);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted",
                        selected && "bg-primary-light/40",
                      )}
                    >
                      <CategoryIcon icon={cat.icon} color={cat.color} size={16} />
                      <span className="text-sm font-medium">{cat.name}</span>
                      {selected && (
                        <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Dropdown>
        </Field>
      </div>

      {selectedCategory && selectedCategory.children.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedCategory.children.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() =>
                setSelectedSubId(selectedSubId === sub.id ? null : sub.id)
              }
              className={cn(
                "rounded-full px-3 py-1.5 text-sm transition",
                selectedSubId === sub.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-primary-light",
              )}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-auto space-y-3 pt-5">
        <Input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note for this operation (optional)"
        />

        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 disabled:opacity-50"
        >
          <Check className="h-5 w-5" />
          {saved ? "Saved!" : pending ? "Saving…" : "Save"}
        </button>

        {!selectedAccountId && (
          <p className="text-center text-sm text-muted-foreground">
            Select an account to save
          </p>
        )}
        {selectedAccountId && !amount && (
          <p className="text-center text-sm text-muted-foreground">
            Enter an amount to save
          </p>
        )}
        {selectedAccountId && amount && !date && (
          <p className="text-center text-sm text-muted-foreground">
            Enter a date to save
          </p>
        )}
        {selectedAccount && amount && date && (
          <p className="text-center text-sm text-muted-foreground">
            Will be recorded on{" "}
            <span className="font-medium text-foreground">
              {selectedAccount.name}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function Dropdown({
  open,
  onOpenChange,
  trigger,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition hover:border-primary/30 hover:bg-muted/30",
          open && "border-primary/40 ring-2 ring-primary/15",
        )}
      >
        <span className="min-w-0 flex-1">{trigger}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close menu"
            onClick={() => onOpenChange(false)}
          />
          <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

function TogglePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium transition",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
