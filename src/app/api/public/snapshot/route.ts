import { NextResponse, type NextRequest } from "next/server";
import { isLoopbackAddress, isLoopbackHostHeader } from "@/lib/loopback";
import { recordPortfolioSnapshot } from "@/lib/snapshot";

/** The app is single-user with no auth, so only accept requests from this machine. */
function isLocalRequest(request: NextRequest): boolean {
  if (!isLoopbackHostHeader(request.headers.get("host"))) return false;

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost && !isLoopbackHostHeader(forwardedHost.split(",")[0] ?? "")) {
    return false;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded && !isLoopbackAddress(forwarded.split(",")[0] ?? "")) return false;
  return true;
}

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
