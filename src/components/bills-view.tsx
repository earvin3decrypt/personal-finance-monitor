"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Pencil,
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
import { Card, StatCard, Button, Input, Select, Label } from "@/components/ui";
import type { BillRow, TrackableRecurringItem } from "@/lib/bills";
import type { CategoryWithChildren } from "@/lib/categories";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { Money } from "@/components/money";
import { cn } from "@/lib/utils";

type AccountOption = { id: number; name: string; currency: string };

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
  const [showForm, setShowForm] = useState(false);
  const [trackingId, setTrackingId] = useState<number | null>(null);

  const overdue = bills.filter((b) => b.status === "overdue");
  const dueSoon = bills.filter((b) => b.status === "due-soon");
  const upcoming = bills.filter((b) => b.status === "upcoming");
  const ended = bills.filter((b) => b.status === "ended");
  const activeCount = bills.length - ended.length;

  return (
    <div className="space-y-8">
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
          onEdit={(b) => {
            setEditing(b);
            setShowForm(true);
          }}
        />
      )}
      {dueSoon.length > 0 && (
        <BillGroup
          title="Due soon"
          tone="warn"
          bills={dueSoon}
          baseCurrency={baseCurrency}
          onEdit={(b) => {
            setEditing(b);
            setShowForm(true);
          }}
        />
      )}
      {upcoming.length > 0 && (
        <BillGroup
          title="Upcoming"
          tone="neutral"
          bills={upcoming}
          baseCurrency={baseCurrency}
          onEdit={(b) => {
            setEditing(b);
            setShowForm(true);
          }}
        />
      )}
      {ended.length > 0 && (
        <BillGroup
          title="Ended"
          tone="ended"
          bills={ended}
          baseCurrency={baseCurrency}
          onEdit={(b) => {
            setEditing(b);
            setShowForm(true);
          }}
        />
      )}

      {activeCount === 0 && ended.length === 0 && (
        <Card>
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">No bills tracked yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a subscription or bill below, or promote an existing
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

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">
            {editing ? "Edit bill" : "Add bill / subscription"}
          </h2>
          {(showForm || editing) && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setShowForm(false);
              }}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Close form"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {!showForm && !editing ? (
          <Button type="button" onClick={() => setShowForm(true)}>
            Add bill
          </Button>
        ) : (
          <BillForm
            key={editing?.id ?? "new"}
            bill={editing}
            accounts={accounts}
            categories={categories}
            defaultCurrency={baseCurrency}
            onCancel={() => {
              setEditing(null);
              setShowForm(false);
            }}
          />
        )}
      </Card>
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
  const [categoryId, setCategoryId] = useState<number | "">(
    bill?.categoryId ?? categories[0]?.id ?? "",
  );
  const [accountId, setAccountId] = useState<number | "">(
    bill?.accountId ?? accounts[0]?.id ?? "",
  );
  const [cycle, setCycle] = useState<"month" | "year">(
    bill?.billingCycle ?? "month",
  );

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId],
  );

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const currency = selectedAccount?.currency ?? bill?.currency ?? defaultCurrency;

  return (
    <form
      action={async (fd) => {
        await saveBill(fd);
        onCancel();
      }}
      className="space-y-3"
    >
      {bill && <input type="hidden" name="id" value={bill.id} />}
      <input type="hidden" name="type" value="expense" />
      <input type="hidden" name="currency" value={currency} />

      <div>
        <Label htmlFor="bill-name">Name</Label>
        <Input
          id="bill-name"
          name="name"
          placeholder="e.g. Netflix, Rent, Insurance"
          defaultValue={bill?.name ?? ""}
          required
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="bill-amount">Amount</Label>
          <div className="flex overflow-hidden rounded-lg border border-border focus-within:ring-2 focus-within:ring-primary/20">
            <span className="flex shrink-0 items-center border-r border-border bg-muted/30 px-3 text-sm tabular-nums text-muted-foreground">
              {currencySymbol(currency)}
            </span>
            <input
              id="bill-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={bill?.amount ?? ""}
              required
              className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm outline-none"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="bill-cycle">Billing cycle</Label>
          <Select
            id="bill-cycle"
            name="billingCycle"
            value={cycle}
            onChange={(e) => setCycle(e.target.value as "month" | "year")}
          >
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="bill-due">Next due date</Label>
          <Input
            id="bill-due"
            name="nextDueDate"
            type="date"
            defaultValue={bill?.nextDueDate ?? todayISO()}
            required
          />
        </div>
        <div>
          <Label htmlFor="bill-end">Ends on (optional)</Label>
          <Input
            id="bill-end"
            name="endDate"
            type="date"
            defaultValue={bill?.endDate ?? ""}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="bill-reminder">Remind me (days before)</Label>
        <Input
          id="bill-reminder"
          name="reminderDays"
          type="number"
          min={0}
          max={30}
          defaultValue={bill?.reminderDays ?? 3}
          required
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="bill-account">Pay from account</Label>
          <Select
            id="bill-account"
            name="accountId"
            value={accountId === "" ? "" : String(accountId)}
            onChange={(e) =>
              setAccountId(e.target.value ? Number(e.target.value) : "")
            }
            required
          >
            <option value="" disabled>
              Select account
            </option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="bill-category">Category</Label>
          <Select
            id="bill-category"
            name="categoryId"
            value={categoryId === "" ? "" : String(categoryId)}
            onChange={(e) =>
              setCategoryId(e.target.value ? Number(e.target.value) : "")
            }
            required
          >
            <option value="" disabled>
              Select category
            </option>
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
          <Label htmlFor="bill-subcategory">Subcategory (optional)</Label>
          <Select
            id="bill-subcategory"
            name="subcategoryId"
            defaultValue={bill?.subcategoryId ?? ""}
          >
            <option value="">None</option>
            {selectedCategory.children.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button type="submit" className="flex-1">
          {bill ? "Save changes" : "Add bill"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
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
