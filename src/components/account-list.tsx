"use client";

import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";
import {
  AccountBrandIcon,
  CurrencyBadge,
} from "@/components/account-brand-icon";
import { Money } from "@/components/money";

export const TYPE_LABELS: Record<string, string> = {
  checking: "Checking Accounts",
  savings: "Savings Accounts",
  cash: "Cash & Wallets",
};

export const TYPE_DOT_COLOR: Record<string, string> = {
  checking: "bg-[#3B82F6]",
  savings: "bg-emerald-500",
  cash: "bg-amber-500",
};

export type AccountRow = {
  id: number;
  name: string;
  type: string;
  currency: string;
  balance: number;
  balanceBase: number;
  note: string | null;
  interestRate: number | null;
  interestPeriod: "month" | "day";
  updatedAt: string;
  change30dPercent?: number | null;
  lastActivityDate?: string | null;
};

function formatChange30d(value: number | null | undefined): {
  text: string;
  className: string;
} {
  if (value == null || Number.isNaN(value)) {
    return { text: "—", className: "text-muted-foreground" };
  }
  if (Math.abs(value) < 0.05) {
    return { text: "0.0%", className: "text-muted-foreground" };
  }
  const positive = value > 0;
  return {
    text: `${positive ? "+" : ""}${value.toFixed(1)}%`,
    className: positive ? "text-gain" : "text-loss",
  };
}

