import { NextResponse, type NextRequest } from "next/server";
import { buildFinanceExportZip } from "@/lib/export-csv";
import { isLocalRequest } from "@/lib/loopback";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const { filename, buffer } = await buildFinanceExportZip();
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[export]", error);
    return NextResponse.json(
      { ok: false, error: "Could not build export" },
      { status: 500 },
    );
  }
}
