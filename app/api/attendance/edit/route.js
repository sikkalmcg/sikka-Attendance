import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import { authorizeSystemUser } from '@/lib/rbac';
import { normalizeAttendance } from '@/lib/normalize';
import { formatInTimeZone } from 'date-fns-tz';
import { parseKolkataDateTime, isFutureKolkataDateTime } from '@/lib/timezone';

const IST = 'Asia/Kolkata';

export async function POST(request) {
  const auth = await authorizeSystemUser(request, 'approval');
  if (!auth.authorized) return auth.response;

  const { session } = auth;

  try {
    const { id, markInAt, markOutAt, remarks } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Attendance record ID is required.' }, { status: 400 });
    }

    if (!markInAt) {
      return NextResponse.json({ error: 'Mark IN Date & Time is required.' }, { status: 400 });
    }

    if (isFutureKolkataDateTime(markInAt)) {
      return NextResponse.json(
        { error: 'Future date or time is not allowed. Please select the current or past date and time.' },
        { status: 400 }
      );
    }

    const inDate = parseKolkataDateTime(markInAt);
    if (!inDate || isNaN(inDate.getTime())) {
      return NextResponse.json({ error: 'Invalid Mark IN Date/Time format.' }, { status: 400 });
    }

    let outDate = null;
    let workingMinutes = 0;

    if (markOutAt) {
      if (isFutureKolkataDateTime(markOutAt)) {
        return NextResponse.json(
          { error: 'Future date or time is not allowed. Please select the current or past date and time.' },
          { status: 400 }
        );
      }

      outDate = parseKolkataDateTime(markOutAt);
      if (!outDate || isNaN(outDate.getTime())) {
        return NextResponse.json({ error: 'Invalid Mark OUT Date/Time format.' }, { status: 400 });
      }

      if (outDate <= inDate) {
        return NextResponse.json({ error: 'Mark OUT must be strictly later than Mark IN.' }, { status: 400 });
      }

      const diffMs = outDate.getTime() - inDate.getTime();
      workingMinutes = Math.max(1, Math.round(diffMs / 60000));
    }

    await connectToDatabase();

    let record = null;
    try {
      record = await Attendance.findById(id);
    } catch (e) {}

    if (!record) {
      record = await Attendance.findOne({ $or: [{ _id: id }, { id: id }] });
    }

    if (!record) {
      return NextResponse.json({ error: 'Attendance record not found.' }, { status: 404 });
    }

    // Preserve previous values for audit trail
    const previousMarkIn = record.markInAt || (record.inDateTime ? new Date(record.inDateTime) : null);
    const previousMarkOut = record.markOutAt || (record.outDateTime ? new Date(record.outDateTime) : null);
    const now = new Date();

    // Recalculate attendanceDate based on updated markInAt (IST date of Mark IN, not Mark OUT)
    const attendanceDate = formatInTimeZone(inDate, IST, 'yyyy-MM-dd');

    // Build audit entry
    const auditEntry = {
      editedBy: session.fullName || session.username,
      editedAt: now,
      previousMarkIn,
      previousMarkOut,
      newMarkIn: inDate,
      newMarkOut: outDate,
      remarks: remarks || 'Attendance time adjusted by authorized user',
    };

    const auditHistory = Array.isArray(record.auditHistory) ? [...record.auditHistory, auditEntry] : [auditEntry];

    // Use $set to only update changed fields — manualAttendanceBy is never overwritten
    const updated = await Attendance.findByIdAndUpdate(
      record._id,
      {
        $set: {
          markInAt: inDate,
          markOutAt: outDate,
          workingMinutes,
          status: outDate ? 'COMPLETED' : 'ACTIVE',
          editedBy: session.fullName || session.username,
          editedAt: now,
          attendanceDate,
          auditHistory,
          ...(remarks ? { remarks } : {}),
        },
      },
      { new: true, runValidators: false }
    );

    return NextResponse.json({
      success: true,
      message: 'Attendance Record Updated Successfully',
      attendance: normalizeAttendance(updated),
    });
  } catch (error) {
    console.error('Edit attendance error:', error);
    return NextResponse.json({ error: error.message || 'Failed to edit attendance record' }, { status: 500 });
  }
}
