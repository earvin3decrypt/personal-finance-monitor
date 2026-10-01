export type NetWorthChartPoint = {
  date: string;
  total: number;
  cash: number;
  investments: number;
  crypto: number;
};

function lookupSeriesValue(
  series: { date: string; total: number }[],
  date: string,
): number {
  const exact = series.find((p) => p.date === date);
  if (exact) return exact.total;
  const before = series.filter((p) => p.date <= date);
  return before.length > 0 ? before[before.length - 1].total : 0;
}

function mergeComponentSeries(
  seriesList: { date: string; total: number }[][],
  today: string,
  live: { total: number; cash: number; investments: number; crypto: number },
): NetWorthChartPoint[] {
  const dates = new Set<string>();
  for (const series of seriesList) {
    for (const p of series) dates.add(p.date);
  }
  dates.add(today);

  const keys = ["total", "cash", "investments", "crypto"] as const;

  return [...dates]
    .sort((a, b) => a.localeCompare(b))
    .map((date) => {
      const point = {} as NetWorthChartPoint;
      point.date = date;
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        point[key] =
          date === today ? live[key] : lookupSeriesValue(seriesList[i], date);
      }
      return point;
    });
}

/** Build net-worth series using live total for today (overrides stale snapshots). */
export function buildNetWorthChartData(
  history: {
    date: string;
    totalValueBase: number;
    cashValueBase: number;
    investmentsValueBase: number;
    cryptoValueBase: number;
  }[],
  summary: {
    netWorthBase: number;
    cashTotalBase: number;
    investmentsTotalBase: number;
    cryptoTotalBase: number;
  },
  today: string,
): NetWorthChartPoint[] {
  const totalSeries = buildNetWorthTotalSeries(history, summary.netWorthBase, today);
  const cashSeries = buildCashChartData(history, summary.cashTotalBase, today);
  const investmentsSeries = buildInvestmentsChartData(
    history,
    summary.investmentsTotalBase,
    today,
  );
  const cryptoSeries = buildCryptoChartData(
    history,
    summary.cryptoTotalBase,
    today,
  );

  return mergeComponentSeries(
    [totalSeries, cashSeries, investmentsSeries, cryptoSeries],
    today,
    {
      total: summary.netWorthBase,
      cash: summary.cashTotalBase,
      investments: summary.investmentsTotalBase,
      crypto: summary.cryptoTotalBase,
    },
  );
}

