import { db } from "@/db";
import { portfolioSnapshots } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { getPortfolioSummary } from "@/lib/portfolio";
import { todayISO } from "@/lib/format";

export async function recordPortfolioSnapshot(date?: string) {
  const snapshotDate = date ?? todayISO();
  const summary = await getPortfolioSummary();

  const existing = db
    .select()
    .from(portfolioSnapshots)
    .where(eq(portfolioSnapshots.date, snapshotDate))
    .limit(1)
    .all()[0];

  if (existing) {
    db.update(portfolioSnapshots)
      .set({
        totalValueBase: summary.netWorthBase,
        cashValueBase: summary.cashTotalBase,
        investmentsValueBase: summary.investmentsTotalBase,
        cryptoValueBase: summary.cryptoTotalBase,
      })
      .where(eq(portfolioSnapshots.id, existing.id))
      .run();
    return { date: snapshotDate, updated: true };
  }

  db.insert(portfolioSnapshots)
    .values({
      date: snapshotDate,
      totalValueBase: summary.netWorthBase,
      cashValueBase: summary.cashTotalBase,
      investmentsValueBase: summary.investmentsTotalBase,
      cryptoValueBase: summary.cryptoTotalBase,
    })
    .run();

  return { date: snapshotDate, updated: false };
}

export async function ensureTodaySnapshot() {
  await recordPortfolioSnapshot(todayISO());
}

export function getPortfolioHistory() {
  return db
    .select()
    .from(portfolioSnapshots)
    .orderBy(asc(portfolioSnapshots.date))
    .all();
}
