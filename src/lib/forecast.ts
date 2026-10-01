import { db } from "@/db";
import { recurringItems } from "@/db/schema";
import { asc } from "drizzle-orm";
import { convertToBase, getFxRates } from "@/lib/fx";
import { todayISO } from "@/lib/format";
import { getPortfolioSummary } from "@/lib/portfolio";
import { getBaseCurrency } from "@/lib/settings";

export type RecurringItemRow = {
  id: number;
  name: string;
  amount: number;
  currency: string;
  type: "expense" | "income";
  amountBase: number;
  endDate: string | null;
};

export type ForecastPoint = {
  month: number;
  label: string;
  value: number;
};

export type ForecastData = {
  baseCurrency: string;
  currentNetWorth: number;
  monthlyIncome: number;
  monthlyExpense: number;
  netMonthly: number;
  points: ForecastPoint[];
  items: RecurringItemRow[];
};

type ForecastItem = {
  monthlySignedBase: number;
  endDate: string | null;
};

function formatForecastLabel(date: Date, spansYears: boolean): string {
  const short = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(
    date,
  );
  const year = date.getFullYear();
  if (spansYears || date.getMonth() === 0) {
    return `${short} '${String(year).slice(2)}`;
  }
  return short;
}

function monthKeyFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Item still applies in a calendar month if it has no end, or ends that month or later. */
function appliesInMonth(endDate: string | null, monthKey: string): boolean {
  if (!endDate) return true;
  return endDate.slice(0, 7) >= monthKey;
}

function isCurrentlyActive(endDate: string | null, today: string): boolean {
  if (!endDate) return true;
  return endDate >= today;
}

export async function getForecast(months = 60): Promise<ForecastData> {
  const baseCurrency = await getBaseCurrency();
  const fx = await getFxRates(baseCurrency);
  const summary = await getPortfolioSummary();
  const currentNetWorth = summary.netWorthBase;
  const today = todayISO();

  const rows = db
    .select()
    .from(recurringItems)
    .orderBy(asc(recurringItems.type), asc(recurringItems.name))
    .all();

  let monthlyIncome = 0;
  let monthlyExpense = 0;
  const items: RecurringItemRow[] = [];
  const forecastItems: ForecastItem[] = [];

  for (const row of rows) {
    const amountBase = await convertToBase(
      row.amount,
      row.currency,
      baseCurrency,
      fx,
    );
    const type = row.type as "expense" | "income";
    const cycle = row.billingCycle ?? "month";
    const monthlyAmountBase = cycle === "year" ? amountBase / 12 : amountBase;
    const endDate = row.endDate ?? null;
    const signed =
      type === "income" ? monthlyAmountBase : -monthlyAmountBase;

    forecastItems.push({ monthlySignedBase: signed, endDate });

    if (!isCurrentlyActive(endDate, today)) continue;

    if (type === "income") {
      monthlyIncome += monthlyAmountBase;
    } else {
      monthlyExpense += monthlyAmountBase;
    }
    items.push({
      id: row.id,
      name: row.name,
      amount: row.amount,
      currency: row.currency,
      type,
      amountBase: monthlyAmountBase,
      endDate,
    });
  }

  const netMonthly = monthlyIncome - monthlyExpense;
  const start = new Date();
  start.setDate(1);

  const horizonEnd = new Date(start);
  horizonEnd.setMonth(horizonEnd.getMonth() + months);
  const spansYears = horizonEnd.getFullYear() !== start.getFullYear();

  const points: ForecastPoint[] = [];
  let value = currentNetWorth;
  for (let m = 0; m <= months; m++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + m);
    points.push({
      month: m,
      label: formatForecastLabel(d, spansYears),
      value,
    });
    if (m < months) {
      const key = monthKeyFromDate(d);
      let netForMonth = 0;
      for (const item of forecastItems) {
        if (appliesInMonth(item.endDate, key)) {
          netForMonth += item.monthlySignedBase;
        }
      }
      value += netForMonth;
    }
  }

  return {
    baseCurrency,
    currentNetWorth,
    monthlyIncome,
    monthlyExpense,
    netMonthly,
    points,
    items,
  };
}
