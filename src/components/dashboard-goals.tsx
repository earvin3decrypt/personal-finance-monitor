import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { Card } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { Money } from "@/components/money";

type Goal = {
  id: number;
  name: string;
  icon: string;
  current: number;
  target: number;
  percent: number;
  currency: string;
};

export function DashboardGoals({ goals }: { goals: Goal[] }) {
  const showCreateSlot = goals.length < 3;

  return (
    <Card className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Financial goals
        </h2>
        <Link
          href="/savings"
          className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
        >
          View all
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {goals.length === 0 ? (
        <ul className="flex flex-1 flex-col gap-3">
          <li className="flex flex-1">
            <Link
              href="/savings"
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 hover:text-foreground"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-border">
                <Plus className="h-4 w-4" />
              </span>
              <span className="font-medium">Create new goal</span>
              <span className="text-xs">Set a savings target to get started</span>
            </Link>
          </li>
        </ul>
      ) : (
        <ul className="flex flex-1 flex-col gap-3">
          {goals.map((goal) => {
            const remaining = Math.max(0, goal.target - goal.current);
            const complete = goal.percent >= 100;
            return (
              <li
                key={goal.id}
                className="rounded-xl border border-border p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <CategoryIcon icon={goal.icon} size={16} />
                    <span className="truncate text-sm font-medium">
                      {goal.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-primary">
                    {Math.round(goal.percent)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, goal.percent)}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    <Money>
                      {formatMoney(goal.current, goal.currency)}
                      {" / "}
                      {formatMoney(goal.target, goal.currency)}
                    </Money>
                  </span>
                  <span className="tabular-nums">
                    {complete ? (
                      "Complete"
                    ) : (
                      <Money>
                        {formatMoney(remaining, goal.currency)} left
                      </Money>
                    )}
                  </span>
                </div>
              </li>
            );
          })}

          {showCreateSlot && (
            <li className="flex min-h-[5.5rem] flex-1">
              <Link
                href="/savings"
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 hover:text-foreground"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-border">
                  <Plus className="h-4 w-4" />
                </span>
                <span className="font-medium">Create new goal</span>
              </Link>
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}
