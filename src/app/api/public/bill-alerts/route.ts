import { NextResponse, type NextRequest } from "next/server";
import { getBillAlertItems } from "@/lib/bills";
import { isLocalRequest } from "@/lib/loopback";
import { getBillNotificationsEnabled } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const items = getBillAlertItems();
    return NextResponse.json({
      ok: true,
      count: items.length,
      items,
      notificationsEnabled: getBillNotificationsEnabled(),
    });
  } catch (error) {
    console.error("[bill-alerts]", error);
    return NextResponse.json(
      { ok: false, error: "Could not load bill alerts" },
      { status: 500 },
    );
  }
}
