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

    const Employee = (await import('@/models/Employee')).default;
    const empDoc = await Employee.findOne(employeeQuery).select('plantName plantId unitIds designation fullName').lean();
    const assignedPlant = empDoc?.plantName || session.plantName || '';

    const cleanPlant = (val) => {
      if (!val || typeof val !== 'string') return '';
      const t = val.trim();
      return (t === 'Manufacturing Plant' || t === '-' || t.toLowerCase() === 'n/a') ? '' : t;
    };

    const activeSession = activeSessionRaw ? normalizeAttendance(activeSessionRaw) : null;
    if (activeSession) {
      const rawObj = activeSessionRaw.toObject ? activeSessionRaw.toObject() : activeSessionRaw;
      let realPlant = activeSession.markInPlantName;
      if (!realPlant || realPlant === '-' || realPlant === 'Authorized Plant') {
        if (rawObj.markInLocationType === 'WORK_FROM_HOME' || rawObj.workType === 'WORK_FROM_HOME') {
          realPlant = 'Outside Plant - WFM';
        } else if (rawObj.markInLocationType === 'FIELD_WORK' || rawObj.workType === 'FIELD_WORK') {
          realPlant = 'Outside Plant - Field Work';
        } else {
          realPlant =
            cleanPlant(rawObj.markInPlantName) ||
            cleanPlant(rawObj.inPlant) ||
            cleanPlant(rawObj.plantName) ||
            assignedPlant ||
            'Authorized Plant';
        }
      }
      activeSession.plantName = realPlant;
      activeSession.markInPlantName = realPlant;
      activeSession.markOutPlantName = 'Under Process';
      activeSession.markOutDateTime = 'Pending';
    }

    const todaySession = latestTodayRaw ? normalizeAttendance(latestTodayRaw) : null;
    if (todaySession) {
      const rawObj = latestTodayRaw.toObject ? latestTodayRaw.toObject() : latestTodayRaw;
      const realPlant =
        cleanPlant(todaySession.plantName) ||
        cleanPlant(todaySession.markInPlantName) ||
        cleanPlant(rawObj.inPlant) ||
        cleanPlant(rawObj.plantName) ||
        assignedPlant ||
        'Authorized Plant';
      todaySession.plantName = realPlant;
      todaySession.markInPlantName = realPlant;
    }

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

    const nowIST = formatInTimeZone(new Date(), IST, 'yyyy-MM-dd');

    if (activeSession) {
      // A: Active session exists
      canMarkIn = false;
      canMarkOut = true;
      blockReason = 'You have an active attendance session. Please Mark OUT first.';
    } else if (latestTodayRaw && (latestTodayRaw.markOutAt || ['COMPLETED', 'Closed', 'AUTO_COMPLETED'].includes(latestTodayRaw.status))) {
      // B: A session for today was already recorded and completed
      canMarkIn = false;
      canMarkOut = false;
      blockReason = 'Mark In already completed for this date.';
      nextMarkInAfter = getISTMidnightAfterDate(todayISTStr).toISOString();
    } else if (latestCompletedRaw) {
      // Get the attendance date of the latest completed session
      const completedAttDate =
        latestCompletedRaw.attendanceDate ||
        (latestCompletedRaw.markInAt
          ? formatInTimeZone(new Date(latestCompletedRaw.markInAt), IST, 'yyyy-MM-dd')
          : null);

      if (completedAttDate && completedAttDate === nowIST) {
        // Completed session is from today — block Mark IN until midnight tonight IST
        canMarkIn = false;
        canMarkOut = false;
        blockReason = 'Mark In already completed for this date.';
        nextMarkInAfter = getISTMidnightAfterDate(completedAttDate).toISOString();
      }
    }

    return NextResponse.json({
      success: true,
      hasActiveSession: !!activeSession,
      activeSession,
      todaySession,
      employee: {
        employeeId: session.employeeId || session.sub || '',
        fullName: session.fullName || empDoc?.fullName || 'Employee',
        designation: session.designation || empDoc?.designation || 'Staff',
        plantId: empDoc?.plantId || session.plantId || '',
        plantName: assignedPlant,
      },
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
