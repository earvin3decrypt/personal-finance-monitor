"use client";

import { useMemo, useState } from "react";
import { safeHexColor } from "@/components/category-icon";
import { useExpenseFilters } from "@/components/expense-filter-context";
import { Card } from "@/components/ui";
import { Money } from "@/components/money";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CategoryBreakdown } from "@/lib/expense-stats";

const CHART_SIZE = 220;
const CHART_CENTER = CHART_SIZE / 2;
const MAX_RADIUS = 92;
const MIN_RADIUS = 28;
const INNER_HOLE = 18;
/** Mix category hue toward white for softer chart fills (keep hues recognizable). */
const PASTEL_WHITE_MIX = 0.28;

function FixedBadge() {
  return (
    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      Fixed
    </span>
  );
}

function formatPercent(percent: number): string {
  if (percent > 0 && percent < 1) return "<1%";
  return `${percent.toFixed(0)}%`;
}

/** Soften a category hex by mixing toward white; hue stays recognizable. */
function pastelCategoryColor(hex: string, whiteMix = PASTEL_WHITE_MIX): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return hex;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return hex;
  const mix = (c: number) => Math.round(c + (255 - c) * whiteMix);
  return `#${[mix(r), mix(g), mix(b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/** Donut-like wedge from inner hole out to radius, spanning equal angle. */
function sectorPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle;

  // Full circle: a single 360° arc collapses to a point — draw two half-rings.
  if (sweep >= 359.9) {
    const topOuter = polarToCartesian(cx, cy, outerR, 0);
    const bottomOuter = polarToCartesian(cx, cy, outerR, 180);
    const topInner = polarToCartesian(cx, cy, innerR, 0);
    const bottomInner = polarToCartesian(cx, cy, innerR, 180);
    return [
      `M ${topOuter.x} ${topOuter.y}`,
      `A ${outerR} ${outerR} 0 1 0 ${bottomOuter.x} ${bottomOuter.y}`,
      `A ${outerR} ${outerR} 0 1 0 ${topOuter.x} ${topOuter.y}`,
      `L ${topInner.x} ${topInner.y}`,
      `A ${innerR} ${innerR} 0 1 1 ${bottomInner.x} ${bottomInner.y}`,
      `A ${innerR} ${innerR} 0 1 1 ${topInner.x} ${topInner.y}`,
      "Z",
    ].join(" ");
  }

  const startOuter = polarToCartesian(cx, cy, outerR, endAngle);
  const endOuter = polarToCartesian(cx, cy, outerR, startAngle);
  const startInner = polarToCartesian(cx, cy, innerR, endAngle);
  const endInner = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = sweep > 180 ? 1 : 0;

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 1 ${startInner.x} ${startInner.y}`,
    "Z",
  ].join(" ");
}

type Sector = CategoryBreakdown & {
  color: string;
  startAngle: number;
  endAngle: number;
  radius: number;
};

