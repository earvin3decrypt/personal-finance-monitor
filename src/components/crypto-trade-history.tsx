"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CryptoIcon } from "@/components/crypto-icon";
import type { CryptoTradeRow } from "@/lib/crypto-trades";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Money } from "@/components/money";

export function CryptoTradeHistory({ trades }: { trades: CryptoTradeRow[] }) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Trade history
        </h2>
        <Link
          href="/expenses"
          className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
        >
          All operations
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {trades.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No buy or sell trades yet. Use Buy or Sell above to record your first
          trade.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {trades.map((trade) => (
            <li
              key={trade.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      trade.side === "buy"
                        ? "bg-loss/10 text-loss"
                        : "bg-gain/10 text-gain",
                    )}
                  >
                    {trade.side}
                  </span>
                  <CryptoIcon symbol={trade.symbol} size="sm" />
                  <span className="text-xs font-semibold text-muted-foreground">
                    {trade.symbol}
                  </span>
                  {trade.quantity && (
                    <span className="text-sm text-muted-foreground">
                      {trade.quantity}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(trade.date)} · {trade.accountName}
                </p>
              </div>
              <p
                className={cn(
                  "shrink-0 tabular-nums font-medium",
                  trade.side === "buy" ? "text-foreground" : "text-gain",
                )}
              >
                <Money>
                  {trade.side === "buy" ? "−" : "+"}
                  {formatMoney(trade.amount, trade.currency)}
                </Money>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
