import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import Plant from '@/models/Plant';
import { authorizeEmployee } from '@/lib/rbac';
import { matchPlantForLocation } from '@/lib/geolocation';
import { processAutoMarkOut } from '@/lib/autoMarkOut';
import { normalizePlant, normalizeAttendance } from '@/lib/normalize';

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

    // Geolocation server-side evaluation
    const rawPlants = await Plant.find({
      $or: [{ status: 'Active' }, { active: true }],
    });
    const activePlants = rawPlants.map(normalizePlant);
    const matchResult = matchPlantForLocation(lat, lng, activePlants);

    let markOutPlantName = 'Outside from Plant';
    let markOutPlantId = null;

    if (matchResult.matched) {
      markOutPlantName = matchResult.plant.plantName;
      markOutPlantId = matchResult.plant.plantId;
    }

    // Authoritative server timestamp
    const markOutAt = new Date();
    const markInTime = activeSession.markInAt ? new Date(activeSession.markInAt).getTime() : markOutAt.getTime();
    const diffMs = markOutAt.getTime() - markInTime;
    const workingMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));

    // Use findByIdAndUpdate to avoid Mongoose re-validation and to safely preserve
    // manualAttendanceBy and other existing fields untouched
    const updated = await Attendance.findByIdAndUpdate(
      activeSession._id,
      {
        $set: {
          markOutAt,
          markOutLatitude: lat,
          markOutLongitude: lng,
          markOutAccuracy: accuracy ? Number(accuracy) : null,
          markOutPlantId,
          markOutPlantName,
          markOutType: 'Self',
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