function RadialCategoryChart({
  sectors,
  activeId,
  hoveredId,
  baseCurrency,
  onSelect,
  onHover,
}: {
  sectors: Sector[];
  activeId: number | null;
  hoveredId: number | null;
  baseCurrency: string;
  onSelect: (categoryId: number) => void;
  onHover: (categoryId: number | null) => void;
}) {
  const guideRadii = [0.35, 0.55, 0.75, 1].map(
    (t) => INNER_HOLE + t * (MAX_RADIUS - INNER_HOLE),
  );

  return (
    <svg
      viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
      className="mx-auto h-auto w-full max-w-[220px]"
      role="img"
      aria-label="Spending by category chart"
      onMouseLeave={() => onHover(null)}
    >
      {guideRadii.map((r) => (
        <circle
          key={r}
          cx={CHART_CENTER}
          cy={CHART_CENTER}
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-border"
          strokeWidth={1}
          opacity={0.7}
        />
      ))}

      {sectors.map((sector) => {
        const selected = sector.categoryId === activeId;
        const hovered = sector.categoryId === hoveredId;
        const dimmed = activeId != null && !selected && !hovered;

        let opacity = 0.92;
        if (selected) opacity = 1;
        else if (hovered) opacity = 1;
        else if (dimmed) opacity = 0.38;

        return (
          <path
            key={sector.categoryId}
            d={sectorPath(
              CHART_CENTER,
              CHART_CENTER,
              INNER_HOLE,
              sector.radius,
              sector.startAngle,
              sector.endAngle,
            )}
            fill={sector.color}
            fillOpacity={opacity}
            stroke="var(--card)"
            strokeWidth={1.5}
            style={{
              transformOrigin: `${CHART_CENTER}px ${CHART_CENTER}px`,
              transform: hovered ? "scale(1.04)" : "scale(1)",
              transition:
                "fill-opacity 200ms ease, opacity 200ms ease, transform 200ms ease",
            }}
            className="cursor-pointer focus:outline-none focus-visible:opacity-100"
            tabIndex={0}
            role="button"
            aria-pressed={selected}
            aria-label={`${sector.name}, ${formatPercent(sector.percent)}, ${formatMoney(sector.total, baseCurrency)}`}
            onMouseEnter={() => onHover(sector.categoryId)}
            onFocus={() => onHover(sector.categoryId)}
            onBlur={() => onHover(null)}
            onClick={() => onSelect(sector.categoryId)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(sector.categoryId);
              }
            }}
          />
        );
      })}

      <circle
        cx={CHART_CENTER}
        cy={CHART_CENTER}
        r={INNER_HOLE - 1}
        className="fill-card pointer-events-none"
      />
    </svg>
  );
}

