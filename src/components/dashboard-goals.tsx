import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
        <p className="text-sm text-muted-foreground">
          No savings goals yet.{" "}
          <Link href="/savings" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {goals.map((goal) => {
            const remaining = Math.max(0, goal.target - goal.current);
            return (
              <li key={goal.id} className="rounded-xl border border-border p-4 shadow-sm">
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
                      {formatMoney(goal.current, goal.currency)} saved
                    </Money>
                  </span>
                  <span className="tabular-nums">
                    <Money>
                      {formatMoney(remaining, goal.currency)} to go
                    </Money>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
