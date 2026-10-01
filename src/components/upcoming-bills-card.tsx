import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { markBillPaid } from "@/app/actions/bills";
import { Button } from "@/components/ui";
import type { BillRow } from "@/lib/bills";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Money } from "@/components/money";

function dueLabel(bill: BillRow): string {
  if (bill.daysUntilDue == null) return "No due date";
  if (bill.daysUntilDue < 0) {
    const n = Math.abs(bill.daysUntilDue);
    return n === 1 ? "1 day overdue" : `${n} days overdue`;
  }
  if (bill.daysUntilDue === 0) return "Due today";
  if (bill.daysUntilDue === 1) return "Due tomorrow";
  return `Due in ${bill.daysUntilDue} days`;
}

export function UpcomingBillsCard({ bills }: { bills: BillRow[] }) {
  if (bills.length === 0) return null;

  const overdueCount = bills.filter((b) => b.status === "overdue").length;

  return (
    <section className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={cn(
              "h-4 w-4",
              overdueCount > 0 ? "text-loss" : "text-amber-600 dark:text-amber-400",
            )}
          />
          <h2 className="text-sm font-semibold">
            {overdueCount > 0 ? "Bills need attention" : "Upcoming bills"}
          </h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {bills.length}
          </span>
        </div>
        <Link
          href="/bills"
          className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
        >
          View all
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ul className="divide-y divide-border">
        {bills.slice(0, 5).map((bill) => {
          const canMarkPaid = !!bill.accountId && !!bill.categoryId;
          return (
            <li
              key={bill.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{bill.name}</p>
                <p
                  className={cn(
                    "text-xs",
                    bill.status === "overdue"
                      ? "font-medium text-loss"
                      : "font-medium text-amber-600 dark:text-amber-400",
                  )}
                >
                  {dueLabel(bill)}
                  {bill.nextDueDate ? ` · ${formatDate(bill.nextDueDate)}` : ""}
                  {" · "}
                  <Money amount={bill.amount} currency={bill.currency} />
                </p>
              </div>
              {canMarkPaid ? (
                <form action={markBillPaid}>
                  <input type="hidden" name="id" value={bill.id} />
                  <Button
                    type="submit"
                    variant="secondary"
                    className="h-8 px-2.5 text-xs"
                  >
                    Mark paid
                  </Button>
                </form>
              ) : (
                <Link
                  href="/bills"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Set up
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
