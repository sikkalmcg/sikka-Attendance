import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import { authorizeEmployee } from '@/lib/rbac';
import { processAutoMarkOut } from '@/lib/autoMarkOut';
import { normalizeAttendance } from '@/lib/normalize';
import { getTodayDateString, getISTMidnightAfterDate } from '@/lib/timezone';
import { formatInTimeZone } from 'date-fns-tz';

const IST = 'Asia/Kolkata';

export async function GET(request) {
  const auth = await authorizeEmployee(request);
  if (!auth.authorized) return auth.response;

  const { session } = auth;

  try {
    await connectToDatabase();

    // Trigger auto-mark-out processor to close any stale sessions (>18h)
    await processAutoMarkOut();

    const employeeQuery = {
      $or: [
        { employeeId: session.employeeId },
        { employeeId: session.sub },
        { aadhaarNumber: session.aadhaarNumber },
      ],
    };

    // ── 1. Check for an active (ongoing) session ─────────────────────────────
    const activeSessionRaw = await Attendance.findOne({
      $and: [
        employeeQuery,
        { $or: [{ status: 'ACTIVE' }, { status: 'Open' }, { status: 'OPEN' }] },
      ],
    }).sort({ markInAt: -1, inDateTime: -1, createdAt: -1 });

    // ── 2. Find the most recent COMPLETED session ────────────────────────────
    const latestCompletedRaw = await Attendance.findOne({
      $and: [
        employeeQuery,
        { $or: [{ status: 'COMPLETED' }, { status: 'Closed' }, { status: 'AUTO_COMPLETED' }] },
      ],
    }).sort({ markInAt: -1, inDateTime: -1, createdAt: -1 });

    // ── 3. Today's latest session (for summary display) ──────────────────────
    const todayISTStr = getTodayDateString(); // yyyy-MM-dd in IST
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const latestTodayRaw = await Attendance.findOne({
      $and: [
        employeeQuery,
        {
          $or: [
            { attendanceDate: todayISTStr },
            { markInAt: { $gte: startOfToday } },
            { inDateTime: { $gte: startOfToday } },
            { date: todayISTStr },
            { inDate: todayISTStr },
          ],
        },
      ],
    }).sort({ markInAt: -1, inDateTime: -1, createdAt: -1 });

    const activeSession = activeSessionRaw ? normalizeAttendance(activeSessionRaw) : null;
    const todaySession = latestTodayRaw ? normalizeAttendance(latestTodayRaw) : null;

    // ── 4. Next Mark IN eligibility ──────────────────────────────────────────
    /**
     * Rules (from requirements §4–7):
     *
     * A) If active session exists → Mark IN disabled, Mark OUT enabled
     *
     * B) If no active session but last COMPLETED session's attendanceDate == today IST:
     *    → Mark IN disabled (same-day rule §6), Mark OUT disabled
     *    → Next Mark IN enabled at: midnight IST of (attendanceDate + 1 day)
     *
     * C) If no active session and last COMPLETED session's attendanceDate == yesterday IST,
     *    and that session's markOutAt was today IST (overnight §5 Rule B):
     *    → Mark IN enabled (overnight completed, next day already started)
     *
     * D) Otherwise → Mark IN enabled
     */

    let canMarkIn = true;
    let canMarkOut = false;
    let blockReason = null;
    let nextMarkInAfter = null; // ISO string: earliest time employee can next Mark IN

    if (activeSession) {
      // A: Active session exists
      canMarkIn = false;
      canMarkOut = true;
      blockReason = 'You have an active attendance session. Please Mark OUT first.';
    } else if (latestCompletedRaw) {
      // Get the attendance date of the latest completed session
      const completedAttDate =
        latestCompletedRaw.attendanceDate ||
        (latestCompletedRaw.markInAt
          ? formatInTimeZone(new Date(latestCompletedRaw.markInAt), IST, 'yyyy-MM-dd')
          : null);

      if (completedAttDate) {
        const nowIST = formatInTimeZone(new Date(), IST, 'yyyy-MM-dd');

        if (completedAttDate === nowIST) {
          // B: Completed session is from today — block Mark IN until midnight tonight IST
          canMarkIn = false;
          canMarkOut = false;
          blockReason = 'Attendance already marked for today. Next Mark IN available from tomorrow.';
          nextMarkInAfter = getISTMidnightAfterDate(completedAttDate).toISOString();
        }
        // C & D: completedAttDate is yesterday or older → Mark IN is open
        // (overnight rule: after completing an overnight session, next calendar day is open)
      }
    }

    return NextResponse.json({
      success: true,
      hasActiveSession: !!activeSession,
      activeSession,
      todaySession,
      canMarkIn,
      canMarkOut,
      blockReason,
      nextMarkInAfter,
    });
  } catch (error) {
    console.error('Active session check error:', error);
    return NextResponse.json({ error: 'Failed to retrieve active session' }, { status: 500 });
  }
}
