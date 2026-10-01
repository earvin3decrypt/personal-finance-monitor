"use client";

import { NumberTicker } from "@/components/number-ticker";

/** Currency amount with digit-roll animation (dashboard stat cards). */
export function MoneyTicker({
  value,
  currency,
  locale = "en-US",
  className,
}: {
  value: number;
  currency: string;
  locale?: string;
  className?: string;
}) {
  return (
    <NumberTicker
      value={value}
      blur
      className={className}
      format={(n) =>
        new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        }).format(n)
      }
    />
  );
}
