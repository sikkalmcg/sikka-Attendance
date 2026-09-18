import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import Employee from '@/models/Employee';
import Plant from '@/models/Plant';
import { authorizeSystemUser } from '@/lib/rbac';
import { normalizeEmployee, normalizeAttendance, normalizePlant } from '@/lib/normalize';
import { formatInTimeZone } from 'date-fns-tz';
import { parseKolkataDateTime, isFutureKolkataDateTime } from '@/lib/timezone';

const IST = 'Asia/Kolkata';

export async function POST(request) {
  const auth = await authorizeSystemUser(request, 'approval');
  if (!auth.authorized) return auth.response;

  const { session } = auth;

  try {
    const {
      employeeId,
      attendanceId, // For Case 3 (adding Mark OUT to existing attendance)
      plantId,
      markInAt,
      markOutAt,
      remarks,
    } = await request.json();

    await connectToDatabase();

    // ── Case 3: Adding Mark OUT to existing attendance record ────────────────
    if (attendanceId) {
      let existingRecord = null;
      try {
        existingRecord = await Attendance.findById(attendanceId);
      } catch (e) {}

      if (!existingRecord) {
        existingRecord = await Attendance.findOne({ $or: [{ _id: attendanceId }, { id: attendanceId }] });
      }

      if (!existingRecord) {
        return NextResponse.json({ error: 'Existing attendance record not found.' }, { status: 404 });
      }

      if (!markOutAt) {
        return NextResponse.json({ error: 'Mark OUT Date/Time is required.' }, { status: 400 });
      }

      if (isFutureKolkataDateTime(markOutAt)) {
        return NextResponse.json(
          { error: 'Future date or time is not allowed. Please select the current or past date and time.' },
          { status: 400 }
        );
      }

      const outDate = parseKolkataDateTime(markOutAt);
      if (!outDate || isNaN(outDate.getTime())) {
        return NextResponse.json({ error: 'Invalid Mark OUT Date/Time format.' }, { status: 400 });
      }

      const inDate = existingRecord.markInAt ? new Date(existingRecord.markInAt) : null;

      if (inDate && outDate <= inDate) {
        return NextResponse.json({ error: 'Mark OUT must be strictly later than Mark IN.' }, { status: 400 });
      }

      const diffMs = inDate ? outDate.getTime() - inDate.getTime() : 0;
      const workingMinutes = diffMs > 0 ? Math.max(1, Math.round(diffMs / 60000)) : 0;

      // Use $set to only touch changed fields — never overwrite manualAttendanceBy
      const updated = await Attendance.findByIdAndUpdate(
        existingRecord._id,
        {
          $set: {
            markOutAt: outDate,
            workingMinutes,
            status: 'COMPLETED',
            editedBy: session.fullName || session.username,
            editedAt: new Date(),
            ...(remarks ? { remarks } : {}),
          },
        },
        { new: true, runValidators: false }
      );

      return NextResponse.json({
        success: true,
        message: 'Mark Out added to existing attendance session successfully.',
        attendance: normalizeAttendance(updated),
      });
    }

    // ── Case 1 & 2: Creating new Manual Mark IN (with optional Mark OUT) ─────
    if (!employeeId) {
      return NextResponse.json({ error: 'Please select an employee.' }, { status: 400 });
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

    // Lookup employee details
    const rawEmp = await Employee.findOne({
      $or: [
        { _id: employeeId },
        { id: employeeId },
        { employeeId: employeeId },
        { aadhaarNumber: employeeId },
        { aadhaar: employeeId },
      ],
    });

    if (!rawEmp) {
      return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
    }

    const emp = normalizeEmployee(rawEmp);

    // Block Manual Mark IN if employee already has an active session
    const existingActive = await Attendance.findOne({
      $and: [
        {
          $or: [
            { employeeId: emp.employeeId },
            { aadhaarNumber: emp.aadhaarNumber },
          ],
        },
        { $or: [{ status: 'ACTIVE' }, { status: 'Open' }, { status: 'OPEN' }] },
      ],
    });

    if (existingActive && !markOutAt) {
      return NextResponse.json(
        { error: `${emp.fullName} already has an active attendance session. Please close it first or add a Mark OUT time.` },
        { status: 409 }
      );
    }

    // Lookup plant details if provided
    let plantName = emp.plantName || 'Manufacturing Plant';
    let resolvedPlantId = plantId || emp.plantId || null;

    if (plantId) {
      const rawPlant = await Plant.findOne({
        $or: [{ _id: plantId }, { id: plantId }, { plantId: plantId }],
      });
      if (rawPlant) {
        const p = normalizePlant(rawPlant);
        plantName = p.plantName;
        resolvedPlantId = p.plantId;
      }
    }

    // Attendance date = IST date of Mark IN (not Mark OUT)
    const attendanceDate = formatInTimeZone(inDate, IST, 'yyyy-MM-dd');

    let outDate = null;
    let workingMinutes = 0;
    let status = 'ACTIVE';

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
      status = 'COMPLETED';
    }

    // Who performed the manual attendance
    const manualAttendanceBy = session.fullName || session.username || 'System';

    const newRecord = await Attendance.create({
      employeeId: emp.employeeId,
      employeeName: emp.fullName,
      designation: emp.designation,
      aadhaarNumber: emp.aadhaarNumber,
      mobileNumber: emp.mobileNumber,
      plantId: resolvedPlantId,
      plantName,
      markInPlantId: resolvedPlantId,
      markInPlantName: plantName,
      markInLocationType: 'PLANT',
      markInAt: inDate,
      markInLatitude: 0,
      markInLongitude: 0,
      markOutAt: outDate,
      markOutLatitude: outDate ? 0 : null,
      markOutLongitude: outDate ? 0 : null,
      markOutPlantName: outDate ? plantName : '',
      markOutType: 'Manual',
      workingMinutes,
      status,
      autoMarkOut: false,
      approvalStatus: 'PENDING',
      attendanceDate,
      manualAttendanceBy,
      editedBy: manualAttendanceBy,
      editedAt: new Date(),
      remarks: remarks || `Manually created by ${manualAttendanceBy}`,
    });

    return NextResponse.json({
      success: true,
      message: outDate
        ? 'Manual attendance (Mark IN & Mark OUT) recorded successfully.'
        : 'Manual attendance (Mark IN only) recorded successfully.',
      attendance: normalizeAttendance(newRecord),
    });
  } catch (error) {
    console.error('Manual attendance error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process manual attendance' }, { status: 500 });
  }
}
