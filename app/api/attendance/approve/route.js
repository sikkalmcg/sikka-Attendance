import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import Employee from '@/models/Employee';
import { authorizeSystemUser, getScopedPlantContext } from '@/lib/rbac';
import { normalizeAttendance, normalizeEmployee } from '@/lib/normalize';
import {
  getAttendanceDateString,
  getTodayDateString,
  isFutureKolkataDate,
  isFutureKolkataDateTime,
} from '@/lib/timezone';

export async function POST(request) {
  const auth = await authorizeSystemUser(request, 'approval');
  if (!auth.authorized) return auth.response;

  const { session } = auth;

  try {
    const body = await request.json();
    const ids = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No attendance records selected for approval.' }, { status: 400 });
    }

    await connectToDatabase();

    const cleanIds = ids.map((id) => String(id).trim());
    const currentDate = getTodayDateString();
    const now = new Date();
    const approverName = session.fullName || session.username || 'Admin';

    // Separate synthetic absent IDs (e.g. "absent_EMP001_2026-09-17") from database IDs
    const syntheticAbsentIds = cleanIds.filter((id) => id.startsWith('absent_'));
    const dbIds = cleanIds.filter((id) => !id.startsWith('absent_'));

    // ── 1. Validate Synthetic Absent Records ─────────────────────────────────
    const syntheticApprovals = [];
    for (const synId of syntheticAbsentIds) {
      // Format: absent_${empId}_${date}
      const parts = synId.replace(/^absent_/, '').split('_');
      const date = parts.pop();
      const empId = parts.join('_');

      if (isFutureKolkataDate(date)) {
        return NextResponse.json(
          { error: 'Future date or time is not allowed. Please select the current or past date and time.' },
          { status: 400 }
        );
      }

      if (date === currentDate) {
        return NextResponse.json(
          {
            error: `Current-day attendance cannot be approved on the same day (${date}) for employee "${empId}".`,
            rule: 1,
            failedRecordId: synId,
          },
          { status: 400 }
        );
      }

      syntheticApprovals.push({ synId, empId, date });
    }

    // ── 2. Validate Existing DB Records ──────────────────────────────────────
    const objectIds = dbIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const records = dbIds.length > 0 ? await Attendance.find({
      $or: [
        { _id: { $in: [...dbIds, ...objectIds] } },
        { id: { $in: dbIds } },
      ],
    }) : [];

    if (dbIds.length > 0 && (!records || records.length === 0) && syntheticAbsentIds.length === 0) {
      return NextResponse.json({ error: 'Selected attendance record(s) not found.' }, { status: 404 });
    }

    // Plant-Level Data Security: Verify caller has plant permissions for all target records
    const plantScope = await getScopedPlantContext(session);
    if (!plantScope.isAllPlants) {
      for (const rec of records) {
        const recPlantId = rec.plantId || rec.markInPlantId;
        const recPlantName = rec.plantName || rec.markInPlantName || rec.inPlant;
        const hasPlantAccess =
          (recPlantId && plantScope.plantIds.includes(String(recPlantId))) ||
          (recPlantName && plantScope.plantNames.map((n) => n.toLowerCase()).includes(String(recPlantName).toLowerCase()));
        if (!hasPlantAccess) {
          return NextResponse.json(
            { error: `Access denied: You do not have permission to approve records for plant "${recPlantName || recPlantId}".` },
            { status: 403 }
          );
        }
      }
    }

    for (const rec of records) {
      const recDate = getAttendanceDateString(rec);
      const isAbsentStatus =
        String(rec.status || '').toUpperCase() === 'ABSENT' ||
        String(rec.attendanceType || '').toUpperCase() === 'ABSENT';
      const hasMarkIn = !isAbsentStatus && Boolean(rec.markInAt || rec.inDateTime || (rec.inDate && rec.inTime));
      const hasMarkOut = !isAbsentStatus && Boolean(rec.markOutAt || rec.outDateTime || (rec.outDate && rec.outTime));

      // Rule 8: Future date or time check
      if (
        isFutureKolkataDate(recDate) ||
        (rec.markInAt && isFutureKolkataDateTime(rec.markInAt)) ||
        (rec.markOutAt && isFutureKolkataDateTime(rec.markOutAt))
      ) {
        return NextResponse.json(
          { error: 'Future date or time is not allowed. Please select the current or past date and time.' },
          { status: 400 }
        );
      }

      // Rule 1: Current Date Attendance
      if (recDate === currentDate) {
        return NextResponse.json(
          {
            error: `Current-day attendance cannot be approved on the same day (${recDate}) for employee "${rec.employeeName || rec.employeeId}".`,
            rule: 1,
            failedRecordId: rec._id,
          },
          { status: 400 }
        );
      }

      // Rule 2: Past Date – Mark IN Complete but Mark OUT Incomplete
      if (hasMarkIn && !hasMarkOut) {
        return NextResponse.json(
          {
            error: `Cannot approve past date (${recDate}) attendance for "${rec.employeeName || rec.employeeId}": Mark IN is completed but Mark OUT is incomplete. The employee must first complete Mark OUT.`,
            rule: 2,
            failedRecordId: rec._id,
          },
          { status: 400 }
        );
      }
    }

    const updatedRecords = [];

    // ── 3. Commit Synthetic Absent Approvals ─────────────────────────────────
    for (const item of syntheticApprovals) {
      const rawEmp = await Employee.findOne({
        $or: [
          { employeeId: item.empId },
          { _id: item.empId },
          { id: item.empId },
        ],
      });

      const emp = rawEmp ? normalizeEmployee(rawEmp) : {
        employeeId: item.empId,
        fullName: item.empId,
        designation: 'Staff',
      };

      // Check if record was created in the meantime
      const existing = await Attendance.findOne({
        employeeId: emp.employeeId,
        $or: [{ attendanceDate: item.date }, { inDate: item.date }],
      });

      if (existing) {
        existing.status = 'ABSENT';
        existing.attendanceType = 'Absent';
        existing.approvalStatus = 'APPROVED';
        existing.approved = true;
        existing.approvedBy = approverName;
        existing.approvedAt = now;
        await existing.save();
        updatedRecords.push(normalizeAttendance(existing));
      } else {
        const created = await Attendance.create({
          employeeId: emp.employeeId,
          employeeName: emp.fullName,
          designation: emp.designation,
          aadhaarNumber: emp.aadhaarNumber,
          mobileNumber: emp.mobileNumber,
          plantId: emp.plantId || null,
          plantName: emp.plantName || '',
          attendanceDate: item.date,
          markInAt: null,
          markOutAt: null,
          workingMinutes: 0,
          status: 'ABSENT',
          attendanceType: 'Absent',
          approvalStatus: 'APPROVED',
          approved: true,
          approvedBy: approverName,
          approvedAt: now,
          remarks: 'Approved Absent',
        });
        updatedRecords.push(normalizeAttendance(created));
      }
    }

    // ── 4. Commit DB Records Approvals ───────────────────────────────────────
    for (const rec of records) {
      const isAbsentStatus =
        String(rec.status || '').toUpperCase() === 'ABSENT' ||
        String(rec.attendanceType || '').toUpperCase() === 'ABSENT';
      const hasMarkIn = !isAbsentStatus && Boolean(rec.markInAt || rec.inDateTime || (rec.inDate && rec.inTime));
      const hasMarkOut = !isAbsentStatus && Boolean(rec.markOutAt || rec.outDateTime || (rec.outDate && rec.outTime));

      const isAbsentApproval = !hasMarkIn && !hasMarkOut;

      rec.approvalStatus = 'APPROVED';
      rec.approved = true;
      rec.approvedBy = approverName;
      rec.approvedAt = now;

      if (isAbsentApproval) {
        rec.status = 'ABSENT';
        rec.attendanceType = 'Absent';
      }

      await rec.save();
      updatedRecords.push(normalizeAttendance(rec));
    }

    return NextResponse.json({
      success: true,
      message: `${updatedRecords.length} attendance record(s) approved successfully.`,
      count: updatedRecords.length,
      records: updatedRecords,
    });
  } catch (error) {
    console.error('Approve error:', error);
    return NextResponse.json({ error: error.message || 'Failed to approve attendance' }, { status: 500 });
  }
}
