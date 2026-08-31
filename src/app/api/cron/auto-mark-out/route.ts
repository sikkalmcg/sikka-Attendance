import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Cron Job Entrypoint for Server-side Automatic Mark OUT.
 * Evaluates active attendance sessions:
 * - Session 1: auto mark out after 16 hours (credited 8h)
 * - Session 2: auto mark out after 8 hours (credited 4h)
 */
export async function GET(req: Request) {
  return executeAutoMarkOutCron(req);
}

export async function POST(req: Request) {
  return executeAutoMarkOutCron(req);
}

async function executeAutoMarkOutCron(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret") || searchParams.get("key");
    const authHeader = req.headers.get("authorization");

    const expectedSecret = process.env.CRON_SECRET || process.env.SCHEDULER_SECRET;

    if (expectedSecret) {
      const isAuthorized =
        secret === expectedSecret ||
        authHeader === `Bearer ${expectedSecret}`;

      if (!isAuthorized) {
        return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
      }
    }

    const { GET: handleAutoMarkOut } = await import("@/app/api/attendance/auto-mark-out/route");
    const res = await handleAutoMarkOut();
    const data = await res.json();

    return NextResponse.json({
      success: true,
      job: "AUTOMATIC_MARK_OUT_CRON",
      executedAt: new Date().toISOString(),
      result: data,
    });
  } catch (error: any) {
    console.error("Cron auto-mark-out error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Cron execution failed" },
      { status: 500 }
    );
  }
}
