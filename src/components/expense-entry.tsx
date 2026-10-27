"use client";

import {
  useEffect,
  useId,
  useState,
  useTransition,
} from "react";
import { Check, Plus, X } from "lucide-react";
import { saveExpense } from "@/app/actions/expenses";
import { AccountBrandIcon } from "@/components/account-brand-icon";
import { CategoryIcon, resolveCategoryIcon } from "@/components/category-icon";
import {
  Dropdown,
  Field,
  inferAccountType,
  TogglePill,
} from "@/components/operation-form-parts";
import { Button, Input, Label, Modal } from "@/components/ui";
import type { CategoryWithChildren } from "@/lib/categories";
import { parseAmountInput } from "@/lib/format";
import { readLastUsed, writeLastUsed } from "@/lib/last-used";
import { cn } from "@/lib/utils";

type Account = { id: number; name: string; currency: string; type?: string };

type OpenPicker = "account" | "category" | null;

/** Header button that opens the full operation form in the app's modal. */
export function NewOperationButton(props: {
  categories: CategoryWithChildren[];
  accounts: Account[];
  defaultCurrency: string;
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        New operation
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New operation"
        className="max-w-lg"
      >
        <ExpenseEntry {...props} autoFocus onSaved={() => setOpen(false)} />
      </Modal>
    </>
  );
}