export function ExpenseCategoryBreakdown({
  baseCurrency,
  breakdown,
  totalExpense,
}: {
  baseCurrency: string;
  breakdown: CategoryBreakdown[];
  totalExpense: number;
}) {
  const { categoryId: activeId, setCategoryId } = useExpenseFilters();
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const active = breakdown.find((c) => c.categoryId === activeId) ?? null;

  const sectors = useMemo(() => {
    if (breakdown.length === 0) return [] as Sector[];
    const maxTotal = Math.max(...breakdown.map((c) => c.total), 0);
    const angle = 360 / breakdown.length;
    return breakdown.map((cat, index) => {
      const ratio = maxTotal > 0 ? cat.total / maxTotal : 0;
      const radius =
        MIN_RADIUS + Math.sqrt(Math.max(0, ratio)) * (MAX_RADIUS - MIN_RADIUS);
      return {
        ...cat,
        color: pastelCategoryColor(safeHexColor(cat.color)),
        startAngle: index * angle,
        endAngle: (index + 1) * angle,
        radius,
      };
    });
  }, [breakdown]);

  const pastelById = useMemo(() => {
    const map = new Map<number, string>();
    for (const sector of sectors) {
      map.set(sector.categoryId, sector.color);
    }
    return map;
  }, [sectors]);

  function toggleCategory(categoryId: number) {
    setCategoryId(activeId === categoryId ? null : categoryId);
  }

  return (
    <Card className="flex h-full min-w-0 flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Spending by category</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Select a category to filter activity
          </p>
        </div>
        {active && (
          <button
            type="button"
            onClick={() => setCategoryId(null)}
            className="rounded-md text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
          >
            Clear filter
          </button>
        )}
      </div>

      {breakdown.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No expenses for this month.
        </p>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] sm:items-center">
            <RadialCategoryChart
              sectors={sectors}
              activeId={activeId}
              hoveredId={hoveredId}
              baseCurrency={baseCurrency}
              onSelect={toggleCategory}
              onHover={setHoveredId}
            />

            <ul className="divide-y divide-border/70">
              {breakdown.map((cat) => {
                const selected = cat.categoryId === activeId;
                const hovered = cat.categoryId === hoveredId;
                const hasBudget = cat.budgetLimit != null && cat.budgetLimit > 0;
                const overspent = hasBudget && (cat.budgetPercent ?? 0) > 100;
                return (
                  <li key={cat.categoryId}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleCategory(cat.categoryId)}
                      onMouseEnter={() => setHoveredId(cat.categoryId)}
                      onMouseLeave={() => setHoveredId(null)}
                      onFocus={() => setHoveredId(cat.categoryId)}
                      onBlur={() => setHoveredId(null)}
                      className={cn(
                        "-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10",
                        selected
                          ? "bg-primary-light/40 text-foreground"
                          : hovered
                            ? "bg-muted/40 text-foreground"
                            : "text-foreground hover:bg-muted/40",
                      )}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            pastelById.get(cat.categoryId) ??
                            pastelCategoryColor(safeHexColor(cat.color)),
                        }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {cat.name}
                        {cat.isFixed && (
                          <span className="ml-1.5 inline-flex align-middle">
                            <FixedBadge />
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-sm tabular-nums",
                          overspent
                            ? "font-medium text-loss"
                            : "text-muted-foreground",
                        )}
                      >
                        {formatPercent(cat.percent)}
                      </span>
                      <span className="w-[4.75rem] shrink-0 text-right text-sm font-medium tabular-nums">
                        <Money amount={cat.total} currency={baseCurrency} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {active && (
            <div className="mt-4 border-t border-border pt-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{active.name}</p>
                {active.budgetLimit != null && active.budgetLimit > 0 && (
                  <p
                    className={cn(
                      "text-xs tabular-nums",
                      (active.budgetPercent ?? 0) > 100
                        ? "font-medium text-loss"
                        : "text-muted-foreground",
                    )}
                  >
                    {(active.budgetPercent ?? 0).toFixed(0)}% of budget
                    <Money>
                      {" "}
                      · {formatMoney(active.budgetLimit, baseCurrency)}
                    </Money>
                  </p>
                )}
              </div>

              {active.subcategories.length > 0 && (
                <ul className="space-y-3">
                  {active.subcategories.map((sub) => {
                    const subHasBudget =
                      sub.budgetLimit != null && sub.budgetLimit > 0;
                    const budgetPct = sub.budgetPercent ?? 0;
                    const subOverspent = subHasBudget && budgetPct > 100;
                    const sharePct =
                      active.total > 0
                        ? Math.min(100, (sub.total / active.total) * 100)
                        : 0;
                    const barPct = subHasBudget
                      ? Math.min(100, Math.max(0, budgetPct))
                      : sharePct;
                    const fillColor =
                      pastelById.get(active.categoryId) ??
                      pastelCategoryColor(safeHexColor(active.color));

                    return (
                      <li key={sub.id} className="min-w-0">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-sm text-foreground">
                            {sub.name}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 text-sm font-medium tabular-nums",
                              subOverspent ? "text-loss" : "text-foreground",
                            )}
                          >
                            <Money amount={sub.total} currency={baseCurrency} />
                          </span>
                        </div>
                        <div
                          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                          aria-hidden
                        >
                          <div
                            className={cn(
                              "h-full rounded-full transition-[width] duration-200",
                              !subHasBudget && "bg-muted-foreground/35",
                            )}
                            style={{
                              width: `${barPct}%`,
                              ...(subHasBudget
                                ? { backgroundColor: fillColor }
                                : {}),
                            }}
                          />
                        </div>
                        {subHasBudget && (
                          <p
                            className={cn(
                              "mt-1 text-xs tabular-nums",
                              subOverspent
                                ? "font-medium text-loss"
                                : "text-muted-foreground",
                            )}
                          >
                            {budgetPct.toFixed(0)}% of budget
                            <Money>
                              {" "}
                              · {formatMoney(sub.budgetLimit!, baseCurrency)}
                            </Money>
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold tabular-nums">
              <Money amount={totalExpense} currency={baseCurrency} />
            </span>
          </div>
          {active && (
            <a
              href="#activity"
              className="mt-2 self-end rounded-md text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
            >
              View {active.name} in activity
            </a>
          )}
        </>
      )}
    </Card>
  );
}
