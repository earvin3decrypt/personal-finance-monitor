"use client";

import { useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { deleteHoldingTrade } from "@/app/actions/holding-trades";
import {
  buildHoldingTradeSummary,
  lotMetrics,
  type HoldingTradeRow,
} from "@/lib/holding-trade-metrics";
import type { HoldingWithMetrics } from "@/lib/portfolio";
import { formatDate } from "@/lib/format";
import { Button, Card, PlValue } from "@/components/ui";
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
  const price = holding.currentPrice;
  const summary = buildHoldingTradeSummary(
    trades,
    holding.quantity,
    holding.costBasis,
    price,
  );

  return (
    <Card className="mt-4 border-primary/20 bg-muted/20">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{holding.symbol}</h3>
          <p className="text-sm text-muted-foreground">{holding.name}</p>
        </div>
        <Button type="button" onClick={() => setTradeOpen(true)}>
          <Plus className="h-4 w-4" />
          Record buy
        </Button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryStat
          label="Shares"
          value={String(summary.shares)}
        />
        <SummaryStat
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
        <SummaryStat
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
        <SummaryStat
          label="Total cost"
          value={
            <Money amount={summary.totalCost} currency={holding.currency} />
          }
        />
        <SummaryStat
          label="Avg purchase"
          value={
            <Money amount={summary.avgCost} currency={holding.currency} />
          }
        />
        <SummaryStat
          label="Transactions"
          value={String(summary.transactionCount)}
        />
      </div>

      {trades.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No trades recorded. Add buy history or use the form above to record
          future purchases.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Side</th>
                <th className="pb-2 pr-4 text-right">Unit price</th>
                <th className="pb-2 pr-4 text-right">Qty</th>
                <th className="pb-2 pr-4 text-right">Total</th>
                <th className="pb-2 pr-4 text-right">Lot value</th>
                <th className="pb-2 pr-4 text-right">Gain</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => {
                const metrics = lotMetrics(trade, price);
                return (
                  <tr key={trade.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-4 tabular-nums">
                      {formatDate(trade.date)}
                    </td>
                    <td className="py-2.5 pr-4 capitalize">{trade.side}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      <Money
                        amount={trade.unitPrice}
                        currency={trade.currency}
                      />
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {trade.quantity}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      <Money
                        amount={trade.totalAmount}
                        currency={trade.currency}
                      />
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {metrics.lotValue != null ? (
                        <Money
                          amount={metrics.lotValue}
                          currency={holding.currency}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {metrics.lotGains != null ? (
                        <PlValue
                          value={metrics.lotGains}
                          percent={metrics.lotGainsPercent}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 text-right">
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
    </Card>
  );
}

function SummaryStat({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium tabular-nums">{value}</p>
    </div>
  );
}
