import { getBudgetsWithSpending } from "@/lib/budgets";
import { getExpenseStats } from "@/lib/expense-stats";
import { formatMoney, todayISO } from "@/lib/format";
import { getOllamaModel, isOllamaAvailable, ollamaChat } from "@/lib/ollama";
import { getPortfolioSummary } from "@/lib/portfolio";

export type MonthlyInsightResult =
  | {
      status: "ok";
      insight: string;
      monthLabel: string;
      model: string;
      month: string;
    }
  | {
      status: "unavailable";
      reason: string;
      monthLabel: string;
    }
  | {
      status: "error";
      reason: string;
      monthLabel: string;
    };

function previousMonth(month: string): string {
  const d = new Date(`${month}-01`);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(new Date(Number(y), Number(m) - 1, 1));
}

async function buildInsightContext(month: string) {
  const [stats, prevStats, budgets, summary] = await Promise.all([
    getExpenseStats(month),
    getExpenseStats(previousMonth(month)),
    getBudgetsWithSpending(month),
    getPortfolioSummary(),
  ]);

  const currency = stats.baseCurrency;

  return {
    month: formatMonthLabel(month),
    currency,
    netWorth: formatMoney(summary.netWorthBase, currency),
    cash: formatMoney(summary.cashTotalBase, currency),
    expenses: formatMoney(stats.totalExpenseMonth, currency),
    income: formatMoney(stats.totalIncomeMonth, currency),
    dailyAverage: formatMoney(stats.dailyAverage, currency),
    previousExpenses: formatMoney(prevStats.totalExpenseMonth, currency),
    previousIncome: formatMoney(prevStats.totalIncomeMonth, currency),
    trendPercent: Math.round(stats.trendPercent),
    topCategories: stats.breakdown.slice(0, 4).map((c) => ({
      name: c.name,
      total: formatMoney(c.total, currency),
      percent: Math.round(c.percent),
    })),
    budgets: budgets.slice(0, 6).map((b) => ({
      name: b.parentName ? `${b.name} (${b.parentName})` : b.name,
      spent: formatMoney(b.spent, currency),
      limit: formatMoney(b.limit, currency),
      percent: Math.round(b.percent),
    })),
  };
}

export async function generateMonthlyInsight(
  month = todayISO().slice(0, 7),
): Promise<MonthlyInsightResult> {
  const monthLabel = formatMonthLabel(month);

  const available = await isOllamaAvailable();
  if (!available) {
    return {
      status: "unavailable",
      monthLabel,
      reason:
        "Ollama is not running. Start it on this Mac (ollama serve), then try again.",
    };
  }

  try {
    const context = await buildInsightContext(month);
    const model = getOllamaModel();

    const insight = await ollamaChat(
      [
        {
          role: "system",
          content: [
            "You are a concise personal finance coach for a local desktop app.",
            "Use only the provided JSON facts. Do not invent numbers.",
            "Write 2–3 short sentences in plain English.",
            "Highlight spending vs last month, notable categories, and any budgets that are tight or over.",
            "Be practical and calm. No bullet lists, no markdown, no emojis.",
          ].join(" "),
        },
        {
          role: "user",
          content: `Write a monthly insight for ${context.month} from these facts:\n${JSON.stringify(context)}`,
        },
      ],
      { model, timeoutMs: 120_000 },
    );

    return {
      status: "ok",
      insight,
      monthLabel,
      model,
      month,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate insight";
    return {
      status: "error",
      monthLabel,
      reason: message.includes("abort")
        ? "The local model took too long (2 min). Wait for Ollama to finish loading, then try Generate again."
        : message,
    };
  }
}
