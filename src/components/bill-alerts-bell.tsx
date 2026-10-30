"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { markBillPaid } from "@/app/actions/bills";
import { Button } from "@/components/ui";
import { Button as MotionButton } from "@/components/ui/motion-button";
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

export function BillAlertsBell({ bills }: { bills: BillRow[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  if (bills.length === 0) return null;

  const overdueCount = bills.filter((b) => b.status === "overdue").length;

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <MotionButton
          type="button"
          variant="secondary"
          size="sm"
          ripple
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`Upcoming bill reminders, ${bills.length}`}
          onClick={() => setOpen((v) => !v)}
          className="w-8 !px-0"
        >
          <Bell className="h-3.5 w-3.5" aria-hidden />
        </MotionButton>
        <span className="pointer-events-none absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#C2410C] px-1 text-[10px] font-semibold leading-none text-[#FEF3EE]">
          {bills.length}
        </span>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label={
            overdueCount > 0 ? "Bills need attention" : "Upcoming bills"
          }
          className="absolute right-0 z-50 mt-2 min-w-[20rem] max-w-[24rem] rounded-2xl border border-border bg-card p-4 shadow-lg"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">
              {overdueCount > 0 ? "Bills need attention" : "Upcoming bills"}
            </h2>
            <Link
              href="/bills"
              className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
              onClick={() => setOpen(false)}
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
                      {bill.nextDueDate
                        ? ` · ${formatDate(bill.nextDueDate)}`
                        : ""}
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
                      onClick={() => setOpen(false)}
                    >
                      Set up
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
