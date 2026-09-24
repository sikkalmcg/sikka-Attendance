import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import Plant from '@/models/Plant';
import Employee from '@/models/Employee';
import { authorizeEmployee } from '@/lib/rbac';
import {
  evaluateAssignedPlantLocation,
  getAssignedPlantQuery,
  getAssignedPlantReferences,
} from '@/lib/attendanceLocation';
import { processAutoMarkOut } from '@/lib/autoMarkOut';
import { normalizePlant, normalizeAttendance } from '@/lib/normalize';
import { calculateWorkingMinutes, getRecordMarkInDateTime } from '@/lib/timezone';

export async function POST(request) {
  const auth = await authorizeEmployee(request);
  if (!auth.authorized) return auth.response;

  const { session } = auth;

  try {
    const { latitude, longitude, accuracy } = await request.json();

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'Device coordinates are required to mark out.' }, { status: 400 });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    await connectToDatabase();

    // First process any auto mark out
    await processAutoMarkOut();

    // Verify employee has an active session
    const activeSession = await Attendance.findOne({
      $and: [
        {
          $or: [
            { employeeId: session.employeeId },
            { employeeId: session.sub },
            { aadhaarNumber: session.aadhaarNumber },
          ],
        },
        {
          $or: [{ status: 'ACTIVE' }, { status: 'Open' }, { status: 'OPEN' }],
        },
      ],
    }).sort({ markInAt: -1, inDateTime: -1, createdAt: -1 });

    if (!activeSession) {
      return NextResponse.json(
        { error: 'No active attendance session found.' },
        { status: 400 }
      );
    }

    // Evaluate this Mark OUT only against the employee's assigned plant configuration.
    const employee = await Employee.findOne({
      $or: [
        { employeeId: session.employeeId },
        { _id: session.sub },
        ...(session.aadhaarNumber ? [{ aadhaarNumber: session.aadhaarNumber }, { aadhaar: session.aadhaarNumber }] : []),
      ],
    }).select('plantId plantName unitIds').lean();
    const assignedPlantReferences = getAssignedPlantReferences(employee, session);
    if (assignedPlantReferences.length === 0) {
      return NextResponse.json({ error: 'No plant is assigned to this employee.' }, { status: 400 });
    }

    const rawPlants = await Plant.find({
      $and: [
        { $or: [{ status: 'Active' }, { active: true }] },
        getAssignedPlantQuery(assignedPlantReferences),
      ],
    }).lean();
    const assignedPlants = rawPlants.map(normalizePlant);
    if (assignedPlants.length === 0) {
      return NextResponse.json({ error: 'No active assigned plant is configured for this employee.' }, { status: 400 });
    }

    const locationResult = evaluateAssignedPlantLocation(lat, lng, assignedPlants);
    let markOutPlantName = locationResult.plantName;
    let markOutPlantId = locationResult.plantId;
    if (!locationResult.withinPlantRadius) {
      markOutPlantName = 'Outside-Out';
      markOutPlantId = null;
    }

    // Authoritative server timestamp
    const markOutAt = new Date();
    const markInDate = getRecordMarkInDateTime(activeSession) || (activeSession.markInAt ? new Date(activeSession.markInAt) : markOutAt);
    const workingMinutes = calculateWorkingMinutes(markInDate, markOutAt);

    // Use findByIdAndUpdate to avoid Mongoose re-validation and to safely preserve
    // manualAttendanceBy and other existing fields untouched
    const updated = await Attendance.findByIdAndUpdate(
      activeSession._id,
      {
        $set: {
          markInAt: activeSession.markInAt || markInDate,
          markOutAt,
          markOutLatitude: lat,
          markOutLongitude: lng,
          markOutAccuracy: accuracy ? Number(accuracy) : null,
          markOutWithinPlantRadius: locationResult.withinPlantRadius,
          markOutDistanceMeters: locationResult.distanceMeters,
          markOutAllowedRadiusMeters: locationResult.allowedRadiusMeters,
          markOutPlantId,
          markOutPlantName,
          markOutType: 'Self',
          markOutByUserId: null,
          markOutByUserName: null,
          workingMinutes,
          status: 'COMPLETED',
        },
      },
      { new: true, runValidators: false }
    );

    return NextResponse.json({
      success: true,
      message: 'Mark Out Successful',
      attendance: normalizeAttendance(updated),
    });
  } catch (error) {
    console.error('Mark Out error:', error);
    return NextResponse.json({ error: error.message || 'Failed to record Mark Out' }, { status: 500 });
  }
}