function AccountDetailsRow({
  account,
  baseCurrency,
  allocationPercent,
  onEdit,
}: {
  account: AccountRow;
  baseCurrency: string;
  allocationPercent: number;
  onEdit: (account: AccountRow) => void;
}) {
  const showConversion = account.currency !== baseCurrency;
  const change30d = formatChange30d(account.change30dPercent);

  return (
    <li>
      <button
        type="button"
        onClick={() => onEdit(account)}
        className="group grid w-full grid-cols-1 gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/60 sm:grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1fr)_auto_auto_auto_auto] sm:items-center sm:gap-4 sm:px-5 sm:py-4"
      >
        {/* Column 1: Logo */}
        <div className="flex items-center gap-3 sm:block">
          <AccountBrandIcon
            name={account.name}
            type={account.type}
            currency={account.currency}
          />
          <div className="min-w-0 sm:hidden">
            <p className="truncate text-[15px] font-semibold text-foreground">
              {account.name}
            </p>
            <div className="mt-1">
              <CurrencyBadge currency={account.currency} />
              {account.interestRate != null && account.interestRate > 0 && (
                <span className="ml-2 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium tabular-nums text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {account.interestRate.toFixed(2)}% APY
                  {account.interestPeriod === "day" ? " · Daily" : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Account details (desktop) */}
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-[15px] font-semibold text-foreground">
            {account.name}
          </p>
          {account.note && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {account.note}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <CurrencyBadge currency={account.currency} />
            {account.interestRate != null && account.interestRate > 0 && (
              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium tabular-nums text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                {account.interestRate.toFixed(2)}% APY
                {account.interestPeriod === "day" ? " · Daily" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Column 3: Portfolio allocation */}
        <div className="min-w-0">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            Portfolio allocation (%)
          </p>
          <div className="flex items-center gap-2.5">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{
                  width: `${Math.max(0, Math.min(100, allocationPercent))}%`,
                }}
              />
            </div>
            <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
              {Math.abs(allocationPercent) < 0.05
                ? "0.0"
                : allocationPercent.toFixed(1)}
              %
            </span>
          </div>
        </div>

        {/* Column 4: Balance */}
        <div className="text-left sm:min-w-[7.5rem] sm:text-right">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground sm:hidden">
            Balance
          </p>
          <p className="text-[17px] font-bold tabular-nums tracking-tight text-foreground">
            <Money amount={account.balance} currency={account.currency} />
          </p>
          {showConversion && (
            <p className="mt-0.5 text-[13px] tabular-nums text-muted-foreground">
              <Money>
                ≈ {formatMoney(account.balanceBase, baseCurrency)}
              </Money>
            </p>
          )}
        </div>

        {/* Column 5: 30D */}
        <div className="text-left sm:min-w-[4.5rem] sm:text-center">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            30D
          </p>
          <p
            className={cn(
              "text-[15px] font-semibold tabular-nums tracking-tight",
              change30d.className,
            )}
          >
            {change30d.text}
          </p>
        </div>

        {/* Column 6: Last activity */}
        <div className="text-left sm:min-w-[6.5rem] sm:text-right">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            Last activity
          </p>
          <p className="text-[13px] tabular-nums text-muted-foreground">
            {account.lastActivityDate
              ? formatDate(account.lastActivityDate)
              : "—"}
          </p>
        </div>

        {/* Column 7: Edit */}
        <div className="flex justify-end sm:justify-center">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/50 transition group-hover:bg-muted group-hover:text-muted-foreground">
            <Pencil className="h-4 w-4" strokeWidth={1.75} />
          </span>
        </div>
      </button>
    </li>
  );
}

/** List container matching design: gradient backdrop + frosted card + multi-column rows. */
export function AccountDetailsList({
  accounts,
  baseCurrency,
  onEdit,
}: {
  accounts: AccountRow[];
  baseCurrency: string;
  onEdit: (account: AccountRow) => void;
}) {
  if (accounts.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">No accounts yet.</p>
    );
  }

  const overallTotalBase = Math.max(
    accounts.reduce(
      (sum, a) => sum + (a.balanceBase > 0 ? a.balanceBase : 0),
      0,
    ),
    1,
  );

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#FFF7ED] via-[#FFFBEB]/40 to-[#EFF6FF] p-1 dark:from-amber-950/40 dark:via-card dark:to-blue-950/40 sm:p-1.5">
      <div className="overflow-hidden rounded-[14px] border border-white/60 bg-white/95 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm dark:border-border dark:bg-card dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <ul className="divide-y divide-border">
          {accounts.map((account) => {
            const allocationPercent =
              (account.balanceBase / overallTotalBase) * 100;
            return (
              <AccountDetailsRow
                key={account.id}
                account={account}
                baseCurrency={baseCurrency}
                allocationPercent={allocationPercent}
                onEdit={onEdit}
              />
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function AccountList({
  accounts,
  baseCurrency,
  onEdit,
}: {
  accounts: AccountRow[];
  baseCurrency: string;
  onEdit: (account: AccountRow) => void;
}) {
  if (accounts.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No accounts yet.
      </p>
    );
  }

  const grouped = accounts.reduce(
    (acc, account) => {
      if (!acc[account.type]) acc[account.type] = [];
      acc[account.type].push(account);
      return acc;
    },
    {} as Record<string, AccountRow[]>,
  );

  const order = ["checking", "savings", "cash"];
  const sortedTypes = Object.keys(grouped).sort(
    (a, b) => order.indexOf(a) - order.indexOf(b),
  );

  return (
    <div className="space-y-8">
      {sortedTypes.map((type) => {
        const sectionAccounts = grouped[type];
        const sectionTotalBase = sectionAccounts.reduce(
          (sum, account) => sum + account.balanceBase,
          0,
        );

        return (
          <section key={type}>
            <div className="mb-3 flex items-end justify-between gap-4 px-1">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    TYPE_DOT_COLOR[type] ?? "bg-muted-foreground",
                  )}
                  aria-hidden
                />
                <h2 className="text-sm font-semibold text-foreground">
                  {TYPE_LABELS[type] ?? type}
                </h2>
              </div>
              <p className="text-sm tabular-nums text-muted-foreground">
                <Money amount={sectionTotalBase} currency={baseCurrency} />
              </p>
            </div>
            <AccountDetailsList
              accounts={sectionAccounts}
              baseCurrency={baseCurrency}
              onEdit={onEdit}
            />
          </section>
        );
      })}
    </div>
  );
}
