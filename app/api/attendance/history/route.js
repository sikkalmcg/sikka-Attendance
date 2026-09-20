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
  formatKolkataDateTime,
  formatHoursHHMM,
  formatWorkingHours,
  calculateWorkingMinutes,
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
    }).select('employeeId employeeName designation plantId plantName markInPlantId markInPlantName markInLocationType inPlant outPlant street markInPlant markOutPlant markInAt inDate inTime inDateTime markOutAt outDate outTime outDateTime markOutType markOutByUserId markOutByUserName markOutPlantName status attendanceType workingMinutes hours approvalStatus approved approvedBy approvedAt attendanceDate date remarks remark manualAttendanceBy markInManualBy markOutManualBy mark_in_datetime mark_out_datetime mark_in_time mark_out_time loginTime logoutTime createdAt updatedAt')
      .lean()
      .sort({ markInAt: -1, inDate: -1, inTime: -1, inDateTime: -1, createdAt: -1 });

    const Employee = (await import('@/models/Employee')).default;
    const empDoc = await Employee.findOne({
      $or: [
        { employeeId: session.employeeId },
        { employeeId: session.sub },
        { id: session.sub },
        { _id: session.sub },
        ...(session.aadhaarNumber ? [{ aadhaarNumber: session.aadhaarNumber }, { aadhaar: session.aadhaarNumber }] : []),
      ],
    }).select('plantName plantId unitIds designation fullName name firstName lastName').lean();

    const employeeAssignedPlant = empDoc?.plantName || session.plantName || '';

    // Match attendance records against every calendar date
    const recordByDate = new Map();
    for (const raw of rawRecords) {
      const rawObj = typeof raw.toObject === 'function' ? raw.toObject() : raw;
      const norm = normalizeAttendance(rawObj);
      const dateKey = norm.attendanceDate || getAttendanceDateString(rawObj);
      if (dateKey && !recordByDate.has(dateKey)) {
        recordByDate.set(dateKey, { ...norm, _raw: rawObj });
      }
    }

    const docFirstLast = `${empDoc?.firstName || ''} ${empDoc?.lastName || ''}`.trim();
    const resolvedDocName = empDoc?.name || empDoc?.fullName || (docFirstLast || '');
    const employeeName = session.fullName || (resolvedDocName && resolvedDocName.toLowerCase() !== 'employee' ? resolvedDocName : (session.employeeId || ''));

    // Section 5: Show every calendar date (newest first)
    const fullHistory = calendarDates.map(({ isoDate, formattedDate }) => {
      const existing = recordByDate.get(isoDate);

      if (existing) {
        const isAbsent = existing.status === 'ABSENT';
        const raw = existing._raw || {};
        const isHistoricalRange = isoDate >= '2026-06-01' && isoDate <= '2026-09-17';

        const empId = session.employeeId || existing.employeeId || raw.employeeId || raw.empId || 'EMP';
        const empName = session.fullName || existing.employeeName || raw.employeeName || raw.name || employeeName;
        const employeeDetails = `${empId} / ${empName}`;

        let markInDateTime = '-';
        let markOutDateTime = '-';

        if (!isAbsent) {
          // Historical records (01-Jun-2026 to 17-Sep-2026): extract original values from MongoDB without recalculation
          if (isHistoricalRange && (raw.inTime || existing.inTime)) {
            const rawInDate = raw.inDate || raw.date || existing.attendanceDate || isoDate;
            markInDateTime = `${formatKolkataDate(rawInDate)}, ${raw.inTime || existing.inTime}`;
          } else if (existing.markInAt) {
            markInDateTime = formatKolkataDateTime(existing.markInAt);
          } else if (raw.inTime || existing.inTime) {
            const rawInDate = raw.inDate || raw.date || existing.attendanceDate || isoDate;
            markInDateTime = `${formatKolkataDate(rawInDate)}, ${raw.inTime || existing.inTime}`;
          }

          if (isHistoricalRange && (raw.outTime || existing.outTime)) {
            const rawOutDate = raw.outDate || raw.inDate || raw.date || existing.attendanceDate || isoDate;
            markOutDateTime = `${formatKolkataDate(rawOutDate)}, ${raw.outTime || existing.outTime}`;
          } else if (existing.status === 'ACTIVE' && !existing.markOutAt) {
            markOutDateTime = 'Pending';
          } else if (existing.markOutAt) {
            markOutDateTime = formatKolkataDateTime(existing.markOutAt);
          } else if (raw.outTime || existing.outTime) {
            const rawOutDate = raw.outDate || raw.inDate || raw.date || existing.attendanceDate || isoDate;
            markOutDateTime = `${formatKolkataDate(rawOutDate)}, ${raw.outTime || existing.outTime}`;
          }
        }

        // Working hours calculation: (Mark Out Date & Time - Mark In Date & Time)
        let workingHour = '-';
        if (!isAbsent) {
          if (existing.status === 'ACTIVE' || !existing.markOutAt) {
            workingHour = '-';
          } else if (existing.markInAt && existing.markOutAt) {
            const inMs = new Date(existing.markInAt).getTime();
            const outMs = new Date(existing.markOutAt).getTime();
            if (!isNaN(inMs) && !isNaN(outMs) && outMs >= inMs) {
              const diffMinutes = calculateWorkingMinutes(inMs, outMs);
              workingHour = formatWorkingHours(diffMinutes);
            } else {
              workingHour = '00:00 Hours';
            }
          } else if (existing.workingMinutes > 0) {
            workingHour = formatWorkingHours(existing.workingMinutes);
          } else if (raw.hours) {
            workingHour = formatWorkingHours(Math.round(Number(raw.hours) * 60));
          } else {
            workingHour = '00:00 Hours';
          }
        }

        const status = isAbsent ? 'Absent' : (existing.status === 'ACTIVE' && !existing.markOutAt ? 'Active' : 'Present');

        const cleanPlant = (val) => {
          if (!val || typeof val !== 'string') return '';
          const t = val.trim();
          return (t === 'Manufacturing Plant' || t === '-' || t.toLowerCase() === 'n/a') ? '' : t;
        };

        let markInPlant = '-';
        let markOutPlant = '-';
        let markOutType = '-';

        if (!isAbsent) {
          if (existing.markInLocationType === 'WORK_FROM_HOME' || raw.workType === 'WORK_FROM_HOME') {
            markInPlant = 'Outside Plant - WFM';
          } else if (existing.markInLocationType === 'FIELD_WORK' || raw.workType === 'FIELD_WORK') {
            markInPlant = 'Outside Plant - Field Work';
          } else {
            const resolvedMarkIn =
              cleanPlant(raw.inPlant) ||
              cleanPlant(existing.markInPlantName) ||
              cleanPlant(existing.plantName) ||
              cleanPlant(raw.markInPlant) ||
              cleanPlant(raw.plantName) ||
              cleanPlant(raw.street) ||
              employeeAssignedPlant ||
              'Authorized Plant';
            markInPlant = resolvedMarkIn;
          }

          if (existing.status === 'ACTIVE' && !existing.markOutAt) {
            markOutPlant = 'Under Process';
            markOutType = '-';
          } else if (existing.markOutAt) {
            if (
              existing.autoMarkOut ||
              existing.markOutType === 'Auto-Out' ||
              existing.markOutPlantName === 'Auto-Out' ||
              String(raw.outType || '').toLowerCase().includes('auto')
            ) {
              markOutPlant = 'Auto-Out';
              markOutType = 'Auto-Out';
            } else if (
              existing.markOutPlantName === 'Outside-Out' ||
              raw.markOutWithinPlantRadius === false ||
              String(raw.outPlant || '').toLowerCase() === 'outside-out'
            ) {
              markOutPlant = 'Outside-Out';
              markOutType = 'Manual Mark-Out';
            } else {
              markOutPlant =
                cleanPlant(raw.outPlant) ||
                cleanPlant(existing.markOutPlantName) ||
                cleanPlant(raw.markOutPlant) ||
                markInPlant;
              markOutType = 'Manual Mark-Out';
            }
          } else {
            markOutPlant = '-';
            markOutType = '-';
          }
        }

        return {
          id: existing.id || `att-${isoDate}`,
          employeeDetails,
          employeeName: empName,
          attendanceDate: formattedDate,
          date: formattedDate,
          isoDate,
          markInDateTime,
          markOutDateTime,
          markInTime: markInDateTime,
          markOutTime: markOutDateTime,
          workingHour,
          workingHours: workingHour,
          status,
          markInPlant,
          markOutPlant,
          markOutType,
          isAbsent,
          hasRecord: true,
          rawRecord: existing,
        };
      }

      // If attendance does NOT exist: Display Absent
      const absentDetails = `${session.employeeId || 'EMP'} / ${session.fullName || employeeName}`;
      return {
        id: `absent-${isoDate}`,
        employeeDetails: absentDetails,
        employeeName,
        attendanceDate: formattedDate,
        date: formattedDate,
        isoDate,
        markInDateTime: '-',
        markOutDateTime: '-',
        markInTime: '-',
        markOutTime: '-',
        workingHour: '-',
        workingHours: '-',
        status: 'Absent',
        markInPlant: '-',
        markOutPlant: '-',
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

