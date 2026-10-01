import { NextResponse, type NextRequest } from "next/server";
import { recordPortfolioSnapshot } from "@/lib/snapshot";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** The app is single-user with no auth, so only accept requests from this machine. */
function isLocalRequest(request: NextRequest): boolean {
  const host = request.headers.get("host")?.split(":")[0] ?? "";
  const hostname = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host;
  if (!LOCAL_HOSTS.has(hostname)) return false;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const client = forwarded.split(",")[0].trim();
    if (!LOCAL_HOSTS.has(client) && client !== "::ffff:127.0.0.1") return false;
  }
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
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
