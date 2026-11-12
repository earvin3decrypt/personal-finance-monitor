"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { deleteHolding } from "@/app/actions/holdings";
import {
  deleteHoldingTrade,
  setHoldingPurchaseDate,
  updateHoldingTradeDate,
} from "@/app/actions/holding-trades";
import {
  buildHoldingTradeSummary,
  lotMetrics,
  type HoldingTradeRow,
} from "@/lib/holding-trade-metrics";
import type { HoldingWithMetrics } from "@/lib/portfolio";
import { todayISO } from "@/lib/format";
import { Button, Input, Label, PlValue } from "@/components/ui";
import { HoldingTradeModal } from "@/components/holding-trade-modal";
import { Money } from "@/components/money";

type AccountOption = { id: number; name: string; currency: string };

export function HoldingDetailPanel({
  holding,
  trades,
  accounts,
}: {
  holding: HoldingWithMetrics;
  trades: HoldingTradeRow[];
  accounts: AccountOption[];
}) {
  const [tradeOpen, setTradeOpen] = useState(false);
  const [pendingDate, startDateTransition] = useTransition();
  const [pendingDelete, startDeleteTransition] = useTransition();
  const price = holding.currentPrice;
  const summary = buildHoldingTradeSummary(
    trades,
    holding.quantity,
    holding.costBasis,
    price,
  );
  const firstBuyDate =
    trades
      .filter((t) => t.side === "buy")
      .map((t) => t.date)
      .sort()[0] ?? todayISO();

  function handlePurchaseDate(formData: FormData) {
    startDateTransition(async () => {
      await setHoldingPurchaseDate(formData);
    });
  }

  function handleDeleteHolding(formData: FormData) {
    if (
      !confirm(
        `Delete holding “${holding.symbol}”? This also removes its trade history.`,
      )
    ) {
      return;
    }
    startDeleteTransition(async () => {
      await deleteHolding(formData);
    });
  }

  return (
    <div
      className="rounded-xl bg-muted/20 px-4 py-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <form
          action={handlePurchaseDate}
          className="flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="holdingId" value={holding.id} />
          <div className="min-w-[10rem]">
            <Label htmlFor={`holding-purchase-${holding.id}`}>
              First purchase
            </Label>
            <Input
              key={`purchase-${holding.id}-${firstBuyDate}`}
              id={`holding-purchase-${holding.id}`}
              name="date"
              type="date"
              defaultValue={firstBuyDate}
              required
              className="h-9"
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            className="h-9"
            disabled={pendingDate}
          >
            {pendingDate ? "Saving…" : "Save"}
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" className="h-9" onClick={() => setTradeOpen(true)}>
            <Plus className="h-4 w-4" />
            Record buy
          </Button>
          <form action={handleDeleteHolding}>
            <input type="hidden" name="id" value={holding.id} />
            <button
              type="submit"
              disabled={pendingDelete}
              className="rounded-md px-2 py-1.5 text-xs font-medium text-loss/80 transition hover:text-loss disabled:opacity-50"
            >
              Delete holding
            </button>
          </form>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap divide-x divide-border/70 rounded-lg border border-border/60 bg-card/60">
        <CompactStat
          label="Total cost"
          value={
            <Money amount={summary.totalCost} currency={holding.currency} />
          }
        />
        <CompactStat
          label="Avg purchase"
          value={
            <Money amount={summary.avgCost} currency={holding.currency} />
          }
        />
        <CompactStat
          label="Market value"
          value={
            summary.marketValue != null ? (
              <Money
                amount={summary.marketValue}
                currency={holding.currency}
              />
            ) : (
              "—"
            )
          }
        />
        <CompactStat
          label="Total gains"
          value={
            summary.totalGains != null ? (
              <PlValue
                value={summary.totalGains}
                percent={summary.totalGainsPercent}
              />
            ) : (
              "—"
            )
          }
        />
        <CompactStat
          label="Transactions"
          value={String(summary.transactionCount)}
        />
      </div>

      {trades.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No trades yet. Record a buy to build history.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Date</th>
                <th className="pb-2 pr-3 font-medium">Side</th>
                <th className="pb-2 pr-3 text-right font-medium">Unit price</th>
                <th className="pb-2 pr-3 text-right font-medium">Qty</th>
                <th className="pb-2 pr-3 text-right font-medium">Total</th>
                <th className="pb-2 pr-3 text-right font-medium">Lot value</th>
                <th className="pb-2 pr-3 text-right font-medium">Gain</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => {
                const metrics = lotMetrics(trade, price);
                return (
                  <tr key={trade.id} className="border-b border-border/40">
                    <td className="py-2 pr-3">
                      <form action={updateHoldingTradeDate} className="flex">
                        <input type="hidden" name="id" value={trade.id} />
                        <Input
                          name="date"
                          type="date"
                          defaultValue={trade.date}
                          className="h-8 w-[9.5rem] px-2 text-xs"
                          onChange={(e) =>
                            e.currentTarget.form?.requestSubmit()
                          }
                          aria-label="Trade date"
                        />
                      </form>
                    </td>
                    <td className="py-2 pr-3 capitalize text-muted-foreground">
                      {trade.side}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      <Money
                        amount={trade.unitPrice}
                        currency={trade.currency}
                      />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {trade.quantity}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      <Money
                        amount={trade.totalAmount}
                        currency={trade.currency}
                      />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {metrics.lotValue != null ? (
                        <Money
                          amount={metrics.lotValue}
                          currency={holding.currency}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {metrics.lotGains != null ? (
                        <PlValue
                          value={metrics.lotGains}
                          percent={metrics.lotGainsPercent}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <form action={deleteHoldingTrade}>
                        <input type="hidden" name="id" value={trade.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-loss"
                          aria-label="Delete trade"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tradeOpen && (
        <HoldingTradeModal
          holding={holding}
          accounts={accounts}
          open={tradeOpen}
          onClose={() => setTradeOpen(false)}
        />
      )}
    </div>
  );
}

function CompactStat({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-[7.5rem] flex-1 px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
