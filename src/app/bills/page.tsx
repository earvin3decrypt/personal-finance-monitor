import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { BillsView } from "@/components/bills-view";
import { getBills, getTrackableRecurringItems } from "@/lib/bills";
import { getCategoryTree } from "@/lib/categories";

export const metadata: Metadata = {
  title: "Bills | Personal Finance Monitor",
  description: "Track subscriptions and bills with due-date reminders",
};

export default async function BillsPage() {
  noStore();
  const [{ baseCurrency, bills, monthlyTotalBase, dueInSevenDays }, trackable] =
    await Promise.all([getBills(), Promise.resolve(getTrackableRecurringItems())]);

  const categories = getCategoryTree();
  const accountOptions = db
    .select()
    .from(accounts)
    .all()
    .map((a) => ({
      id: a.id,
      name: a.name,
      currency: a.currency,
      type: a.type,
    }));

  return (
    <div className="mx-auto max-w-6xl">
      <BillsView
        baseCurrency={baseCurrency}
        bills={bills}
        monthlyTotalBase={monthlyTotalBase}
        dueInSevenDays={dueInSevenDays}
        trackable={trackable}
        accounts={accountOptions}
        categories={categories}
      />
    </div>
  );
}
