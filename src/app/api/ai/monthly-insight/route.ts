import { NextResponse } from "next/server";
import { generateMonthlyInsight } from "@/lib/monthly-insight";
import { todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

function resolveMonth(request: Request): string {
  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month");
  return monthParam && /^\d{4}-\d{2}$/.test(monthParam)
    ? monthParam
    : todayISO().slice(0, 7);
}

/** Generation is POST-only so opening the dashboard never cold-starts the model. */
export async function POST(request: Request) {
  const month = resolveMonth(request);
  const result = await generateMonthlyInsight(month);
  const status =
    result.status === "ok" ? 200 : result.status === "unavailable" ? 503 : 500;

  return NextResponse.json(result, { status });
}
