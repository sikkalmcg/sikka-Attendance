import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Cron Job Entrypoint for Automatic Shift Reminders.
 *
 * Can be triggered via:
 * - Vercel Cron (configured in vercel.json)
 * - Google Cloud Scheduler
 * - External Webhook / Cron Daemon (e.g. cron-job.org or curl)
 *
 * URL: /api/cron/shift-reminders?secret=YOUR_CRON_SECRET
 */
export async function GET(req: Request) {
  return executeCronJob(req);
}

export async function POST(req: Request) {
  return executeCronJob(req);
}

async function executeCronJob(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret") || searchParams.get("key");
    const authHeader = req.headers.get("authorization");

    const expectedSecret = process.env.CRON_SECRET || process.env.SCHEDULER_SECRET;

    // Optional secret check if configured in env
    if (expectedSecret) {
      const isAuthorized =
        secret === expectedSecret ||
        authHeader === `Bearer ${expectedSecret}`;

      if (!isAuthorized) {
        return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
      }
    }

    // Call shift reminders internal handler
    const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/notifications/shift-reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).catch(async () => {
      // Fallback: direct module invocation if running internally
      const { GET: handleReminders } = await import("@/app/api/notifications/shift-reminders/route");
      return handleReminders();
    });

    const data = await res.json();
    return NextResponse.json({
      success: true,
      job: "AUTOMATIC_SHIFT_REMINDERS_CRON",
      executedAt: new Date().toISOString(),
      result: data,
    });
  } catch (error: any) {
    console.error("Cron shift reminders error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Cron execution failed" },
      { status: 500 }
    );
  }
}
