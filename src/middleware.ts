import { NextResponse, type NextRequest } from "next/server";
import { isLoopbackAddress, isLoopbackHostHeader } from "@/lib/loopback";

/**
 * The app has no authentication. Reject anything that is not a loopback
 * browser request so a public bind or a DNS-rebinding page cannot read it.
 */
export function middleware(request: NextRequest) {
  if (!isLoopbackHostHeader(request.headers.get("host"))) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const first = forwardedHost.split(",")[0] ?? "";
    if (!isLoopbackHostHeader(first)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const client = forwardedFor.split(",")[0] ?? "";
    if (!isLoopbackAddress(client)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next static assets and public files. next/image re-enters the server
  // for local URLs (e.g. /logos/*) via an internal mock request that has no
  // Host header — if middleware runs there it returns JSON 403 and the
  // optimizer fails with "isn't a valid image".
  matcher: [
    "/((?!_next/static|_next/image|logos/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
