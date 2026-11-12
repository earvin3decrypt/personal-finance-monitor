"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Plus } from "lucide-react";
import type { HoldingTradeRow } from "@/lib/holding-trade-metrics";
import type { HoldingWithMetrics } from "@/lib/portfolio";
import { AddHoldingModal } from "@/components/add-holding-modal";
import { HoldingDetailPanel } from "@/components/holding-detail-panel";
import { Button } from "@/components/ui";
import { Money } from "@/components/money";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type AccountOption = { id: number; name: string; currency: string };

const ALLOCATION_COLORS = [
  "oklch(0.72 0.16 55)",
  "oklch(0.58 0.12 250)",
  "oklch(0.72 0.08 230)",
  "oklch(0.65 0.14 145)",
  "oklch(0.68 0.12 30)",
  "oklch(0.62 0.1 290)",
];

function allocationColor(index: number): string {
  return ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]!;
}

function symbolInitials(symbol: string): string {
  const clean = symbol.replace(/[^A-Za-z0-9]/g, "");
  return (clean.slice(0, 2) || symbol.slice(0, 2)).toUpperCase();
}

function formatSignedMoney(amount: number, currency: string): string {
  const formatted = formatMoney(Math.abs(amount), currency);
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `−${formatted}`;
  return formatted;
}

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
  byCurrency?: Record<string, number>;
  investmentsMarketValueBase: number;
  dividendsTotalBase: number;
  investmentsTotalBase: number;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterIds, setFilterIds] = useState<number[]>([]);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    const ids = new Set(holdings.map((h) => h.id));
    if (expandedId != null && !ids.has(expandedId)) {
      setExpandedId(null);
    }
    setFilterIds((current) => {
      const next = current.filter((id) => ids.has(id));
      return next.length === current.length ? current : next;
    });
  }, [holdings, expandedId]);

  const invested = useMemo(
    () => holdings.reduce((sum, h) => sum + h.costTotalBase, 0),
    [holdings],
  );
  const unrealizedPl = investmentsMarketValueBase - invested;
  const totalReturnPercent =
    invested > 0 ? ((investmentsTotalBase - invested) / invested) * 100 : null;

  const rows = useMemo(() => {
    return holdings.map((h, index) => {
      const weight =
        investmentsMarketValueBase > 0 && h.marketValueBase != null
          ? (h.marketValueBase / investmentsMarketValueBase) * 100
          : 0;
      return {
        holding: h,
        color: allocationColor(index),
        weight,
      };
    });
  }, [holdings, investmentsMarketValueBase]);

  const legend = useMemo(
    () => [...rows].sort((a, b) => b.weight - a.weight),
    [rows],
  );

  const filterActive = filterIds.length > 0;
  const filterSet = useMemo(() => new Set(filterIds), [filterIds]);

  const visibleRows = useMemo(() => {
    if (!filterActive) return rows;
    return rows.filter((row) => filterSet.has(row.holding.id));
  }, [rows, filterActive, filterSet]);

  const currencyBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of holdings) {
      if (h.marketValueBase == null) continue;
      const key = h.priceCurrency ?? h.currency;
      map.set(key, (map.get(key) ?? 0) + h.marketValueBase);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [holdings]);

  function toggleFilter(id: number) {
    setFilterIds((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id],
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          Holdings
          {holdings.length > 0 && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {holdings.length}
            </span>
          )}
        </h2>
        <Button type="button" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add holding
        </Button>
      </div>

      {holdings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No holdings yet. Add a stock or ETF to start tracking.
        </p>
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                <Money
                  amount={investmentsTotalBase}
                  currency={baseCurrency}
                />
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {totalReturnPercent != null && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                      totalReturnPercent >= 0
                        ? "bg-gain/15 text-gain"
                        : "bg-loss/15 text-loss",
                    )}
                  >
                    {formatPercent(totalReturnPercent)}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  total return incl. dividends
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 sm:gap-6">
              <SummaryMetric
                label="Invested"
                value={
                  <Money amount={invested} currency={baseCurrency} />
                }
              />
              <SummaryMetric
                label="Unrealized P/L"
                value={
                  <span
                    className={cn(
                      "tabular-nums",
                      unrealizedPl >= 0 ? "text-gain" : "text-loss",
                    )}
                  >
                    <Money>
                      {formatSignedMoney(unrealizedPl, baseCurrency)}
                    </Money>
                  </span>
                }
              />
              <SummaryMetric
                label="Dividends"
                value={
                  <span
                    className={cn(
                      "tabular-nums",
                      dividendsTotalBase > 0 && "text-gain",
                    )}
                  >
                    <Money>
                      {dividendsTotalBase > 0
                        ? formatSignedMoney(dividendsTotalBase, baseCurrency)
                        : formatMoney(0, baseCurrency)}
                    </Money>
                  </span>
                }
              />
            </div>
          </div>

          {investmentsMarketValueBase > 0 && (
            <div className="mb-6" onMouseLeave={() => setHoveredId(null)}>
              <div className="flex h-3 items-end overflow-hidden rounded-full bg-muted">
                {legend.map(({ holding, color, weight }) => {
                  if (weight <= 0) return null;
                  const hovered = hoveredId === holding.id;
                  const filtered = filterSet.has(holding.id);
                  const dimmed =
                    (hoveredId != null && !hovered) ||
                    (filterActive && !filtered);
                  return (
                    <button
                      key={holding.id}
                      type="button"
                      aria-pressed={filtered}
                      aria-label={`${holding.symbol}, ${weight.toFixed(1)}%`}
                      title={`${holding.symbol} ${weight.toFixed(1)}%`}
                      className={cn(
                        "min-w-0 origin-bottom rounded-none transition-[opacity,height,transform] duration-200 first:rounded-l-full last:rounded-r-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        hovered ? "h-3.5" : "h-3",
                        dimmed ? "opacity-35" : "opacity-100",
                        filtered && "ring-1 ring-inset ring-foreground/30",
                      )}
                      style={{
                        width: `${Math.max(weight, 0.4)}%`,
                        backgroundColor: color,
                      }}
                      onMouseEnter={() => setHoveredId(holding.id)}
                      onFocus={() => setHoveredId(holding.id)}
                      onBlur={() => setHoveredId(null)}
                      onClick={() => toggleFilter(holding.id)}
                    />
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {legend.map(({ holding, color, weight }) => {
                  const hovered = hoveredId === holding.id;
                  const filtered = filterSet.has(holding.id);
                  const dimmed =
                    (hoveredId != null && !hovered) ||
                    (filterActive && !filtered);
                  return (
                    <button
                      key={holding.id}
                      type="button"
                      aria-pressed={filtered}
                      aria-label={`${holding.symbol}, ${weight.toFixed(1)}%`}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-1 py-0.5 text-xs transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        dimmed ? "opacity-40" : "opacity-100",
                        hovered || filtered
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                      onMouseEnter={() => setHoveredId(holding.id)}
                      onFocus={() => setHoveredId(holding.id)}
                      onBlur={() => setHoveredId(null)}
                      onClick={() => toggleFilter(holding.id)}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          "font-medium",
                          (hovered || filtered) && "text-foreground",
                        )}
                      >
                        {holding.symbol}
                      </span>
                      <span className="tabular-nums">
                        {weight.toFixed(1)}%
                      </span>
                    </button>
                  );
                })}
                {filterActive && (
                  <button
                    type="button"
                    onClick={() => setFilterIds([])}
                    className="rounded-md text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    Show all
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2.5 pr-4">Holding</th>
                  <th className="pb-2.5 pr-4 text-right">Qty</th>
                  <th className="pb-2.5 pr-4 text-right">Avg cost / Price</th>
                  <th className="pb-2.5 pr-4 text-right">Value</th>
                  <th className="pb-2.5 text-right">P/L</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(({ holding: h, color }) => {
                  const trades = tradesByHolding[h.id] ?? [];
                  const firstBuyDate = trades
                    .filter((t) => t.side === "buy")
                    .map((t) => t.date)
                    .sort()[0];
                  const isExpanded = expandedId === h.id;
                  const isHovered = hoveredId === h.id;
                  const typeLabel =
                    h.assetType === "etf"
                      ? "ETF"
                      : h.assetType === "stock"
                        ? "Stock"
                        : h.assetType;
                  const priceCurrency = h.priceCurrency ?? h.currency;

                  return (
                    <Fragment key={h.id}>
                      <tr
                        className={cn(
                          "cursor-pointer border-b border-border/50 transition-colors duration-150 hover:bg-muted/40",
                          isExpanded && "bg-muted/40",
                          isHovered && !isExpanded && "bg-muted/30",
                        )}
                        onMouseEnter={() => setHoveredId(h.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        onClick={() =>
                          setExpandedId((current) =>
                            current === h.id ? null : h.id,
                          )
                        }
                      >
                        <td className="py-3.5 pr-4">
                          <div className="flex items-start gap-3">
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold tracking-wide text-white"
                              style={{ backgroundColor: color }}
                              aria-hidden
                            >
                              {symbolInitials(h.symbol)}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold">
                                  {h.symbol}
                                </span>
                                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  {typeLabel}
                                </span>
                              </div>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {h.name}
                              </p>
                              {(firstBuyDate || trades.length > 0) && (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {firstBuyDate && (
                                    <span>
                                      Since {formatDate(firstBuyDate)}
                                    </span>
                                  )}
                                  {firstBuyDate && trades.length > 0 && " · "}
                                  {trades.length > 0 && (
                                    <span>
                                      {trades.length}{" "}
                                      {trades.length === 1
                                        ? "trade"
                                        : "trades"}
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 pr-4 text-right tabular-nums">
                          {h.quantity}
                        </td>
                        <td className="py-3.5 pr-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="tabular-nums font-medium">
                              {h.currentPrice != null ? (
                                <Money
                                  amount={h.currentPrice}
                                  currency={priceCurrency}
                                />
                              ) : (
                                "—"
                              )}
                              {h.priceStale && h.currentPrice != null && (
                                <span className="ml-1 text-xs text-amber-600">
                                  *
                                </span>
                              )}
                            </span>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              cost{" "}
                              <Money
                                amount={h.costBasis}
                                currency={h.currency}
                              />
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 pr-4 text-right tabular-nums font-medium">
                          {h.marketValueBase != null ? (
                            <Money
                              amount={h.marketValueBase}
                              currency={baseCurrency}
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3.5 text-right">
                          <div className="flex flex-col items-end">
                            {h.pl != null ? (
                              <span
                                className={cn(
                                  "tabular-nums font-medium",
                                  h.pl >= 0 ? "text-gain" : "text-loss",
                                )}
                              >
                                <Money>
                                  {formatSignedMoney(h.pl, baseCurrency)}
                                </Money>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                            {h.plPercent != null && (
                              <span
                                className={cn(
                                  "text-xs tabular-nums",
                                  h.pl != null && h.pl >= 0
                                    ? "text-gain"
                                    : "text-loss",
                                )}
                              >
                                {formatPercent(h.plPercent)}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-border/50">
                          <td
                            colSpan={5}
                            className="bg-muted/10 px-2 py-3 sm:px-3"
                          >
                            <HoldingDetailPanel
                              holding={h}
                              trades={trades}
                              accounts={accounts}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {currencyBreakdown.map(([cur, val]) => {
                const share =
                  investmentsMarketValueBase > 0
                    ? (val / investmentsMarketValueBase) * 100
                    : 0;
                return (
                  <span
                    key={cur}
                    className="rounded-md bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {cur} · <Money amount={val} currency={baseCurrency} /> (
                    {share.toFixed(0)}%)
                  </span>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground sm:text-right">
              Market value{" "}
              <Money
                amount={investmentsMarketValueBase}
                currency={baseCurrency}
              />
            </p>
          </div>
        </>
      )}

      <AddHoldingModal
        accounts={accounts}
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />
    </>
  );
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 text-right">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
