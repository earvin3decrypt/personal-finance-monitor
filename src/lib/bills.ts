import { db } from "@/db";
import { accounts, categories, recurringItems } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { convertToBase, getFxRates } from "@/lib/fx";
import { daysFromToday } from "@/lib/format";
import { getBaseCurrency } from "@/lib/settings";

export type BillingCycle = "month" | "year";
export type BillStatus = "overdue" | "due-soon" | "upcoming" | "ended";

export type BillRow = {
  id: number;
  name: string;
  amount: number;
  currency: string;
  type: "expense" | "income";
  amountBase: number;
  monthlyAmountBase: number;
  billingCycle: BillingCycle;
  nextDueDate: string | null;
  endDate: string | null;
  reminderDays: number;
  accountId: number | null;
  accountName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  subcategoryId: number | null;
  subcategoryName: string | null;
  status: BillStatus;
  daysUntilDue: number | null;
};

export type BillAlerts = {
  count: number;
  bills: BillRow[];
};

export type TrackableRecurringItem = {
  id: number;
  name: string;
  amount: number;
  currency: string;
  type: "expense" | "income";
};

/** Advance an ISO date by one billing cycle, clamping end-of-month dates. */
export function advanceDueDate(
  isoDate: string,
  cycle: BillingCycle,
): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dayOfMonth = d;
  let year = y;
  let month = m; // 1-based

  if (cycle === "year") {
    year += 1;
  } else {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(dayOfMonth, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Next due after pay/skip. Returns null when the next cycle would fall after
 * an inclusive endDate (bill finished).
 */
export function nextDueAfterPayment(
  fromDate: string,
  cycle: BillingCycle,
  endDate: string | null,
): string | null {
  const candidate = advanceDueDate(fromDate, cycle);
  if (endDate && candidate > endDate) return null;
  return candidate;
}

/** Whether a bill has finished (no more dues on/before endDate). */
export function isBillEnded(
  endDate: string | null,
  nextDueDate: string | null,
): boolean {
  if (!endDate) return false;
  if (nextDueDate == null) return true;
  return nextDueDate > endDate;
}

function computeStatus(
  nextDueDate: string | null,
  reminderDays: number,
  endDate: string | null,
): { status: BillStatus; daysUntilDue: number | null } {
  if (isBillEnded(endDate, nextDueDate)) {
    return { status: "ended", daysUntilDue: null };
  }
  if (!nextDueDate) {
    return { status: "upcoming", daysUntilDue: null };
  }
  const days = daysFromToday(nextDueDate);
  if (days < 0) return { status: "overdue", daysUntilDue: days };
  if (days <= reminderDays) return { status: "due-soon", daysUntilDue: days };
  return { status: "upcoming", daysUntilDue: days };
}

function statusSortKey(status: BillStatus): number {
  if (status === "overdue") return 0;
  if (status === "due-soon") return 1;
  if (status === "upcoming") return 2;
  return 3;
}

export async function getBills(): Promise<{
  baseCurrency: string;
  bills: BillRow[];
  monthlyTotalBase: number;
  dueInSevenDays: number;
}> {
  const baseCurrency = await getBaseCurrency();
  const fx = await getFxRates(baseCurrency);

  const rows = db
    .select({
      id: recurringItems.id,
      name: recurringItems.name,
      amount: recurringItems.amount,
      currency: recurringItems.currency,
      type: recurringItems.type,
      billingCycle: recurringItems.billingCycle,
      nextDueDate: recurringItems.nextDueDate,
      endDate: recurringItems.endDate,
      reminderDays: recurringItems.reminderDays,
      accountId: recurringItems.accountId,
      categoryId: recurringItems.categoryId,
      subcategoryId: recurringItems.subcategoryId,
      accountName: accounts.name,
      categoryName: categories.name,
    })
    .from(recurringItems)
    .leftJoin(accounts, eq(recurringItems.accountId, accounts.id))
    .leftJoin(categories, eq(recurringItems.categoryId, categories.id))
    .where(eq(recurringItems.isBill, 1))
    .orderBy(asc(recurringItems.nextDueDate), asc(recurringItems.name))
    .all();

  const subcategoryIds = [
    ...new Set(
      rows
        .map((r) => r.subcategoryId)
        .filter((id): id is number => id != null),
    ),
  ];
  const subcategoryMap = new Map<number, string>();
  if (subcategoryIds.length > 0) {
    const allCats = db.select().from(categories).all();
    for (const c of allCats) {
      if (subcategoryIds.includes(c.id)) subcategoryMap.set(c.id, c.name);
    }
  }

  const bills: BillRow[] = [];
  let monthlyTotalBase = 0;
  let dueInSevenDays = 0;

  for (const row of rows) {
    const amountBase = await convertToBase(
      row.amount,
      row.currency,
      baseCurrency,
      fx,
    );
    const cycle = (row.billingCycle ?? "month") as BillingCycle;
    const monthlyAmountBase = cycle === "year" ? amountBase / 12 : amountBase;
    const reminderDays = row.reminderDays ?? 3;
    const { status, daysUntilDue } = computeStatus(
      row.nextDueDate,
      reminderDays,
      row.endDate,
    );

    // Monthly total and 7-day count only for active expense bills
    if (status !== "ended" && row.type === "expense") {
      monthlyTotalBase += monthlyAmountBase;
      if (
        daysUntilDue != null &&
        daysUntilDue >= 0 &&
        daysUntilDue <= 7
      ) {
        dueInSevenDays += 1;
      }
    }

    bills.push({
      id: row.id,
      name: row.name,
      amount: row.amount,
      currency: row.currency,
      type: row.type as "expense" | "income",
      amountBase,
      monthlyAmountBase,
      billingCycle: cycle,
      nextDueDate: row.nextDueDate,
      endDate: row.endDate,
      reminderDays,
      accountId: row.accountId,
      accountName: row.accountName,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      subcategoryId: row.subcategoryId,
      subcategoryName: row.subcategoryId
        ? (subcategoryMap.get(row.subcategoryId) ?? null)
        : null,
      status,
      daysUntilDue,
    });
  }

  bills.sort((a, b) => {
    const byStatus = statusSortKey(a.status) - statusSortKey(b.status);
    if (byStatus !== 0) return byStatus;
    const aDue = a.nextDueDate ?? "9999-99-99";
    const bDue = b.nextDueDate ?? "9999-99-99";
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    return a.name.localeCompare(b.name);
  });

  return { baseCurrency, bills, monthlyTotalBase, dueInSevenDays };
}

export async function getBillAlerts(): Promise<BillAlerts> {
  const { bills } = await getBills();
  const alertBills = bills.filter(
    (b) => b.status === "overdue" || b.status === "due-soon",
  );
  return { count: alertBills.length, bills: alertBills };
}

/** Lightweight count for the nav badge — no FX conversion. */
export function getBillAlertCount(): number {
  const rows = db
    .select({
      nextDueDate: recurringItems.nextDueDate,
      endDate: recurringItems.endDate,
      reminderDays: recurringItems.reminderDays,
    })
    .from(recurringItems)
    .where(eq(recurringItems.isBill, 1))
    .all();

  let count = 0;
  for (const row of rows) {
    if (isBillEnded(row.endDate, row.nextDueDate)) continue;
    if (!row.nextDueDate) continue;
    const days = daysFromToday(row.nextDueDate);
    const reminder = row.reminderDays ?? 3;
    if (days < 0 || days <= reminder) count += 1;
  }
  return count;
}

export function getTrackableRecurringItems(): TrackableRecurringItem[] {
  return db
    .select({
      id: recurringItems.id,
      name: recurringItems.name,
      amount: recurringItems.amount,
      currency: recurringItems.currency,
      type: recurringItems.type,
    })
    .from(recurringItems)
    .where(and(eq(recurringItems.isBill, 0), eq(recurringItems.type, "expense")))
    .orderBy(asc(recurringItems.name))
    .all()
    .map((r) => ({
      id: r.id,
      name: r.name,
      amount: r.amount,
      currency: r.currency,
      type: r.type as "expense" | "income",
    }));
}
