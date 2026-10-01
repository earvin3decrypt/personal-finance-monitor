import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { convertToBase, getFxRates } from "@/lib/fx";
import { getPortfolioSummary } from "@/lib/portfolio";
import { applyDueInterest } from "@/lib/interest";
import { getRecentTransfers } from "@/lib/transfers";
import { getAccountLineMetrics } from "@/lib/account-metrics";
import { PageHeader } from "@/components/ui";
import { AccountsSection } from "@/components/accounts-section";
import { Money } from "@/components/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accounts | Personal Finance Monitor",
  description: "Manage bank accounts and cash balances",
};

export default async function AccountsPage() {
  noStore();
  await applyDueInterest();

  const rows = db.select().from(accounts).all();
  const summary = await getPortfolioSummary();
  const fx = await getFxRates(summary.baseCurrency);
  const transfers = getRecentTransfers();
  const metricsById = getAccountLineMetrics(rows);

  const accountsWithBase = await Promise.all(
    rows.map(async (account) => {
      const metrics = metricsById.get(account.id);
      return {
        ...account,
        balanceBase: await convertToBase(
          account.balance,
          account.currency,
          summary.baseCurrency,
          fx,
        ),
        change30dPercent: metrics?.change30dPercent ?? null,
        lastActivityDate: metrics?.lastActivityDate ?? null,
      };
    }),
  );

  return (
    <>
      <PageHeader
        title="Accounts"
        description={
          <>
            Total cash:{" "}
            <Money
              amount={summary.cashTotalBase}
              currency={summary.baseCurrency}
            />
          </>
        }
      />
      <AccountsSection
        accounts={accountsWithBase}
        transfers={transfers}
        baseCurrency={summary.baseCurrency}
        fxStale={summary.fxStale}
      />
    </>
  );
}
