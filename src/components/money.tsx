import type { ReactNode } from "react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type MoneyProps = {
  className?: string;
  children?: ReactNode;
  amount?: number;
  currency?: string;
};

/** Marks monetary text for privacy blur when enabled. */
export function Money({ className, children, amount, currency }: MoneyProps) {
  const content =
    amount != null && currency != null
      ? formatMoney(amount, currency)
      : children;

  return <span className={cn("blur-amount", className)}>{content}</span>;
}
