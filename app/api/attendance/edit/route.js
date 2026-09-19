import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import Employee from '@/models/Employee';
import { authorizeSystemUser, getScopedPlantContext, hasAttendancePlantAccess } from '@/lib/rbac';
import { normalizeAttendance } from '@/lib/normalize';
import { formatInTimeZone } from 'date-fns-tz';
import { parseKolkataDateTime, isFutureKolkataDateTime } from '@/lib/timezone';
import { getAuthoritativeUser } from '@/lib/auth';

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
      const queryIds = [{ _id: id }, { id }];
      if (mongoose.Types.ObjectId.isValid(id)) {
        queryIds.push({ _id: new mongoose.Types.ObjectId(id) });
      }
      record = await Attendance.findOne({ $or: queryIds });
    }

    if (!record) {
      return NextResponse.json({ error: 'Attendance record not found.' }, { status: 404 });
    }

    // Plant-Level Data Security: verify logged in user has access to this plant and employee
    const plantScope = await getScopedPlantContext(session);
    if (!plantScope.isAllPlants) {
      const empDoc = await Employee.findOne({
        $or: [
          { employeeId: record.employeeId },
          { id: record.employeeId },
          { _id: record.employeeId },
        ],
      }).lean();

      if (!hasAttendancePlantAccess(plantScope, record, empDoc)) {
        return NextResponse.json(
          { error: 'Access denied: You do not have permission to edit records for this plant or employee.' },
          { status: 403 }
        );
      }
    }

    // Preserve previous values for audit trail
    const previousMarkIn = record.markInAt || (record.inDateTime ? new Date(record.inDateTime) : null);
    const previousMarkOut = record.markOutAt || (record.outDateTime ? new Date(record.outDateTime) : null);
    const now = new Date();

    // Recalculate attendanceDate based on updated markInAt (IST date of Mark IN, not Mark OUT)
    const attendanceDate = formatInTimeZone(inDate, IST, 'yyyy-MM-dd');

    const { userFullName, authUserId } = await getAuthoritativeUser(session);
    const loggedInUsername = userFullName;

    // Check if Mark In or Mark Out was changed/entered
    const isMarkInEdited = !previousMarkIn || inDate.getTime() !== previousMarkIn.getTime();
    const isMarkOutEdited =
      (!previousMarkOut && outDate) ||
      (previousMarkOut && !outDate) ||
      (previousMarkOut && outDate && outDate.getTime() !== previousMarkOut.getTime());

    // Build audit entry
    const auditEntry = {
      editedBy: loggedInUsername,
      editedAt: now,
      previousMarkIn,
      previousMarkOut,
      newMarkIn: inDate,
      newMarkOut: outDate,
      remarks: remarks || 'Attendance time adjusted by authorized user',
    };

    const auditHistory = Array.isArray(record.auditHistory) ? [...record.auditHistory, auditEntry] : [auditEntry];

    const updateFields = {
      markInAt: inDate,
      markOutAt: outDate,
      workingMinutes,
      status: outDate ? 'COMPLETED' : 'ACTIVE',
      editedBy: loggedInUsername,
      editedAt: now,
      attendanceDate,
      auditHistory,
    };

    if (isMarkInEdited) {
      updateFields.markInManualBy = loggedInUsername;
    }
    if (isMarkOutEdited) {
      updateFields.markOutManualBy = loggedInUsername;
      if (outDate) {
        updateFields.markOutType = 'MANUAL';
        updateFields.markOutByUserId = authUserId;
        updateFields.markOutByUserName = userFullName;
      } else {
        updateFields.markOutType = 'SELF';
        updateFields.markOutByUserId = null;
        updateFields.markOutByUserName = null;
      }
    }

    const finalInManual = updateFields.markInManualBy || record.markInManualBy || null;
    const finalOutManual = updateFields.markOutManualBy || record.markOutManualBy || null;

    if (finalInManual && finalOutManual) {
      updateFields.manualAttendanceBy = (finalInManual === finalOutManual) ? finalInManual : finalInManual;
    } else if (finalInManual || finalOutManual) {
      updateFields.manualAttendanceBy = finalInManual || finalOutManual;
    } else if (!record.manualAttendanceBy) {
      updateFields.manualAttendanceBy = loggedInUsername;
    }

    if (remarks) {
      updateFields.remarks = remarks;
    } else if (!record.remarks) {
      if (isMarkInEdited && isMarkOutEdited) {
        updateFields.remarks = `Mark In & Mark Out Manual by ${loggedInUsername}`;
      } else if (isMarkInEdited) {
        updateFields.remarks = `Mark In Manual by ${loggedInUsername}`;
      } else if (isMarkOutEdited) {
        updateFields.remarks = `Mark Out Manual by ${loggedInUsername}`;
      }
    }

    const updated = await Attendance.findByIdAndUpdate(
      record._id,
      { $set: updateFields },
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