export function ExpenseEntry({
  categories,
  accounts,
  defaultCurrency,
  defaultDate,
  autoFocus = false,
  onSaved,
}: {
  categories: CategoryWithChildren[];
  accounts: Account[];
  defaultCurrency: string;
  defaultDate: string;
  autoFocus?: boolean;
  onSaved?: () => void;
}) {
  const ids = useId();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null,
  );
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryWithChildren | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [openPicker, setOpenPicker] = useState<OpenPicker>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const last = readLastUsed();
    const lastCategory = categories.find((c) => c.id === last.categoryId);
    if (lastCategory) setSelectedCategory(lastCategory);
    if (accounts.some((a) => a.id === last.accountId)) {
      setSelectedAccountId(last.accountId);
    }
  }, [categories, accounts]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const operationCurrency = selectedAccount?.currency ?? defaultCurrency;
  const parsedAmount = parseAmountInput(amount);
  const amountError =
    amountTouched && parsedAmount == null ? "Enter an amount greater than 0" : null;
  const showMissing = parsedAmount != null;
  const canSave =
    parsedAmount != null &&
    !!selectedAccountId &&
    !!selectedCategory &&
    !!date &&
    !pending;

  function handleSave() {
    if (!canSave || parsedAmount == null || !selectedCategory || !selectedAccountId) {
      return;
    }
    const formData = new FormData();
    formData.set("accountId", String(selectedAccountId));
    formData.set("categoryId", String(selectedCategory.id));
    if (selectedSubId) formData.set("subcategoryId", String(selectedSubId));
    formData.set("type", type);
    formData.set("amount", String(parsedAmount));
    formData.set("currency", operationCurrency);
    formData.set("description", note);
    formData.set("date", date);

    startTransition(async () => {
      await saveExpense(formData);
      writeLastUsed({
        categoryId: selectedCategory.id,
        accountId: selectedAccountId,
      });
      setAmount("");
      setAmountTouched(false);
      setNote("");
      setSelectedSubId(null);
      onSaved?.();
    });
  }

  if (accounts.length === 0) {
    return (
      <p className="text-sm text-loss">
        Add an account on the Accounts page before logging operations.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
      noValidate
    >
      <div
        className="flex w-fit gap-1 rounded-full bg-muted p-0.5"
        role="group"
        aria-label="Operation type"
      >
        <TogglePill active={type === "expense"} onClick={() => setType("expense")}>
          Expense
        </TogglePill>
        <TogglePill active={type === "income"} onClick={() => setType("income")}>
          Income
        </TogglePill>
      </div>

      <div>
        <Label htmlFor={`${ids}-amount`}>Amount</Label>
        <div
          className={cn(
            "flex items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-2 transition-[border-color,box-shadow] duration-150 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10",
            amountError && "border-loss/50",
          )}
        >
          <span className="text-xl text-muted-foreground" aria-hidden>
            {type === "expense" ? "−" : "+"}
          </span>
          <input
            id={`${ids}-amount`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            autoFocus={autoFocus}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => setAmountTouched(amount !== "")}
            placeholder="0.00"
            aria-invalid={amountError ? true : undefined}
            aria-describedby={amountError ? `${ids}-amount-error` : undefined}
            className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tabular-nums outline-none placeholder:text-muted-foreground"
          />
          <span className="text-sm text-muted-foreground">{operationCurrency}</span>
          {amount && (
            <button
              type="button"
              onClick={() => {
                setAmount("");
                setAmountTouched(false);
              }}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
              aria-label="Clear amount"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
        {amountError && (
          <p id={`${ids}-amount-error`} className="mt-1.5 text-xs text-loss">
            {amountError}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id={`${ids}-account`}
          label="Account"
          error={showMissing && !selectedAccountId ? "Choose an account" : null}
        >
          <Dropdown
            id={`${ids}-account`}
            open={openPicker === "account"}
            onOpenChange={(open) => setOpenPicker(open ? "account" : null)}
            trigger={
              selectedAccount ? (
                <span className="flex min-w-0 items-center gap-2.5">
                  <AccountBrandIcon
                    name={selectedAccount.name}
                    type={inferAccountType(selectedAccount.name, selectedAccount.type)}
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
                <span className="text-sm text-muted-foreground">Select account</span>
              )
            }
          >
            <ul className="max-h-64 overflow-y-auto py-1">
              {accounts.map((acc) => {
                const selected = selectedAccountId === acc.id;
                return (
                  <li key={acc.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAccountId(acc.id);
                        setOpenPicker(null);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                        selected && "bg-primary-light/40",
                      )}
                    >
                      <AccountBrandIcon
                        name={acc.name}
                        type={inferAccountType(acc.name, acc.type)}
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
                        <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Dropdown>
        </Field>

        <Field
          id={`${ids}-category`}
          label="Category"
          error={showMissing && !selectedCategory ? "Choose a category" : null}
        >
          <Dropdown
            id={`${ids}-category`}
            open={openPicker === "category"}
            onOpenChange={(open) => setOpenPicker(open ? "category" : null)}
            trigger={
              selectedCategory ? (
                <span className="flex min-w-0 items-center gap-2.5">
                  <CategoryIcon
                    icon={resolveCategoryIcon(selectedCategory.icon, selectedCategory.name)}
                    color={selectedCategory.color}
                    size={16}
                  />
                  <span className="truncate text-sm font-medium">
                    {selectedCategory.name}
                  </span>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Select category</span>
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
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                        selected && "bg-primary-light/40",
                      )}
                    >
                      <CategoryIcon
                        icon={resolveCategoryIcon(cat.icon, cat.name)}
                        color={cat.color}
                        size={16}
                      />
                      <span className="text-sm font-medium">{cat.name}</span>
                      {selected && (
                        <Check className="ml-auto h-4 w-4 shrink-0 text-primary" aria-hidden />
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
        <div>
          <p id={`${ids}-sub`} className="mb-1.5 text-[13px] font-medium text-muted-foreground">
            Subcategory
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${ids}-sub`}>
            {selectedCategory.children.map((sub) => {
              const selected = selectedSubId === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedSubId(selected ? null : sub.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {selected && <Check className="h-3.5 w-3.5" aria-hidden />}
                  {sub.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
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
        <div>
          <Label htmlFor={`${ids}-note`}>Note (optional)</Label>
          <Input
            id={`${ids}-note`}
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Merchant or detail"
          />
        </div>
      </div>

      <Button type="submit" disabled={!canSave} className="w-full py-2.5">
        <Check className="h-4 w-4" aria-hidden />
        {pending ? "Saving…" : "Save operation"}
      </Button>
    </form>
  );
}
