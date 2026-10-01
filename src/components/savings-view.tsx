"use client";

import { useEffect, useId, useState, useTransition } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Calendar, Plus, Trash2, TrendingUp, X } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { Button, Card } from "@/components/ui";
import { formatMoney, todayISO } from "@/lib/format";
import {
  saveSavingsGoal,
  addSavingsContribution,
  deleteSavingsGoal,
} from "@/app/actions/savings";
import { cn } from "@/lib/utils";
import type { SavingsGoalRow, SavingsOverview } from "@/lib/savings";
import { Money } from "@/components/money";

const GOAL_ACCENTS = [
  "oklch(0.62 0.16 250)",
  "oklch(0.72 0.15 55)",
  "oklch(0.65 0.16 300)",
  "oklch(0.62 0.12 180)",
] as const;

const QUICK_AMOUNTS = [25, 50, 100, 250];

function currencySymbol(currency: string, locale = "en-US"): string {
  return (
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? currency
  );
}

export function SavingsView({
  goals,
  overview,
  defaultCurrency,
}: {
  goals: SavingsGoalRow[];
  overview: SavingsOverview;
  defaultCurrency: string;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [addGoal, setAddGoal] = useState<SavingsGoalRow | null>(null);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Savings</h1>
          <p className="mt-1 text-muted-foreground">
            Grow your nest egg, one goal at a time.
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New goal
        </Button>
      </div>

      <SavingsHeroCard overview={overview} />

      {goals.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No savings goals yet. Create your first target to get started.
          </p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New goal
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal, index) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              accent={GOAL_ACCENTS[index % GOAL_ACCENTS.length]}
              onAddMoney={() => setAddGoal(goal)}
            />
          ))}
        </div>
      )}

      {createOpen && (
        <CreateGoalModal
          defaultCurrency={defaultCurrency}
          onClose={() => setCreateOpen(false)}
        />
      )}
      {addGoal && (
        <AddMoneyModal
          goal={addGoal}
          defaultCurrency={defaultCurrency}
          onClose={() => setAddGoal(null)}
        />
      )}
    </div>
  );
}

function SavingsHeroCard({ overview }: { overview: SavingsOverview }) {
  const currency = overview.baseCurrency;
  const gradientId = useId().replace(/:/g, "");
  const chartData = overview.monthlySeries;

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            Total saved across all goals
          </p>
          <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums">
            <Money amount={overview.totalCurrent} currency={currency} />
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="flex items-center gap-1.5 text-gain">
              <TrendingUp className="h-4 w-4" />
              <Money>
                {Math.round(overview.overallPercent)}% of{" "}
                {formatMoney(overview.totalTarget, currency)} target
              </Money>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="tabular-nums text-foreground">
                <Money>
                  {formatMoney(overview.monthContributions, currency)}
                </Money>
              </span>
              <span>/ month</span>
            </span>
          </div>

          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, overview.overallPercent)}%` }}
            />
          </div>
        </div>

        <div className="h-40 w-full min-w-0 lg:h-44">
          {chartData.every((p) => p.total === 0) ? (
            <div className="flex h-full items-center justify-center rounded-xl bg-muted/40 text-sm text-muted-foreground">
              Contributions will appear here
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="oklch(0.62 0.14 155)"
                      stopOpacity={0.45}
                    />
                    <stop
                      offset="95%"
                      stopColor="oklch(0.62 0.14 155)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide domain={[0, "auto"]} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "0.75rem",
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    color: "var(--foreground)",
                  }}
                  formatter={(value: number) => [
                    <Money key="v" amount={value} currency={currency} />,
                    "Contributions",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="oklch(0.62 0.14 155)"
                  strokeWidth={2.5}
                  fill={`url(#${gradientId})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Card>
  );
}

