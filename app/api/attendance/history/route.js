import { NextResponse } from 'next/server';
import { formatInTimeZone } from 'date-fns-tz';
import { subDays } from 'date-fns';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import { authorizeEmployee } from '@/lib/rbac';
import { processAutoMarkOut } from '@/lib/autoMarkOut';
import { normalizeAttendance } from '@/lib/normalize';
import {
  formatKolkataDate,
  formatKolkataTime,
  formatHoursHHMM,
  getAttendanceDateString,
} from '@/lib/timezone';

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

export async function GET(request) {
  const auth = await authorizeEmployee(request);
  if (!auth.authorized) return auth.response;

  const { session } = auth;

  try {
    await connectToDatabase();
    await processAutoMarkOut();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page')) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit')) || 10));

    // Section 4: Display Current Date + previous 59 calendar days = exactly 60 calendar days
    const TOTAL_CALENDAR_DAYS = 60;
    const now = new Date();
    const calendarDates = [];

    for (let i = 0; i < TOTAL_CALENDAR_DAYS; i++) {
      const d = subDays(now, i);
      const isoDate = formatInTimeZone(d, APP_TIMEZONE, 'yyyy-MM-dd');
      const formattedDate = formatInTimeZone(d, APP_TIMEZONE, 'dd-MMM-yyyy');
      calendarDates.push({ isoDate, formattedDate, dateObj: d });
    }

    const toDate = calendarDates[0].isoDate; // Today
    const fromDate = calendarDates[TOTAL_CALENDAR_DAYS - 1].isoDate; // 59 days ago

    // Section 9: Query DB with a single optimized request covering the complete 60-day date range
    const rawRecords = await Attendance.find({
      $and: [
        {
          $or: [
            { employeeId: session.employeeId },
            { employeeId: session.sub },
            { employeeId: session.id },
            { aadhaarNumber: session.aadhaarNumber },
            { aadhaar: session.aadhaarNumber },
          ],
        },
        {
          $or: [
            { attendanceDate: { $gte: fromDate, $lte: toDate } },
            { inDate: { $gte: fromDate, $lte: toDate } },
            { date: { $gte: fromDate, $lte: toDate } },
            {
              markInAt: {
                $gte: new Date(`${fromDate}T00:00:00+05:30`),
                $lte: new Date(`${toDate}T23:59:59+05:30`),
              },
            },
            {
              inDateTime: {
                $gte: new Date(`${fromDate}T00:00:00+05:30`),
                $lte: new Date(`${toDate}T23:59:59+05:30`),
              },
            },
          ],
        },
      ],
    }).sort({ markInAt: -1, inDateTime: -1, createdAt: -1 });

    // Match attendance records against every calendar date
    const recordByDate = new Map();
    for (const raw of rawRecords) {
      const norm = normalizeAttendance(raw);
      const dateKey = norm.attendanceDate || getAttendanceDateString(raw);
      if (dateKey && !recordByDate.has(dateKey)) {
        recordByDate.set(dateKey, norm);
      }
    }

    const employeeName = session.fullName || 'Employee';

    // Section 5: Show every calendar date (newest first)
    const fullHistory = calendarDates.map(({ isoDate, formattedDate }) => {
      const existing = recordByDate.get(isoDate);

      if (existing) {
        const isAbsent = existing.status === 'ABSENT';
        const markInTime = isAbsent
          ? '-'
          : existing.markInAt
          ? formatKolkataTime(existing.markInAt)
          : '-';

        const markOutTime = isAbsent
          ? '-'
          : existing.status === 'ACTIVE' && !existing.markOutAt
          ? 'Active'
          : existing.markOutAt
          ? formatKolkataTime(existing.markOutAt)
          : '-';

        const workingHour = isAbsent
          ? '-'
          : existing.workingMinutes > 0
          ? formatHoursHHMM(existing.workingMinutes)
          : '00:00';

        const status = isAbsent ? 'Absent' : 'Present';

        return {
          id: existing.id || `att-${isoDate}`,
          employeeName,
          date: formattedDate,
          isoDate,
          markInTime,
          markOutTime,
          workingHour,
          status,
          isAbsent,
          hasRecord: true,
          rawRecord: existing,
        };
      }

      // If attendance does NOT exist: Display Employee Name, Date, -, -, -, Absent
      return {
        id: `absent-${isoDate}`,
        employeeName,
        date: formattedDate,
        isoDate,
        markInTime: '-',
        markOutTime: '-',
        workingHour: '-',
        status: 'Absent',
        isAbsent: true,
        hasRecord: false,
      };
    });

    // Section 6 & 7: History Pagination (10 calendar days per page -> 60 / 10 = 6 pages)
    const totalDays = fullHistory.length;
    const totalPages = Math.ceil(totalDays / limit);
    const startIndex = (page - 1) * limit;
    const paginatedHistory = fullHistory.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      history: paginatedHistory,
      pagination: {
        totalDays,
        page,
        limit,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
    });
  } catch (error) {
    console.error('History fetch error:', error);
    return NextResponse.json({ error: 'Failed to retrieve attendance history' }, { status: 500 });
  }
}

