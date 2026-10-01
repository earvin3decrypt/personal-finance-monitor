import { db } from "@/db";
import { savingsContributions, savingsGoals } from "@/db/schema";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { convertToBase, getFxRates } from "@/lib/fx";
import { daysFromToday, formatDate, todayISO } from "@/lib/format";
import { getBaseCurrency } from "@/lib/settings";

export type SavingsGoalRow = {
  id: number;
  name: string;
  icon: string;
  current: number;
  target: number;
  percent: number;
  remaining: number;
  monthlyPace: number | null;
  monthContribution: number;
  currency: string;
  deadline: string | null;
  deadlineLabel: string | null;
  deadlineMonthLabel: string | null;
  daysLeft: number | null;
  isOverdue: boolean;
  history: { amount: number; date: string; time: string }[];
};

export type SavingsMonthlyPoint = {
  month: string;
  label: string;
  total: number;
};

export type SavingsOverview = {
  baseCurrency: string;
  totalCurrent: number;
  totalTarget: number;
  overallPercent: number;
  monthContributions: number;
  prevMonthContributions: number;
  monthDelta: number;
  monthDeltaPercent: number | null;
  highlightGoal: SavingsGoalRow | null;
  monthlySeries: SavingsMonthlyPoint[];
};

function previousMonthKey(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthKeysBack(count: number, from = todayISO().slice(0, 7)): string[] {
  const [y, m] = from.split("-").map(Number);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    keys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return keys;
}

function formatMonthShort(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(
    new Date(y, m - 1, 1),
  );
}

function formatDeadlineMonth(deadline: string): string {
  const [y, m] = deadline.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
}

/** Whole months remaining until deadline (at least 1 if still in the future). */
function monthsUntilDeadline(deadline: string): number | null {
  const days = daysFromToday(deadline);
  if (days == null || days < 0) return null;
  if (days === 0) return 1;
  return Math.max(1, Math.ceil(days / 30.44));
}

async function sumContributionsInMonth(
  month: string,
  baseCurrency: string,
  fx: Awaited<ReturnType<typeof getFxRates>>,
  goalId?: number,
): Promise<number> {
  const start = `${month}-01`;
  const end = `${month}-31`;
  const rows = db
    .select()
    .from(savingsContributions)
    .where(
      and(
        gte(savingsContributions.date, start),
        lte(savingsContributions.date, end),
        ...(goalId != null ? [eq(savingsContributions.goalId, goalId)] : []),
      ),
    )
    .all();

  let total = 0;
  for (const row of rows) {
    total += await convertToBase(row.amount, row.currency, baseCurrency, fx);
  }
  return total;
}

async function buildMonthlySeries(
  baseCurrency: string,
  fx: Awaited<ReturnType<typeof getFxRates>>,
  months = 6,
): Promise<SavingsMonthlyPoint[]> {
  const keys = monthKeysBack(months);
  const points: SavingsMonthlyPoint[] = [];
  for (const month of keys) {
    points.push({
      month,
      label: formatMonthShort(month),
      total: await sumContributionsInMonth(month, baseCurrency, fx),
    });
  }
  return points;
}

export async function getSavingsGoalsWithHistory(): Promise<SavingsGoalRow[]> {
  const baseCurrency = await getBaseCurrency();
  const fx = await getFxRates(baseCurrency);
  const goals = db.select().from(savingsGoals).all();
  const currentMonth = todayISO().slice(0, 7);

  const result: SavingsGoalRow[] = [];
  for (const goal of goals) {
    const currentBase = await convertToBase(
      goal.currentAmount,
      goal.currency,
      baseCurrency,
      fx,
    );
    const targetBase = await convertToBase(
      goal.targetAmount,
      goal.currency,
      baseCurrency,
      fx,
    );

    const contributions = db
      .select()
      .from(savingsContributions)
      .where(eq(savingsContributions.goalId, goal.id))
      .orderBy(desc(savingsContributions.createdAt))
      .all();

    const history = await Promise.all(
      contributions.map(async (c) => {
        const amount = await convertToBase(
          c.amount,
          c.currency,
          baseCurrency,
          fx,
        );
        const created = new Date(c.createdAt);
        return {
          amount,
          date: created.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          time: created.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          }),
        };
      }),
    );

    const deadline = goal.deadline ?? null;
    const daysLeft = deadline != null ? daysFromToday(deadline) : null;
    const remaining = Math.max(0, targetBase - currentBase);
    const monthsLeft = deadline ? monthsUntilDeadline(deadline) : null;
    const monthlyPace =
      monthsLeft != null && remaining > 0 ? remaining / monthsLeft : null;
    const monthContribution = await sumContributionsInMonth(
      currentMonth,
      baseCurrency,
      fx,
      goal.id,
    );

    result.push({
      id: goal.id,
      name: goal.name,
      icon: goal.icon,
      current: currentBase,
      target: targetBase,
      percent:
        targetBase > 0 ? Math.min(100, (currentBase / targetBase) * 100) : 0,
      remaining,
      monthlyPace,
      monthContribution,
      currency: baseCurrency,
      deadline,
      deadlineLabel: deadline ? formatDate(deadline) : null,
      deadlineMonthLabel: deadline ? formatDeadlineMonth(deadline) : null,
      daysLeft,
      isOverdue: daysLeft != null && daysLeft < 0,
      history,
    });
  }

  return result;
}

export async function getSavingsOverview(
  goals?: SavingsGoalRow[],
): Promise<SavingsOverview> {
  const goalRows = goals ?? (await getSavingsGoalsWithHistory());
  const baseCurrency = await getBaseCurrency();
  const fx = await getFxRates(baseCurrency);
  const month = todayISO().slice(0, 7);
  const prevMonth = previousMonthKey(month);

  const totalCurrent = goalRows.reduce((sum, g) => sum + g.current, 0);
  const totalTarget = goalRows.reduce((sum, g) => sum + g.target, 0);
  const overallPercent =
    totalTarget > 0 ? Math.min(100, (totalCurrent / totalTarget) * 100) : 0;

  const monthContributions = await sumContributionsInMonth(
    month,
    baseCurrency,
    fx,
  );
  const prevMonthContributions = await sumContributionsInMonth(
    prevMonth,
    baseCurrency,
    fx,
  );
  const monthDelta = monthContributions - prevMonthContributions;
  const monthDeltaPercent =
    prevMonthContributions > 0
      ? (monthDelta / prevMonthContributions) * 100
      : null;

  const withDeadline = goalRows
    .filter((g) => g.deadline != null && g.daysLeft != null)
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  const highlightGoal =
    withDeadline[0] ??
    [...goalRows].sort((a, b) => b.current - a.current)[0] ??
    null;

  const monthlySeries = await buildMonthlySeries(baseCurrency, fx, 6);

  return {
    baseCurrency,
    totalCurrent,
    totalTarget,
    overallPercent,
    monthContributions,
    prevMonthContributions,
    monthDelta,
    monthDeltaPercent,
    highlightGoal,
    monthlySeries,
  };
}
