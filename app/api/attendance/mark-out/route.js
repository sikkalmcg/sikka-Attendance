import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import Plant from '@/models/Plant';
import { authorizeEmployee } from '@/lib/rbac';
import { evaluatePlantLocation } from '@/lib/attendanceLocation';
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

    // Evaluate Mark OUT against all active configured plants in the system
    const rawPlants = await Plant.find({
      $or: [{ status: 'Active' }, { active: true }],
    }).lean();
    const activePlants = rawPlants.map(normalizePlant);

    const locationResult = evaluatePlantLocation(lat, lng, activePlants);
    let markOutPlantName = locationResult.plantName;
    let markOutPlantId = locationResult.plantId;

    if (!locationResult.withinPlantRadius) {
      // If OUT is outside all plants -> save Outside-Out
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
