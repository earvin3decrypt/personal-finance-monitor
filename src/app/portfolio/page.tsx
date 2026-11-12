import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { getPortfolioSummary } from "@/lib/portfolio";
import { ensureTodaySnapshot, getPortfolioHistory } from "@/lib/snapshot";
import { buildInvestmentsChartData } from "@/lib/chart-data";
import { todayISO } from "@/lib/format";
import {
  Card,
  OfflineBanner,
  PageHeader,
  Button,
} from "@/components/ui";
import { InvestmentsChart } from "@/components/charts";
import { refreshMarketData } from "@/app/actions/settings";
import { PortfolioHoldingsTable } from "@/components/portfolio-holdings";
import { DividendsBoard } from "@/components/dividends-board";
import { getTradesForHoldings } from "@/lib/holding-trades";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portfolio | Personal Finance Monitor",
  description: "Stocks and ETFs with live prices and gains",
};

export default async function PortfolioPage() {
  noStore();
  await ensureTodaySnapshot();
  const summary = await getPortfolioSummary();
  const history = getPortfolioHistory();
  const accountRows = db.select().from(accounts).all();
  const holdingIds = summary.holdings.map((h) => h.id);
  const tradesMap = getTradesForHoldings(holdingIds);
  const tradesByHolding = Object.fromEntries(tradesMap.entries());
  const accountOptions = accountRows.map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
  }));

  const chartData = buildInvestmentsChartData(
    history,
    summary.investmentsTotalBase,
    todayISO(),
  );

  return (
    <>
      <PageHeader
        title="Portfolio"
        action={
          <form action={refreshMarketData}>
            <Button type="submit" variant="secondary">
              Refresh prices
            </Button>
          </form>
        }
      />
      <OfflineBanner
        fxStale={summary.fxStale}
        pricesStale={summary.pricesStale}
      />

      <Card className="mb-8 flex flex-col">
        <InvestmentsChart
          data={chartData}
          currency={summary.baseCurrency}
        />
      </Card>

      <Card className="mb-8">
        <PortfolioHoldingsTable
          holdings={summary.holdings}
          tradesByHolding={tradesByHolding}
          accounts={accountOptions}
          baseCurrency={summary.baseCurrency}
          byCurrency={summary.byCurrency}
          investmentsMarketValueBase={summary.investmentsMarketValueBase}
          dividendsTotalBase={summary.dividendsTotalBase}
          investmentsTotalBase={summary.investmentsTotalBase}
        />
      </Card>

      <Card>
        <DividendsBoard
          dividends={summary.dividends}
          baseCurrency={summary.baseCurrency}
          dividendsTotalBase={summary.dividendsTotalBase}
        />
      </Card>
    </>
  );
}
