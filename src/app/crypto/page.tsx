import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/db";
import { accounts, cryptoHoldings } from "@/db/schema";
import { getPortfolioSummary } from "@/lib/portfolio";
import { getCryptoTradeHistory } from "@/lib/crypto-history";
import { getPortfolioHistory, ensureTodaySnapshot } from "@/lib/snapshot";
import { buildCryptoChartData } from "@/lib/chart-data";
import { formatMoney, todayISO } from "@/lib/format";
import { Card, PageHeader, StatCard, Button } from "@/components/ui";
import { CryptoSection } from "@/components/crypto-section";
import { CryptoTradeHistory } from "@/components/crypto-trade-history";
import { CryptoChart } from "@/components/charts";
import { refreshMarketData } from "@/app/actions/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Crypto | Personal Finance Monitor",
  description: "Cryptocurrency holdings with live prices",
};

export default async function CryptoPage() {
  noStore();
  await ensureTodaySnapshot();
  const summary = await getPortfolioSummary();
  const history = getPortfolioHistory();

  const rows = db.select().from(cryptoHoldings).all();
  const updatedAtById = new Map(rows.map((r) => [r.id, r.updatedAt]));

  const holdings = summary.crypto.map((c) => ({
    ...c,
    updatedAt: updatedAtById.get(c.id),
  }));

  const accountOptions = db
    .select()
    .from(accounts)
    .all()
    .map((a) => ({
      id: a.id,
      name: a.name,
      currency: a.currency,
    }));

  const tradeHistory = getCryptoTradeHistory();

  const chartData = buildCryptoChartData(
    history,
    summary.cryptoTotalBase,
    todayISO()
  );

  return (
    <>
      <PageHeader
        title="Crypto"
        description="Track coins and include them in your net worth"
        action={
          <form action={refreshMarketData}>
            <Button type="submit" variant="secondary">
              Refresh prices
            </Button>
          </form>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Crypto total"
          value={formatMoney(summary.cryptoTotalBase, summary.baseCurrency)}
        />
        <StatCard
          label="Net worth"
          value={formatMoney(summary.netWorthBase, summary.baseCurrency)}
          sub="Includes cash, investments, and crypto"
        />
      </div>

      <Card className="mb-8 flex flex-col">
        <CryptoChart
          data={chartData}
          currency={summary.baseCurrency}
        />
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-medium text-muted-foreground">
          Holdings
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Buy or sell to update quantity and cost basis. Trades are logged under
          Crypto in Expenses without changing account balances.
        </p>
        <CryptoSection
          holdings={holdings}
          accounts={accountOptions}
          baseCurrency={summary.baseCurrency}
          fxStale={summary.fxStale}
          pricesStale={summary.pricesStale}
        />
      </Card>

      <Card className="mt-8">
        <CryptoTradeHistory trades={tradeHistory} />
      </Card>
    </>
  );
}