function GoalCard({
  goal,
  accent,
  onAddMoney,
}: {
  goal: SavingsGoalRow;
  accent: string;
  onAddMoney: () => void;
}) {
  const paceLabel =
    goal.monthlyPace != null ? (
      <Money>
        {formatMoney(goal.monthlyPace, goal.currency)}/mo
      </Money>
    ) : goal.monthContribution > 0 ? (
      <Money>
        {formatMoney(goal.monthContribution, goal.currency)} this month
      </Money>
    ) : null;

  return (
    <Card className="flex flex-col p-5">
      <div className="mb-4 flex items-start gap-3">
        <CategoryIcon icon={goal.icon} color={accent} size={16} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">{goal.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {Math.round(goal.percent)}% saved
                {goal.deadlineMonthLabel ? (
                  <>
                    <span className="mx-1">·</span>
                    {goal.deadlineMonthLabel}
                  </>
                ) : null}
              </p>
            </div>
            <form action={deleteSavingsGoal}>
              <input type="hidden" name="id" value={goal.id} />
              <button
                type="submit"
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-loss"
                title="Delete goal"
                aria-label={`Delete ${goal.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      <p className="text-2xl font-bold tabular-nums tracking-tight">
        <Money amount={goal.current} currency={goal.currency} />
        <span className="ml-1.5 text-sm font-medium text-muted-foreground">
          <Money>
            of {formatMoney(goal.target, goal.currency)}
          </Money>
        </span>
      </p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, goal.percent)}%`,
            backgroundColor: accent,
          }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          <Money>
            {formatMoney(goal.remaining, goal.currency)} to go
          </Money>
        </span>
        {paceLabel && (
          <span className="tabular-nums font-medium" style={{ color: accent }}>
            {paceLabel}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onAddMoney}
        className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 py-2.5 text-sm font-medium transition hover:bg-muted"
      >
        <Plus className="h-4 w-4" />
        Add money
      </button>
    </Card>
  );
}

function ModalShell({
  children,
  onClose,
  labelledBy,
}: {
  children: React.ReactNode;
  onClose: () => void;
  labelledBy: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        {children}
      </div>
    </div>
  );
}

function CreateGoalModal({
  defaultCurrency,
  onClose,
}: {
  defaultCurrency: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const symbol = currencySymbol(defaultCurrency);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await saveSavingsGoal(formData);
      onClose();
    });
  }

  return (
    <ModalShell onClose={onClose} labelledBy={titleId}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            New goal
          </p>
          <h2 id={titleId} className="mt-1 text-xl font-semibold">
            Create a savings goal
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form action={handleSubmit} className="space-y-4">
        <input type="hidden" name="currency" value={defaultCurrency} />
        <input type="hidden" name="icon" value="target" />

        <div>
          <label
            htmlFor="create-goal-name"
            className="mb-1.5 block text-sm font-medium"
          >
            Goal name
          </label>
          <input
            id="create-goal-name"
            name="name"
            required
            placeholder="e.g. Summer vacation"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label
            htmlFor="create-goal-target"
            className="mb-1.5 block text-sm font-medium"
          >
            Target amount
          </label>
          <div className="flex overflow-hidden rounded-xl border border-border focus-within:ring-2 focus-within:ring-primary/20">
            <span className="flex shrink-0 items-center border-r border-border bg-muted/40 px-3 text-sm tabular-nums text-muted-foreground">
              {symbol}
            </span>
            <input
              id="create-goal-target"
              name="targetAmount"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="5,000"
              className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm outline-none"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="create-goal-deadline"
            className="mb-1.5 block text-sm font-medium"
          >
            Target date{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            id="create-goal-deadline"
            name="deadline"
            type="date"
            min={todayISO()}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create goal"}
        </button>
      </form>
    </ModalShell>
  );
}

function AddMoneyModal({
  goal,
  defaultCurrency,
  onClose,
}: {
  goal: SavingsGoalRow;
  defaultCurrency: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const symbol = currencySymbol(defaultCurrency);
  const [amount, setAmount] = useState("100");
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await addSavingsContribution(formData);
      onClose();
    });
  }

  return (
    <ModalShell onClose={onClose} labelledBy={titleId}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <CategoryIcon
            icon={goal.icon}
            color="oklch(0.62 0.16 250)"
            size={16}
          />
          <div className="min-w-0">
            <p className="truncate text-sm text-muted-foreground">{goal.name}</p>
            <h2 id={titleId} className="text-xl font-semibold">
              Add money
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form action={handleSubmit} className="space-y-4">
        <input type="hidden" name="goalId" value={goal.id} />
        <input type="hidden" name="currency" value={defaultCurrency} />

        <div>
          <label
            htmlFor="add-money-amount"
            className="mb-1.5 block text-sm font-medium"
          >
            Amount to add
          </label>
          <div className="flex overflow-hidden rounded-xl border border-border focus-within:ring-2 focus-within:ring-primary/20">
            <span className="flex shrink-0 items-center border-r border-border bg-muted/40 px-3 text-sm tabular-nums text-muted-foreground">
              {symbol}
            </span>
            <input
              id="add-money-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((quick) => (
            <button
              key={quick}
              type="button"
              onClick={() => setAmount(String(quick))}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm tabular-nums transition",
                Number(amount) === quick
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {symbol}
              {quick}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add to goal"}
        </button>
      </form>
    </ModalShell>
  );
}
