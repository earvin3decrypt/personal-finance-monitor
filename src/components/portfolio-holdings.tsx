"use client";

import { useEffect, useState } from "react";
import { deleteHolding } from "@/app/actions/holdings";
import type { HoldingTradeRow } from "@/lib/holding-trade-metrics";
import type { HoldingWithMetrics } from "@/lib/portfolio";
import { Button, PlValue } from "@/components/ui";
import { HoldingDetailPanel } from "@/components/holding-detail-panel";
import { Money } from "@/components/money";
import { cn } from "@/lib/utils";

type AccountOption = { id: number; name: string; currency: string };

export function PortfolioHoldingsTable({
  holdings,
  tradesByHolding,
  accounts,
  baseCurrency,
  investmentsMarketValueBase,
  dividendsTotalBase,
  investmentsTotalBase,
}: {
  holdings: HoldingWithMetrics[];
  tradesByHolding: Record<number, HoldingTradeRow[]>;
  accounts: AccountOption[];
  baseCurrency: string;
  investmentsMarketValueBase: number;
  dividendsTotalBase: number;
  investmentsTotalBase: number;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = holdings.find((h) => h.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId != null && !holdings.some((h) => h.id === selectedId)) {
      setSelectedId(null);
    }
  }, [holdings, selectedId]);

  if (holdings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No holdings yet.</p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="pb-2 pr-4">Symbol</th>
              <th className="pb-2 pr-4">Qty</th>
              <th className="pb-2 pr-4 text-right">Avg cost</th>
              <th className="pb-2 pr-4 text-right">Price</th>
              <th className="pb-2 pr-4 text-right">Market value</th>
              <th className="pb-2 pr-4 text-right">P/L</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const hasTrades = (tradesByHolding[h.id]?.length ?? 0) > 0;
              const isSelected = selectedId === h.id;
              return (
                <tr
                  key={h.id}
                  className={cn(
                    "border-b border-border/60 cursor-pointer transition hover:bg-muted/40",
                    isSelected && "bg-muted/50",
                  )}
                  onClick={() =>
                    setSelectedId((current) =>
                      current === h.id ? null : h.id,
                    )
                  }
                >
                  <td className="py-3 pr-4">
                    <p className="font-medium">{h.symbol}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.name}
                      {hasTrades && (
                        <span className="ml-1.5 text-primary">
                          · {tradesByHolding[h.id].length} trades
                        </span>
                      )}
                    </p>
                  </td>
                  <td className="py-3 pr-4 tabular-nums">{h.quantity}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    <Money amount={h.costBasis} currency={h.currency} />
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {h.currentPrice != null ? (
                      <Money
                        amount={h.currentPrice}
                        currency={h.priceCurrency ?? h.currency}
                      />
                    ) : (
                      "—"
                    )}
                    {h.priceStale && h.currentPrice != null && (
                      <span className="ml-1 text-xs text-amber-600">*</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {h.marketValueBase != null ? (
                      <Money
                        amount={h.marketValueBase}
                        currency={baseCurrency}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    <PlValue value={h.pl} percent={h.plPercent} />
                  </td>
                  <td
                    className="py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <form action={deleteHolding}>
                      <input type="hidden" name="id" value={h.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        className="text-xs text-loss"
                      >
                        Delete
                      </Button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <td colSpan={4} className="pt-4 text-muted-foreground">
                Market value
              </td>
              <td className="pt-4 text-right tabular-nums">
                <Money
                  amount={investmentsMarketValueBase}
                  currency={baseCurrency}
                />
              </td>
              <td colSpan={2} />
            </tr>
            {dividendsTotalBase > 0 && (
              <tr>
                <td colSpan={4} className="pt-2 text-muted-foreground">
                  + Dividends (see below)
                </td>
                <td className="pt-2 text-right tabular-nums text-gain">
                  <Money
                    amount={dividendsTotalBase}
                    currency={baseCurrency}
                  />
                </td>
                <td colSpan={2} />
              </tr>
            )}
            <tr>
              <td colSpan={4} className="pt-4 font-medium">
                Total ({baseCurrency})
              </td>
              <td className="pt-4 text-right font-semibold tabular-nums">
                <Money
                  amount={investmentsTotalBase}
                  currency={baseCurrency}
                />
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {!selected && holdings.length > 0 && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Select a holding to view trade history
        </p>
      )}

      {selected && (
        <HoldingDetailPanel
          holding={selected}
          trades={tradesByHolding[selected.id] ?? []}
          accounts={accounts}
        />
      )}
    </>
  );
}
