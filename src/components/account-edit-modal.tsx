"use client";

import { useEffect, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { saveAccount, deleteAccount } from "@/app/actions/accounts";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { Button, Input, Label, Modal, Select } from "@/components/ui";
import {
  AccountBrandIcon,
  CurrencyBadge,
} from "@/components/account-brand-icon";
import { TYPE_LABELS, type AccountRow } from "@/components/account-list";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Money } from "@/components/money";

export function AccountEditModal({
  account,
  open,
  onClose,
  defaultType = "checking",
}: {
  account: AccountRow | null;
  open: boolean;
  onClose: () => void;
  defaultType?: "checking" | "savings" | "cash";
}) {
  const [pending, startTransition] = useTransition();
  const [currency, setCurrency] = useState(account?.currency ?? "EUR");
  const [type, setType] = useState<"checking" | "savings" | "cash">(
    account?.type as "checking" | "savings" | "cash" | undefined ?? defaultType,
  );

  const initialBalance = account ? Number(account.balance.toFixed(2)) : 0;
  const [balanceInput, setBalanceInput] = useState<string>(
    account ? initialBalance.toString() : ""
  );
  const [interestRateInput, setInterestRateInput] = useState<string>(
    account?.interestRate != null ? String(account.interestRate) : "",
  );
  const [interestPeriod, setInterestPeriod] = useState<"month" | "day">(
    account?.interestPeriod ?? "month",
  );

  useEffect(() => {
    if (open) {
      setCurrency(account?.currency ?? "EUR");
      setType(
        (account?.type as "checking" | "savings" | "cash" | undefined) ??
          defaultType,
      );
      setBalanceInput(account ? Number(account.balance.toFixed(2)).toString() : "");
      setInterestRateInput(
        account?.interestRate != null ? String(account.interestRate) : "",
      );
      setInterestPeriod(account?.interestPeriod ?? "month");
    }
  }, [account, open, defaultType]);

  const isEditing = !!account;
  const parsedBalance = Number(balanceInput) || 0;
  const diff = isEditing ? parsedBalance - initialBalance : 0;

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await saveAccount(formData);
      onClose();
    });
  }

  function handleDelete(formData: FormData) {
    if (!confirm("Delete this account? Linked expenses will also be removed.")) {
      return;
    }
    startTransition(async () => {
      await deleteAccount(formData);
      onClose();
    });
  }

  const title = isEditing ? (
    <div className="flex items-center gap-4 py-1">
      <AccountBrandIcon
        name={account.name}
        type={account.type}
        currency={currency}
        size="lg"
      />
      <div className="min-w-0 flex-1 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight leading-tight">
            {account.name}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">
              {TYPE_LABELS[account.type] ?? account.type}
            </span>
            <CurrencyBadge currency={currency} />
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-semibold tabular-nums leading-tight">
            <Money amount={parsedBalance} currency={currency} />
          </p>
        </div>
      </div>
    </div>
  ) : (
    "New account"
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex items-center justify-between gap-3">
          {isEditing ? (
            <form action={handleDelete} className="flex flex-col items-start gap-1">
              <input type="hidden" name="id" value={account.id} />
              <button
                type="submit"
                disabled={pending}
                className="flex items-center text-xs font-medium text-loss/70 transition hover:text-loss disabled:opacity-50"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </button>
              {account.updatedAt && (
                <p className="text-[10px] text-muted-foreground">
                  Updated: {new Date(account.updatedAt).toLocaleString()}
                </p>
              )}
            </form>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-account-form"
              variant="primary"
              disabled={pending}
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      }
    >
      <form id="edit-account-form" action={handleSubmit} className="space-y-5">
        {isEditing && <input type="hidden" name="id" value={account.id} />}

        {!isEditing && (
          <div>
            <Label htmlFor="account-name">Name</Label>
            <Input
              id="account-name"
              name="name"
              defaultValue=""
              placeholder={
                type === "cash" ? "e.g. Liquide, Portefeuille, Caisse" : "Account name"
              }
              required
            />
          </div>
        )}
        {isEditing && <input type="hidden" name="name" value={account.name} />}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="account-type">Type</Label>
            <Select
              id="account-type"
              name="type"
              value={type}
              onChange={(e) =>
                setType(e.target.value as "checking" | "savings" | "cash")
              }
            >
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="cash">Cash (liquide)</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="account-currency">Currency</Label>
            <Select
              id="account-currency"
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="account-balance" className="flex items-center justify-between gap-2">
              <span>Balance</span>
              {isEditing && diff !== 0 && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-colors whitespace-nowrap",
                  diff > 0 ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss"
                )}>
                  <Money>
                    {diff > 0 ? "+" : ""}
                    {formatMoney(diff, currency)}
                  </Money>
                </span>
              )}
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {currency}
              </span>
              <Input
                id="account-balance"
                name="balance"
                type="number"
                step="0.01"
                value={balanceInput}
                onChange={(e) => setBalanceInput(e.target.value)}
                required
                className="pl-12"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="account-note">Note (optional)</Label>
            <Input
              id="account-note"
              name="note"
              defaultValue={account?.note ?? ""}
              placeholder={
                type === "cash"
                  ? "e.g. at home, travel wallet"
                  : "e.g. main daily account"
              }
            />
          </div>
        </div>

        {type === "savings" && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="account-interest-rate">
                Interest rate (annual %)
              </Label>
              <Input
                id="account-interest-rate"
                name="interestRate"
                type="number"
                step="0.01"
                min="0"
                value={interestRateInput}
                onChange={(e) => setInterestRateInput(e.target.value)}
                placeholder="e.g. 2.50"
              />
            </div>
            <div>
              <Label htmlFor="account-interest-period">Accrual</Label>
              <Select
                id="account-interest-period"
                name="interestPeriod"
                value={interestPeriod}
                onChange={(e) =>
                  setInterestPeriod(e.target.value as "month" | "day")
                }
              >
                <option value="month">Monthly (credited at month end)</option>
                <option value="day">Daily (credited each day)</option>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {interestPeriod === "day"
                  ? "Daily interest uses balance × rate ÷ 365 and is credited for each elapsed day."
                  : "Monthly interest uses balance × rate ÷ 12 and is credited at the end of each month."}
              </p>
            </div>
          </div>
        )}

        {!isEditing && type === "cash" && (
          <p className="rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Physical cash is tracked here. It counts toward your net worth and
            the Cash total on the dashboard, alongside your bank accounts.
          </p>
        )}
      </form>
    </Modal>
  );
}
