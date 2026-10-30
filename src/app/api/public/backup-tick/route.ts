import { NextResponse, type NextRequest } from "next/server";
import { runDailyBackupIfNeeded } from "@/lib/backups";
import { isLocalRequest } from "@/lib/loopback";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = runDailyBackupIfNeeded();
    return NextResponse.json({
      ok: true,
      created: result.created,
      path: result.path ?? null,
      pruned: result.pruned,
      message: result.message,
    });
  } catch (error) {
    console.error("[backup-tick]", error);
    return NextResponse.json(
      { ok: false, error: "Could not run backup" },
      { status: 500 },
    );
  }
}
