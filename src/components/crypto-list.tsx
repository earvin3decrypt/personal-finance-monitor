"use client";

import { Pencil } from "lucide-react";
import { CryptoIcon } from "@/components/crypto-icon";
import type { CryptoWithMetrics } from "@/lib/portfolio";
import { formatMoney } from "@/lib/format";
import { Button, PlValue } from "@/components/ui";
import { Money } from "@/components/money";

export type CryptoRow = CryptoWithMetrics & { updatedAt?: string };

export function CryptoList({
  holdings,
  baseCurrency,
  onEdit,
  onBuy,
  onSell,
}: {
  holdings: CryptoRow[];
  baseCurrency: string;
  onEdit: (row: CryptoRow) => void;
  onBuy?: (row: CryptoRow) => void;
  onSell?: (row: CryptoRow) => void;
}) {
  const totalBase = holdings.reduce(
    (sum, h) => sum + (h.marketValueBase ?? 0),
    0,
  );

  if (holdings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No crypto holdings yet. Buy or add Bitcoin, Ethereum, or any coin to
        track it here.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {holdings.map((h) => {
        const share =
          totalBase > 0 && h.marketValueBase != null
            ? (h.marketValueBase / totalBase) * 100
            : 0;

        return (
          <li
            key={h.id}
            className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <CryptoIcon symbol={h.symbol} />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {h.symbol}
                    </span>
                    <span className="truncate font-medium">{h.name}</span>
                  </div>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {h.quantity}{" "}
                {h.currentPrice != null ? (
                  <Money>
                    ·{" "}
                    {formatMoney(
                      h.currentPrice,
                      h.priceCurrency ?? h.currency,
                    )}
                  </Money>
                ) : (
                  "· price unavailable"
                )}
              </p>
              {totalBase > 0 && h.marketValueBase != null && (
                <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-amber-500/70"
                    style={{ width: `${Math.max(share, 2)}%` }}
                  />
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="mr-1 text-right">
                <p className="font-medium tabular-nums">
                  {h.marketValueBase != null ? (
                    <Money
                      amount={h.marketValueBase}
                      currency={baseCurrency}
                    />
                  ) : (
                    "—"
                  )}
                </p>
                {h.pl != null && (
                  <div className="text-xs">
                    <PlValue value={h.pl} percent={h.plPercent} />
                  </div>
                )}
              </div>
              {onBuy && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-2 text-xs"
                  onClick={() => onBuy(h)}
                >
                  Buy
                </Button>
              )}
              {onSell && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-2 text-xs"
                  onClick={() => onSell(h)}
                >
                  Sell
                </Button>
              )}
              <button
                type="button"
                onClick={() => onEdit(h)}
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label={`Edit ${h.symbol}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
