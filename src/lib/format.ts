export function formatMoney(
  amount: number,
  currency: string,
  locale = "en-US",
): string {
  // Avoid "-€0.00" from -0 or tiny float noise that rounds to 0.00
  const value =
    amount == null || Number.isNaN(Number(amount))
      ? 0
      : Math.abs(Number(amount)) < 0.005
        ? 0
        : Number(amount);

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Shorter amounts for chart axes (e.g. €5.2k). */
export function formatCompactMoney(
  amount: number,
  currency: string,
  locale = "en-US",
): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";
  const symbol =
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? currency;

  if (abs >= 1_000_000) {
    return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${symbol}${(abs / 1_000).toFixed(1)}k`;
  }
  return `${sign}${symbol}${abs.toFixed(0)}`;
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** Tailwind text class for a signed change (gain / loss / muted for ~0). */
export function signedChangeClass(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value) || Math.abs(value) < 0.05) {
    return "text-muted-foreground";
  }
  return value > 0 ? "text-gain" : "text-loss";
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Whole days from today until `isoDate` (negative if past). */
export function daysFromToday(isoDate: string): number {
  const end = new Date(`${isoDate}T00:00:00`);
  const start = new Date(`${todayISO()}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}
