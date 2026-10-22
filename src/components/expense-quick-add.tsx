"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { saveExpense } from "@/app/actions/expenses";
import { Button, Input, Label, Select } from "@/components/ui";
import type { CategoryWithChildren } from "@/lib/categories";
import { parseAmountInput } from "@/lib/format";
import { readLastUsed, writeLastUsed } from "@/lib/last-used";
import { cn } from "@/lib/utils";

type AccountOption = { id: number; name: string; currency: string };

/** One-line expense entry; the header "New operation" form covers income, notes and subcategories. */
export function ExpenseQuickAdd({
  categories,
  accounts,
  defaultDate,
}: {
  categories: CategoryWithChildren[];
  accounts: AccountOption[];
  defaultDate: string;
}) {
  const ids = useId();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(defaultDate);

  useEffect(() => {
    const last = readLastUsed();
    if (categories.some((c) => c.id === last.categoryId)) {
      setCategoryId(String(last.categoryId));
    }
    if (accounts.some((a) => a.id === last.accountId)) {
      setAccountId(String(last.accountId));
    }
  }, [categories, accounts]);

  if (accounts.length === 0) return null;

  const parsedAmount = parseAmountInput(amount);
  const amountError =
    amountTouched && parsedAmount == null ? "Enter an amount greater than 0" : null;
  const account = accounts.find((a) => String(a.id) === accountId);
  const canAdd = parsedAmount != null && !!account && !!categoryId && !!date && !pending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canAdd || parsedAmount == null || !account) return;
    const formData = new FormData();
    formData.set("accountId", accountId);
    formData.set("categoryId", categoryId);
    formData.set("type", "expense");
    formData.set("amount", String(parsedAmount));
    formData.set("currency", account.currency);
    formData.set("date", date);
    startTransition(async () => {
      await saveExpense(formData);
      writeLastUsed({ categoryId: Number(categoryId), accountId: account.id });
      setAmount("");
      setAmountTouched(false);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Quick add expense"
      className="grid gap-3 border-b border-border p-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,8rem)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,10rem)_auto] lg:items-start"
    >
      <div>
        <Label htmlFor={`${ids}-amount`}>Amount</Label>
        <Input
          id={`${ids}-amount`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => setAmountTouched(amount !== "")}
          aria-invalid={amountError ? true : undefined}
          aria-describedby={amountError ? `${ids}-amount-error` : undefined}
          className={cn("tabular-nums", amountError && "border-loss/50")}
        />
        {amountError && (
          <p id={`${ids}-amount-error`} className="mt-1.5 text-xs text-loss">
            {amountError}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor={`${ids}-category`}>Category</Label>
        <Select
          id={`${ids}-category`}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
        >
          <option value="" disabled>
            Choose…
          </option>
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
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          required
        >
          <option value="" disabled>
            Choose…
          </option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`${ids}-date`}>Date</Label>
        <Input
          id={`${ids}-date`}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>
      <div className="sm:col-span-2 lg:col-span-1">
        <span aria-hidden className="invisible mb-1.5 hidden text-[13px] lg:block">
          &nbsp;
        </span>
        <Button type="submit" disabled={!canAdd} className="w-full lg:w-auto">
          <Plus className="h-4 w-4" aria-hidden />
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
    </form>
  );
}