function buildNetWorthTotalSeries(
  history: { date: string; totalValueBase: number }[],
  currentNetWorth: number,
  today: string,
): { date: string; total: number }[] {
  const byDate = new Map<string, number>();

  for (const row of history) {
    if (row.totalValueBase > 0) {
      byDate.set(row.date, row.totalValueBase);
    }
  }
  byDate.set(today, currentNetWorth);

  return [...byDate.entries()]
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildCashChartData(
  history: { date: string; cashValueBase: number; totalValueBase: number }[],
  currentCash: number,
  today: string,
): { date: string; total: number }[] {
  const byDate = new Map<string, number>();

  for (const row of history) {
    if (row.totalValueBase > 0) {
      byDate.set(row.date, row.cashValueBase);
    }
  }
  byDate.set(today, currentCash);

  return [...byDate.entries()]
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildInvestmentsChartData(
  history: { date: string; investmentsValueBase: number }[],
  currentInvestments: number,
  today: string,
): { date: string; total: number }[] {
  const byDate = new Map<string, number>();

  for (const row of history) {
    if (row.investmentsValueBase > 0) {
      byDate.set(row.date, row.investmentsValueBase);
    }
  }
  byDate.set(today, currentInvestments);

  return [...byDate.entries()]
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildCryptoChartData(
  history: { date: string; cryptoValueBase: number }[],
  currentCrypto: number,
  today: string,
): { date: string; total: number }[] {
  const byDate = new Map<string, number>();

  for (const row of history) {
    if (row.cryptoValueBase > 0) {
      byDate.set(row.date, row.cryptoValueBase);
    }
  }
  byDate.set(today, currentCrypto);

  return [...byDate.entries()]
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Largest-remainder rounding so displayed percents sum to 100. */
export function allocateRoundedPercents(values: number[]): number[] {
  if (values.length === 0) return [];
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return values.map(() => 0);

  const raw = values.map((v) => (v / total) * 100);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = 100 - floors.reduce((sum, f) => sum + f, 0);

  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floors];
  for (const { i } of order) {
    if (remainder <= 0) break;
    result[i] += 1;
    remainder -= 1;
  }
  return result;
}

export function yAxisDomain(
  values: number[],
): [number, number] {
  const positive = values.filter((v) => v > 0);
  if (positive.length === 0) {
    return [0, 100];
  }

  const min = Math.min(...positive);
  const max = Math.max(...positive);
  let span = max - min;
  const minRelativeSpan = max * 0.01;
  if (span < minRelativeSpan) {
    span = minRelativeSpan;
  }
  const padding = span * 0.12;

  return [Math.max(0, min - padding), max + padding];
}

export type ChartRange = "1M" | "3M" | "6M" | "1Y";

export const CHART_RANGES: ChartRange[] = ["1Y", "6M", "3M", "1M"];

export function chartRangeStartDate(range: ChartRange, today = new Date()): string {
  const start = new Date(today);
  if (range === "1M") start.setMonth(start.getMonth() - 1);
  if (range === "3M") start.setMonth(start.getMonth() - 3);
  if (range === "6M") start.setMonth(start.getMonth() - 6);
  if (range === "1Y") start.setFullYear(start.getFullYear() - 1);
  return start.toISOString().slice(0, 10);
}

export function countPointsInRange(
  data: { date: string }[],
  range: ChartRange,
  today = new Date(),
): number {
  const start = chartRangeStartDate(range, today);
  return data.filter((d) => d.date >= start).length;
}

export function pickBestChartRange(
  data: { date: string }[],
  today = new Date(),
): ChartRange {
  for (const range of CHART_RANGES) {
    if (countPointsInRange(data, range, today) >= 2) return range;
  }
  return "1M";
}

export function filterSeriesForRange<T extends { date: string; total: number }>(
  data: T[],
  range: ChartRange,
  today = new Date(),
): T[] {
  const startDateStr = chartRangeStartDate(range, today);
  const todayStr = today.toISOString().slice(0, 10);

  let filtered = data.filter((d) => d.date >= startDateStr);

  if (filtered.length > 0 && filtered[0].date > startDateStr) {
    const beforeStart = data.filter((d) => d.date <= startDateStr);
    const startValue =
      beforeStart.length > 0
        ? beforeStart[beforeStart.length - 1]
        : filtered[0];
    filtered = [{ ...startValue, date: startDateStr }, ...filtered];
  } else if (filtered.length === 0 && data.length > 0) {
    const lastValue = data[data.length - 1];
    filtered = [
      { ...lastValue, date: startDateStr },
      { ...lastValue, date: todayStr },
    ];
  }

  return filtered;
}

const NET_WORTH_SERIES_KEYS = [
  "total",
  "cash",
  "investments",
  "crypto",
] as const;

/** Filter each breakdown series like its standalone chart, then merge by date. */
export function filterMultiSeriesForRange(
  data: NetWorthChartPoint[],
  range: ChartRange,
  today = new Date(),
): NetWorthChartPoint[] {
  const filteredPerKey = NET_WORTH_SERIES_KEYS.map((key) =>
    filterSeriesForRange(
      data.map((d) => ({ date: d.date, total: d[key] })),
      range,
      today,
    ),
  );

  const dateSet = new Set<string>();
  for (const series of filteredPerKey) {
    for (const p of series) dateSet.add(p.date);
  }

  return [...dateSet].sort((a, b) => a.localeCompare(b)).map((date) => {
    const point = { date } as NetWorthChartPoint;
    for (let i = 0; i < NET_WORTH_SERIES_KEYS.length; i++) {
      const key = NET_WORTH_SERIES_KEYS[i];
      const match = filteredPerKey[i].find((p) => p.date === date);
      point[key] = match?.total ?? 0;
    }
    return point;
  });
}

/** Percent change between current value and the closest snapshot ~N days ago. */
export function computeSnapshotTrend<T extends { date: string }>(
  history: T[],
  current: number,
  getValue: (row: T) => number,
  daysBack = 30,
  today = new Date(),
): number | null {
  if (history.length === 0) return null;

  const target = new Date(today);
  target.setDate(target.getDate() - daysBack);
  const targetStr = target.toISOString().slice(0, 10);

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const past =
    sorted.filter((row) => row.date <= targetStr).pop() ?? sorted[0];
  const pastValue = getValue(past);

  if (pastValue <= 0) return null;
  return ((current - pastValue) / pastValue) * 100;
}

/** Pick X-axis label; adds year when labels would collide or range spans years. */
export function formatChartXTick(date: string, allDates: string[]): string {
  const parts = date.split("-");
  if (parts.length !== 3) return date.slice(5);

  const [year, month, day] = parts;
  const dayMonth = `${day}/${month}`;

  const dayMonthLabels = allDates.map((d) => {
    const p = d.split("-");
    return p.length === 3 ? `${p[2]}/${p[1]}` : d;
  });
  const hasDuplicateLabels =
    new Set(dayMonthLabels).size < dayMonthLabels.length;
  const spansYears = new Set(allDates.map((d) => d.slice(0, 4))).size > 1;

  if (hasDuplicateLabels || spansYears) {
    return `${day}/${month}/${year.slice(2)}`;
  }
  return dayMonth;
}

/** Limit X ticks for sparse series so labels do not crowd the corner. */
export function pickChartXTicks(dates: string[]): string[] | undefined {
  if (dates.length === 0 || dates.length > 8) return undefined;

  const candidates = [
    dates[0],
    ...(dates.length > 2 ? [dates[Math.floor(dates.length / 2)]] : []),
    ...(dates.length > 1 ? [dates[dates.length - 1]] : []),
  ];

  const ticks: string[] = [];
  const seenLabels = new Set<string>();

  for (const date of candidates) {
    const label = formatChartXTick(date, dates);
    if (!seenLabels.has(label)) {
      seenLabels.add(label);
      ticks.push(date);
    }
  }

  return ticks.length > 0 ? ticks : [dates[0]];
}
