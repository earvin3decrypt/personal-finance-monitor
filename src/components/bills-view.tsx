"use client";

import { useId, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Pencil,
  Plus,
  SkipForward,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteBill,
  markBillPaid,
  saveBill,
  skipBill,
  trackAsBill,
} from "@/app/actions/bills";
import { AccountBrandIcon } from "@/components/account-brand-icon";
import { CategoryIcon, resolveCategoryIcon } from "@/components/category-icon";
import { Money } from "@/components/money";
import {
  Dropdown,
  Field,
  inferAccountType,
  TogglePill,
} from "@/components/operation-form-parts";
import {
  Card,
  StatCard,
  Button,
  Input,
  Select,
  Label,
  Modal,
} from "@/components/ui";
import type { BillRow, TrackableRecurringItem } from "@/lib/bills";
import type { CategoryWithChildren } from "@/lib/categories";
import { formatDate, formatMoney, parseAmountInput, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

type AccountOption = { id: number; name: string; currency: string; type?: string };

type OpenPicker = "account" | "category" | null;

type BillsViewProps = {
  baseCurrency: string;
  bills: BillRow[];
  monthlyTotalBase: number;
  dueInSevenDays: number;
  trackable: TrackableRecurringItem[];
  accounts: AccountOption[];
  categories: CategoryWithChildren[];
};

function dueLabel(bill: BillRow): string {
  if (bill.status === "ended") {
    return bill.endDate ? `Ended ${formatDate(bill.endDate)}` : "Ended";
  }
  if (bill.daysUntilDue == null || !bill.nextDueDate) return "No due date";
  if (bill.daysUntilDue < 0) {
    const n = Math.abs(bill.daysUntilDue);
    return n === 1 ? "1 day overdue" : `${n} days overdue`;
  }
  if (bill.daysUntilDue === 0) return "Due today";
  if (bill.daysUntilDue === 1) return "Due tomorrow";
  return `Due in ${bill.daysUntilDue} days`;
}

export function BillsView({
  baseCurrency,
  bills,
  monthlyTotalBase,
  dueInSevenDays,
  trackable,
  accounts,
  categories,
}: BillsViewProps) {
  const [editing, setEditing] = useState<BillRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [trackingId, setTrackingId] = useState<number | null>(null);

  const overdue = bills.filter((b) => b.status === "overdue");
  const dueSoon = bills.filter((b) => b.status === "due-soon");
  const upcoming = bills.filter((b) => b.status === "upcoming");
  const ended = bills.filter((b) => b.status === "ended");
  const activeCount = bills.length - ended.length;

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(bill: BillRow) {
    setEditing(bill);
    setFormOpen(true);
  }

  function closeForm() {
    setEditing(null);
    setFormOpen(false);
  }

  return (
    <div className="space-y-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bills</h1>
          <p className="mt-1 text-muted-foreground">
            Flag recurring payments, set due dates, and get reminders before
            they&apos;re due
          </p>
        </div>
        <Button type="button" onClick={openAdd}>
          <Plus className="h-4 w-4" aria-hidden />
          Add bill
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Monthly bills"
          value={formatMoney(monthlyTotalBase, baseCurrency)}
          sub={`${activeCount} active · yearly counted /12`}
        />
        <StatCard
          label="Due in 7 days"
          value={String(dueInSevenDays)}
          sub={
            overdue.length > 0
              ? `${overdue.length} overdue`
              : "Upcoming payments"
          }
          className={
            overdue.length > 0
              ? "[&_p:nth-child(2)]:text-loss"
              : undefined
          }
        />
        <StatCard
          label="Needs attention"
          value={String(overdue.length + dueSoon.length)}
          sub="Overdue or within reminder window"
        />
      </div>

      {overdue.length > 0 && (
        <BillGroup
          title="Overdue"
          tone="danger"
          bills={overdue}
          baseCurrency={baseCurrency}
          onEdit={openEdit}
        />
      )}
      {dueSoon.length > 0 && (
        <BillGroup
          title="Due soon"
          tone="warn"
          bills={dueSoon}
          baseCurrency={baseCurrency}
          onEdit={openEdit}
        />
      )}
      {upcoming.length > 0 && (
        <BillGroup
          title="Upcoming"
          tone="neutral"
          bills={upcoming}
          baseCurrency={baseCurrency}
          onEdit={openEdit}
        />
      )}
      {ended.length > 0 && (
        <BillGroup
          title="Ended"
          tone="ended"
          bills={ended}
          baseCurrency={baseCurrency}
          onEdit={openEdit}
        />
      )}

      {activeCount === 0 && ended.length === 0 && (
        <Card>
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">No bills tracked yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a subscription or bill with Add bill, or promote an existing
                recurring expense from Forecast.
              </p>
            </div>
          </div>
        </Card>
      )}

      {trackable.length > 0 && (
        <Card>
          <h2 className="mb-1 text-sm font-semibold">Track as bill</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            These recurring expenses from Forecast are not yet tracked with due
            dates.
          </p>
          <ul className="divide-y divide-border">
            {trackable.map((item) => (
              <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="text-sm tabular-nums text-muted-foreground">
                      <Money>
                        {formatMoney(item.amount, item.currency)} / month
                      </Money>
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() =>
                      setTrackingId(trackingId === item.id ? null : item.id)
                    }
                  >
                    {trackingId === item.id ? "Cancel" : "Track as bill"}
                  </Button>
                </div>
                {trackingId === item.id && (
                  <TrackAsBillForm
                    item={item}
                    accounts={accounts}
                    categories={categories}
                    onDone={() => setTrackingId(null)}
                  />
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Edit bill" : "Add bill"}
        className="max-w-lg"
      >
        <BillForm
          key={editing?.id ?? "new"}
          bill={editing}
          accounts={accounts}
          categories={categories}
          defaultCurrency={baseCurrency}
          onCancel={closeForm}
        />
      </Modal>
    </div>
  );
}

function BillGroup({
  title,
  tone,
  bills,
  baseCurrency,
  onEdit,
}: {
  title: string;
  tone: "danger" | "warn" | "neutral" | "ended";
  bills: BillRow[];
  baseCurrency: string;
  onEdit: (bill: BillRow) => void;
}) {
  return (
    <Card>
      <h2
        className={cn(
          "mb-4 flex items-center gap-2 text-sm font-medium",
          tone === "danger" && "text-loss",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
          (tone === "neutral" || tone === "ended") && "text-muted-foreground",
        )}
      >
        {(tone === "danger" || tone === "warn") && (
          <AlertTriangle className="h-4 w-4" />
        )}
        {title}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {bills.length}
        </span>
      </h2>
      <ul className="divide-y divide-border">
        {bills.map((bill) => (
          <BillRowItem
            key={bill.id}
            bill={bill}
            baseCurrency={baseCurrency}
            onEdit={onEdit}
            showPayActions={tone !== "ended"}
          />
        ))}
      </ul>
    </Card>
  );
}

function BillRowItem({
  bill,
  baseCurrency,
  onEdit,
  showPayActions = true,
}: {
  bill: BillRow;
  baseCurrency: string;
  onEdit: (bill: BillRow) => void;
  showPayActions?: boolean;
}) {
  const canMarkPaid = !!bill.accountId && !!bill.categoryId;

  return (
    <li className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium">{bill.name}</p>
        <p className="text-sm tabular-nums">
          <Money>
            {formatMoney(bill.amount, bill.currency)}
            <span className="text-muted-foreground">
              {" "}
              / {bill.billingCycle === "year" ? "year" : "month"}
            </span>
            {bill.currency !== baseCurrency && (
              <span className="ml-1 text-xs text-muted-foreground">
                ({formatMoney(bill.amountBase, baseCurrency)})
              </span>
            )}
          </Money>
        </p>
        <p
          className={cn(
            "mt-0.5 text-xs",
            bill.status === "overdue" && "font-medium text-loss",
            bill.status === "due-soon" &&
              "font-medium text-amber-600 dark:text-amber-400",
            (bill.status === "upcoming" || bill.status === "ended") &&
              "text-muted-foreground",
          )}
        >
          {dueLabel(bill)}
          {bill.status !== "ended" && bill.nextDueDate
            ? ` · ${formatDate(bill.nextDueDate)}`
            : ""}
          {bill.endDate && bill.status !== "ended"
            ? ` · Ends ${formatDate(bill.endDate)}`
            : ""}
          {bill.accountName ? ` · ${bill.accountName}` : ""}
          {bill.categoryName ? ` · ${bill.categoryName}` : ""}
        </p>
        {showPayActions && !canMarkPaid && (
          <p className="mt-1 text-xs text-muted-foreground">
            Set an account and category to mark as paid.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {showPayActions && (
          <>
            <form action={markBillPaid}>
              <input type="hidden" name="id" value={bill.id} />
              <Button
                type="submit"
                variant="secondary"
                className="h-8 px-2.5 text-xs"
                disabled={!canMarkPaid}
                title={
                  canMarkPaid
                    ? "Log expense and advance due date"
                    : "Needs account and category"
                }
              >
                <Check className="h-3.5 w-3.5" />
                Mark paid
              </Button>
            </form>
            <form action={skipBill}>
              <input type="hidden" name="id" value={bill.id} />
              <Button
                type="submit"
                variant="ghost"
                className="h-8 px-2.5 text-xs"
                title="Advance due date without logging"
              >
                <SkipForward className="h-3.5 w-3.5" />
                Skip
              </Button>
            </form>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          className="h-8 px-2.5 text-xs"
          onClick={() => onEdit(bill)}
          aria-label={`Edit ${bill.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <form action={deleteBill}>
          <input type="hidden" name="id" value={bill.id} />
          <button
            type="submit"
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-loss"
            aria-label={`Delete ${bill.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </form>
      </div>
    </li>
  );
}

function BillForm({
  bill,
  accounts,
  categories,
  defaultCurrency,
  onCancel,
}: {
  bill: BillRow | null;
  accounts: AccountOption[];
  categories: CategoryWithChildren[];
  defaultCurrency: string;
  onCancel: () => void;
}) {
  const ids = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(bill?.name ?? "");
  const [amount, setAmount] = useState(
    bill?.amount != null ? String(bill.amount) : "",
  );
  const [amountTouched, setAmountTouched] = useState(false);
  const [cycle, setCycle] = useState<"month" | "year">(
    bill?.billingCycle ?? "month",
  );
  const [accountId, setAccountId] = useState<number | null>(
    bill?.accountId ?? accounts[0]?.id ?? null,
  );
  const [categoryId, setCategoryId] = useState<number | null>(
    bill?.categoryId ?? categories[0]?.id ?? null,
  );
  const [subcategoryId, setSubcategoryId] = useState<number | null>(
    bill?.subcategoryId ?? null,
  );
  const [nextDueDate, setNextDueDate] = useState(
    bill?.nextDueDate ?? todayISO(),
  );
  const [endDate, setEndDate] = useState(bill?.endDate ?? "");
  const [reminderDays, setReminderDays] = useState(
    String(bill?.reminderDays ?? 3),
  );
  const [openPicker, setOpenPicker] = useState<OpenPicker>(null);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId],
  );
  const currency =
    selectedAccount?.currency ?? bill?.currency ?? defaultCurrency;
  const parsedAmount = parseAmountInput(amount);
  const amountError =
    amountTouched && parsedAmount == null
      ? "Enter an amount greater than 0"
      : null;
  const canSave =
    name.trim().length > 0 &&
    parsedAmount != null &&
    !!accountId &&
    !!categoryId &&
    !!nextDueDate &&
    !pending;

  function handleSave() {
    if (!canSave || parsedAmount == null || !accountId || !categoryId) return;

    const formData = new FormData();
    if (bill) formData.set("id", String(bill.id));
    formData.set("name", name.trim());
    formData.set("amount", String(parsedAmount));
    formData.set("currency", currency);
    formData.set("type", "expense");
    formData.set("billingCycle", cycle);
    formData.set("nextDueDate", nextDueDate);
    if (endDate) formData.set("endDate", endDate);
    formData.set("reminderDays", reminderDays);
    formData.set("accountId", String(accountId));
    formData.set("categoryId", String(categoryId));
    if (subcategoryId) formData.set("subcategoryId", String(subcategoryId));

    setError(null);
    startTransition(async () => {
      try {
        await saveBill(formData);
        onCancel();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not save bill",
        );
      }
    });
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
      <div>
        <Label htmlFor={`${ids}-name`}>Name</Label>
        <Input
          id={`${ids}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Netflix, Rent, Insurance"
          autoFocus={!bill}
          required
        />
      </div>

      <div
        className="flex w-fit gap-1 rounded-full bg-muted p-0.5"
        role="group"
        aria-label="Billing cycle"
      >
        <TogglePill
          active={cycle === "month"}
          onClick={() => setCycle("month")}
        >
          Monthly
        </TogglePill>
        <TogglePill active={cycle === "year"} onClick={() => setCycle("year")}>
          Yearly
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
            −
          </span>
          <input
            id={`${ids}-amount`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => setAmountTouched(amount !== "")}
            placeholder="0.00"
            aria-invalid={amountError ? true : undefined}
            aria-describedby={amountError ? `${ids}-amount-error` : undefined}
            className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tabular-nums outline-none placeholder:text-muted-foreground"
          />
          <span className="text-sm text-muted-foreground">{currency}</span>
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
        <Field id={`${ids}-account`} label="Account">
          <Dropdown
            id={`${ids}-account`}
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
                const selected = accountId === acc.id;
                return (
                  <li key={acc.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountId(acc.id);
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
                        <Check
                          className="h-4 w-4 shrink-0 text-primary"
                          aria-hidden
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Dropdown>
        </Field>

        <Field id={`${ids}-category`} label="Category">
          <Dropdown
            id={`${ids}-category`}
            open={openPicker === "category"}
            onOpenChange={(open) => setOpenPicker(open ? "category" : null)}
            trigger={
              selectedCategory ? (
                <span className="flex min-w-0 items-center gap-2.5">
                  <CategoryIcon
                    icon={resolveCategoryIcon(
                      selectedCategory.icon,
                      selectedCategory.name,
                    )}
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
                const selected = categoryId === cat.id;
                return (
                  <li key={cat.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryId(cat.id);
                        setSubcategoryId(null);
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
                        <Check
                          className="ml-auto h-4 w-4 shrink-0 text-primary"
                          aria-hidden
                        />
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
          <p
            id={`${ids}-sub`}
            className="mb-1.5 text-[13px] font-medium text-muted-foreground"
          >
            Subcategory
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-labelledby={`${ids}-sub`}
          >
            {selectedCategory.children.map((sub) => {
              const selected = subcategoryId === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setSubcategoryId(selected ? null : sub.id)
                  }
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
          <Label htmlFor={`${ids}-due`}>Next due date</Label>
          <Input
            id={`${ids}-due`}
            type="date"
            value={nextDueDate}
            onChange={(e) => setNextDueDate(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor={`${ids}-end`}>Ends on (optional)</Label>
          <Input
            id={`${ids}-end`}
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`${ids}-reminder`}>Remind me (days before)</Label>
        <Input
          id={`${ids}-reminder`}
          type="number"
          min={0}
          max={30}
          value={reminderDays}
          onChange={(e) => setReminderDays(e.target.value)}
          required
        />
      </div>

      {error && <p className="text-xs text-loss">{error}</p>}

      <Button type="submit" disabled={!canSave} className="w-full py-2.5">
        <Check className="h-4 w-4" aria-hidden />
        {pending ? "Saving…" : bill ? "Save changes" : "Add bill"}
      </Button>
    </form>
  );
}

function TrackAsBillForm({
  item,
  accounts,
  categories,
  onDone,
}: {
  item: TrackableRecurringItem;
  accounts: AccountOption[];
  categories: CategoryWithChildren[];
  onDone: () => void;
}) {
  const [categoryId, setCategoryId] = useState<number | "">(
    categories[0]?.id ?? "",
  );
  const selectedCategory = categories.find((c) => c.id === categoryId);

  return (
    <form
      action={async (fd) => {
        await trackAsBill(fd);
        onDone();
      }}
      className="mt-3 space-y-3 rounded-xl border border-border bg-muted/20 p-3"
    >
      <input type="hidden" name="id" value={item.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`track-due-${item.id}`}>Next due date</Label>
          <Input
            id={`track-due-${item.id}`}
            name="nextDueDate"
            type="date"
            defaultValue={todayISO()}
            required
          />
        </div>
        <div>
          <Label htmlFor={`track-end-${item.id}`}>Ends on (optional)</Label>
          <Input
            id={`track-end-${item.id}`}
            name="endDate"
            type="date"
            defaultValue=""
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`track-cycle-${item.id}`}>Billing cycle</Label>
          <Select
            id={`track-cycle-${item.id}`}
            name="billingCycle"
            defaultValue="month"
          >
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </Select>
        </div>
        <div>
          <Label htmlFor={`track-reminder-${item.id}`}>Remind (days before)</Label>
          <Input
            id={`track-reminder-${item.id}`}
            name="reminderDays"
            type="number"
            min={0}
            max={30}
            defaultValue={3}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`track-account-${item.id}`}>Pay from account</Label>
          <Select
            id={`track-account-${item.id}`}
            name="accountId"
            defaultValue={accounts[0]?.id ?? ""}
            required
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`track-category-${item.id}`}>Category</Label>
          <Select
            id={`track-category-${item.id}`}
            name="categoryId"
            value={categoryId === "" ? "" : String(categoryId)}
            onChange={(e) =>
              setCategoryId(e.target.value ? Number(e.target.value) : "")
            }
            required
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {selectedCategory && selectedCategory.children.length > 0 && (
        <div>
          <Label htmlFor={`track-sub-${item.id}`}>Subcategory</Label>
          <Select id={`track-sub-${item.id}`} name="subcategoryId" defaultValue="">
            <option value="">None</option>
            {selectedCategory.children.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <Button type="submit" className="w-full">
        Start tracking
      </Button>
    </form>
  );
}
