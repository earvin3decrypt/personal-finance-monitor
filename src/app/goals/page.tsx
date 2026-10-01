import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { getBudgetsWithSpending } from "@/lib/budgets";
import { getCategoryTree } from "@/lib/categories";
import { getBaseCurrency } from "@/lib/settings";
import { todayISO } from "@/lib/format";
import { GoalsView } from "@/components/goals-view";

export const metadata: Metadata = {
  title: "Budgets | Personal Finance Monitor",
  description: "Spending limits by category",
};

export default async function GoalsPage() {
  noStore();
  const month = todayISO().slice(0, 7);
  const baseCurrency = await getBaseCurrency();
  const budgets = await getBudgetsWithSpending(month);
  const categoryTree = getCategoryTree();

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
        <p className="mt-1 text-muted-foreground">
          Limit spending by category
        </p>
      </header>

      <GoalsView
        budgets={budgets}
        categoryTree={categoryTree}
        defaultCurrency={baseCurrency}
        month={month}
      />
    </div>
  );
}
