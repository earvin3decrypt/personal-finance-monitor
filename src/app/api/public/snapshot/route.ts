import { NextResponse, type NextRequest } from "next/server";
import { isLocalRequest } from "@/lib/loopback";
import { recordPortfolioSnapshot } from "@/lib/snapshot";

export async function GET(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  try {
    const result = await recordPortfolioSnapshot();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[snapshot]", error);
    return NextResponse.json(
      { ok: false, error: "Could not record snapshot" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
