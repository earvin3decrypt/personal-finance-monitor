import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { Card } from "@/components/ui";
import { Money } from "@/components/money";
import { formatMoney } from "@/lib/format";

export type DashboardBudgetItem = {
  id: number;
  name: string;
  icon: string;
  color: string;
  spent: number;
  limit: number;
  percent: number;
  currency: string;
};

export function DashboardMonthlyBudget({
  budgets,
  currency,
  totalSpent,
  totalLimit,
}: {
  budgets: DashboardBudgetItem[];
  currency: string;
  totalSpent: number;
  totalLimit: number;
}) {
  const overallPercent =
    totalLimit > 0 ? Math.min(999, (totalSpent / totalLimit) * 100) : 0;
  const remaining = Math.max(0, totalLimit - totalSpent);
  const top = budgets.slice(0, 3);

  return (
    <Card className="flex flex-col">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Monthly budget
        </h2>
        <Link
          href="/goals"
          className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
        >
          View all
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {totalLimit <= 0 ? (
        <p className="text-sm text-muted-foreground">
          No budgets set this month.{" "}
          <Link href="/goals" className="font-medium text-primary hover:underline">
            Add one
          </Link>
        </p>
      ) : (
        <>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Spent</p>
              <p className="text-lg font-semibold tabular-nums">
                <Money amount={totalSpent} currency={currency} />
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {remaining > 0 ? "Remaining" : "Over budget"}
              </p>
              <p className="text-sm font-medium tabular-nums text-muted-foreground">
                <Money
                  amount={remaining > 0 ? remaining : totalSpent - totalLimit}
                  currency={currency}
                />
              </p>
            </div>
          </div>

          <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${
                overallPercent > 100 ? "bg-loss" : "bg-primary"
              }`}
              style={{ width: `${Math.min(100, overallPercent)}%` }}
            />
          </div>

          {top.length > 0 && (
            <ul className="space-y-2.5">
              {top.map((b) => (
                <li key={b.id} className="flex items-center gap-3">
                  <CategoryIcon icon={b.icon} color={b.color} size={14} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium">
                        {b.name}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {Math.round(b.percent)}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${
                          b.percent > 100 ? "bg-loss" : "bg-primary/80"
                        }`}
                        style={{ width: `${Math.min(100, b.percent)}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    <Money>
                      {formatMoney(b.spent, b.currency)}
                    </Money>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
