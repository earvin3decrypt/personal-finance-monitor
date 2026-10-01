import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import {
  getSavingsGoalsWithHistory,
  getSavingsOverview,
} from "@/lib/savings";
import { getBaseCurrency } from "@/lib/settings";
import { SavingsView } from "@/components/savings-view";

export const metadata: Metadata = {
  title: "Savings | Personal Finance Monitor",
  description: "Track savings goals and contributions",
};

export default async function SavingsPage() {
  noStore();
  const baseCurrency = await getBaseCurrency();
  const goals = await getSavingsGoalsWithHistory();
  const overview = await getSavingsOverview(goals);

  return (
    <div className="mx-auto max-w-6xl">
      <SavingsView
        goals={goals}
        overview={overview}
        defaultCurrency={baseCurrency}
      />
    </div>
  );
}
