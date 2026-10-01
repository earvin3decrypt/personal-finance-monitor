"use client";

import { useState } from "react";
import { ArrowRight, Pencil, Trash2 } from "lucide-react";
import { deleteTransfer } from "@/app/actions/accounts";
import { Card } from "@/components/ui";
import type { TransferHistoryRow } from "@/lib/transfers";
import { formatDate, formatMoney } from "@/lib/format";
import { Money } from "@/components/money";

const INITIAL_COUNT = 3;
const PAGE_SIZE = 10;

export function AccountTransferHistory({
  transfers,
  onEdit,
}: {
  transfers: TransferHistoryRow[];
  onEdit: (transfer: TransferHistoryRow) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const visible = transfers.slice(0, visibleCount);
  const remaining = transfers.length - visibleCount;
  const hasMore = remaining > 0;
  const nextBatch = Math.min(PAGE_SIZE, remaining);

  return (
    <Card className="mt-8">
      <h2 className="mb-1 text-sm font-medium text-muted-foreground">
        Recent transfers
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Account-to-account moves. These do not appear in expenses or income.
      </p>

      {transfers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No transfers yet. Use Transfer to move money between accounts.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {visible.map((t) => {
              const sameCurrency = t.sentCurrency === t.receivedCurrency;
              const sameAmount =
                sameCurrency && t.sentAmount === t.receivedAmount;

              return (
                <li
                  key={t.id}
                  className="group flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{t.fromAccountName}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{t.toAccountName}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(t.date)}
                      {t.note ? ` · ${t.note}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    <div className="text-right tabular-nums">
                      <p className="text-sm font-medium">
                        <Money>
                          −{formatMoney(t.sentAmount, t.sentCurrency)}
                        </Money>
                      </p>
                      {!sameAmount && (
                        <p className="text-sm font-medium text-gain">
                          <Money>
                            +
                            {formatMoney(
                              t.receivedAmount,
                              t.receivedCurrency,
                            )}
                          </Money>
                        </p>
                      )}
                      {sameAmount && (
                        <p className="text-xs text-muted-foreground">
                          <Money>
                            +
                            {formatMoney(
                              t.receivedAmount,
                              t.receivedCurrency,
                            )}
                          </Money>
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onEdit(t)}
                      className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                      title="Edit transfer"
                      aria-label="Edit transfer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <form action={deleteTransfer}>
                      <input type="hidden" name="id" value={t.id} />
                      <button
                        type="submit"
                        className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-loss group-hover:opacity-100 focus:opacity-100"
                        title="Delete transfer"
                        aria-label="Delete transfer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
          {(hasMore || visibleCount > INITIAL_COUNT) && (
            <div className="mt-2 flex flex-col gap-1">
              {hasMore && (
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((n) => Math.min(n + PAGE_SIZE, transfers.length))
                  }
                  className="w-full rounded-xl py-2 text-sm font-medium text-primary transition hover:bg-muted/60"
                >
                  Show {nextBatch} more
                </button>
              )}
              {visibleCount > INITIAL_COUNT && (
                <button
                  type="button"
                  onClick={() => setVisibleCount(INITIAL_COUNT)}
                  className="w-full rounded-xl py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/60"
                >
                  Show less
                </button>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
