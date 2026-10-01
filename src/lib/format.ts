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

/** Parse an ISO date (`YYYY-MM-DD`) as local midnight to avoid TZ shifts. */
function parseLocalDate(date: string): Date {
  return new Date(`${date.slice(0, 10)}T00:00:00`);
}

/** Consistent `DD MMM YYYY` (e.g. 30 Sep 2026). */
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseLocalDate(date));
}

/** Relative label for recent rows: Today / Yesterday, else `DD MMM YYYY`. */
export function formatRelativeDate(date: string, today = todayISO()): string {
  const day = date.slice(0, 10);
  if (day === today) return "Today";
  const yesterday = new Date(`${today}T00:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (day === yesterdayISO) return "Yesterday";
  return formatDate(day);
}

/**
 * Clean transaction titles that duplicate the category or embed a date
 * (e.g. "Interest — 30 September 2026" → "Monthly interest").
 */
export function displayTransactionTitle(
  description: string | null | undefined,
  categoryName: string,
): string {
  const raw = (description ?? "").trim();
  if (!raw) return categoryName;

  const interestMatch = /^interest\s*[—–-]\s*/i.exec(raw);
  if (interestMatch || /^interest$/i.test(raw)) {
    // Daily interest descriptions include a full day label; monthly use month+year.
    const rest = raw.slice(interestMatch?.[0].length ?? raw.length).trim();
    const looksLikeDay =
      /^\d{1,2}\s+\w+/i.test(rest) && !/^\w+\s+\d{4}$/i.test(rest);
    return looksLikeDay ? "Interest payout" : "Monthly interest";
  }

  // "Category — anything" or exact category name → use a cleaner label
  const embDash = new RegExp(
    `^${escapeRegExp(categoryName)}\\s*[—–-]\\s*.+$`,
    "i",
  );
  if (embDash.test(raw) || raw.toLowerCase() === categoryName.toLowerCase()) {
    return categoryName;
  }

  return raw;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
