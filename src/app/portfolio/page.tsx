import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { getPortfolioSummary } from "@/lib/portfolio";
import { ensureTodaySnapshot, getPortfolioHistory } from "@/lib/snapshot";
import { buildInvestmentsChartData } from "@/lib/chart-data";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import {
  Card,
  OfflineBanner,
  PageHeader,
  Button,
  Input,
  Select,
  Label,
} from "@/components/ui";
import { InvestmentsChart } from "@/components/charts";
import { saveHolding } from "@/app/actions/holdings";
import { saveDividend, deleteDividend } from "@/app/actions/dividends";
import { refreshMarketData } from "@/app/actions/settings";
import { PortfolioHoldingsTable } from "@/components/portfolio-holdings";
import { Money } from "@/components/money";
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
        description={
          <>
            Investments:{" "}
            <Money
              amount={summary.investmentsTotalBase}
              currency={summary.baseCurrency}
            />
            {summary.dividendsTotalBase > 0 && (
              <Money>
                {" "}
                (
                {formatMoney(
                  summary.investmentsMarketValueBase,
                  summary.baseCurrency,
                )}{" "}
                market +{" "}
                {formatMoney(
                  summary.dividendsTotalBase,
                  summary.baseCurrency,
                )}{" "}
                dividends)
              </Money>
            )}
          </>
        }
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
        <h2 className="mb-4 font-medium">Add holding</h2>
        <form
          action={saveHolding}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <Label htmlFor="symbol">Symbol</Label>
            <Input id="symbol" name="symbol" required placeholder="AAPL" />
          </div>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="Apple Inc." />
          </div>
          <div>
            <Label htmlFor="assetType">Type</Label>
            <Select id="assetType" name="assetType" defaultValue="stock">
              <option value="stock">Stock</option>
              <option value="etf">ETF</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              step="any"
              required
            />
          </div>
          <div>
            <Label htmlFor="costBasis">Avg cost (per unit)</Label>
            <Input
              id="costBasis"
              name="costBasis"
              type="number"
              step="0.01"
              required
            />
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select id="currency" name="currency" defaultValue="USD">
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="accountId">Linked account (optional)</Label>
            <Select id="accountId" name="accountId" defaultValue="">
              <option value="">None</option>
              {accountRows.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit">Add holding</Button>
          </div>
        </form>
      </Card>

      {Object.keys(summary.byCurrency).length > 0 && (
        <div className="mb-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {Object.entries(summary.byCurrency).map(([cur, val]) => (
            <span key={cur}>
              {cur}: <Money amount={val} currency={cur} />
            </span>
          ))}
        </div>
      )}

      <Card className="mb-8">
        <h2 className="mb-4 font-medium">Holdings</h2>
        <PortfolioHoldingsTable
          holdings={summary.holdings}
          tradesByHolding={tradesByHolding}
          accounts={accountOptions}
          baseCurrency={summary.baseCurrency}
          investmentsMarketValueBase={summary.investmentsMarketValueBase}
          dividendsTotalBase={summary.dividendsTotalBase}
          investmentsTotalBase={summary.investmentsTotalBase}
        />
      </Card>

      <Card>
        <h2 className="mb-1 font-medium">Dividends</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Log dividend income as a single amount — no need to tie it to a specific
          holding. Totals are added to investments and net worth.
        </p>

        <form
          action={saveDividend}
          className="mb-6 grid gap-4 border-b border-border pb-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <Label htmlFor="div-amount">Amount</Label>
            <Input
              id="div-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="42.50"
            />
          </div>
          <div>
            <Label htmlFor="div-currency">Currency</Label>
            <Select
              id="div-currency"
              name="currency"
              defaultValue={summary.baseCurrency}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="div-date">Payment date</Label>
            <Input
              id="div-date"
              name="date"
              type="date"
              required
              defaultValue={todayISO()}
            />
          </div>
          <div>
            <Label htmlFor="div-description">Note (optional)</Label>
            <Input
              id="div-description"
              name="description"
              placeholder="ETF distributions"
            />
          </div>
          <div className="flex items-end sm:col-span-2 lg:col-span-4">
            <Button type="submit">Add dividend</Button>
          </div>
        </form>

        {summary.dividends.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No dividends recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Note</th>
                  <th className="pb-2 pr-4 text-right">Amount</th>
                  <th className="pb-2 pr-4 text-right">
                    In {summary.baseCurrency}
                  </th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {summary.dividends.map((d) => (
                  <tr key={d.id} className="border-b border-border/60">
                    <td className="py-3 pr-4 tabular-nums">
                      {formatDate(d.date)}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {d.description ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      <Money amount={d.amount} currency={d.currency} />
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-gain">
                      <Money
                        amount={d.amountBase}
                        currency={summary.baseCurrency}
                      />
                    </td>
                    <td className="py-3 text-right">
                      <form action={deleteDividend}>
                        <input type="hidden" name="id" value={d.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          className="text-xs text-loss"
                        >
                          Delete
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-4 font-medium">
                    Total dividends
                  </td>
                  <td className="pt-4 text-right font-semibold tabular-nums text-gain">
                    <Money
                      amount={summary.dividendsTotalBase}
                      currency={summary.baseCurrency}
                    />
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
