import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import Plant from '@/models/Plant';
import { authorizeEmployee } from '@/lib/rbac';
import { matchPlantForLocation } from '@/lib/geolocation';
import { processAutoMarkOut } from '@/lib/autoMarkOut';
import { normalizePlant, normalizeAttendance } from '@/lib/normalize';
import { getTodayDateString, getAttendanceDateString } from '@/lib/timezone';
import { formatInTimeZone } from 'date-fns-tz';

export async function POST(request) {
  const auth = await authorizeEmployee(request);
  if (!auth.authorized) return auth.response;

  const { session } = auth;

  try {
    const { latitude, longitude, accuracy, locationType } = await request.json();

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'Device coordinates are required to mark in.' }, { status: 400 });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    await connectToDatabase();

    // First, process any old sessions (>18 hours) to ensure clean state
    await processAutoMarkOut();

    // Transaction safety & duplicate protection: Check if employee already has an active session
    const existingActive = await Attendance.findOne({
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
    });

    if (existingActive) {
      return NextResponse.json(
        { error: 'You already have an active attendance session.' },
        { status: 409 }
      );
    }

    // Geolocation server-side evaluation
    const rawPlants = await Plant.find({
      $or: [{ status: 'Active' }, { active: true }],
    });
    const activePlants = rawPlants.map(normalizePlant);
    const matchResult = matchPlantForLocation(lat, lng, activePlants);

    let markInLocationType = 'PLANT';
    let plantId = null;
    let plantName = 'Outside Plant';
    let markInPlantName = 'Outside Plant';

    if (matchResult.matched) {
      markInLocationType = 'PLANT';
      plantId = matchResult.plant.plantId;
      plantName = matchResult.plant.plantName;
      markInPlantName = matchResult.plant.plantName;
    } else {
      // Outside plant: employee must provide valid locationType
      if (!locationType || !['WORK_FROM_HOME', 'FIELD_WORK'].includes(locationType)) {
        return NextResponse.json(
          {
            error: 'You are outside all authorized plant locations. Please select Work From Home or Field Work.',
            outside: true,
            distance: matchResult.distance,
            nearestPlant: matchResult.nearestPlant ? matchResult.nearestPlant.plantName : 'Authorized Plant',
            allowedRadius: matchResult.radiusMeters,
          },
          { status: 400 }
        );
      }

      markInLocationType = locationType;
      plantId = null;
      plantName = 'Outside Plant';
      markInPlantName = 'Outside Plant';
    }

    // Server-authoritative timestamp
    const markInAt = new Date();

    const attendance = await Attendance.create({
      employeeId: session.employeeId,
      employeeName: session.fullName,
      designation: session.designation || 'Staff',
      aadhaarNumber: session.aadhaarNumber,
      mobileNumber: session.mobileNumber || '',
      plantId,
      plantName,
      markInPlantId: plantId,
      markInPlantName,
      markInLocationType,
      markInAt,
      markInLatitude: lat,
      markInLongitude: lng,
      markInAccuracy: accuracy ? Number(accuracy) : null,
      attendanceDate: formatInTimeZone(markInAt, 'Asia/Kolkata', 'yyyy-MM-dd'),
      status: 'ACTIVE',
      autoMarkOut: false,
      approvalStatus: 'PENDING',
      manualAttendanceBy: null,
    });

    return NextResponse.json({
      success: true,
      message: 'Attendance Marked Successfully',
      attendance: normalizeAttendance(attendance),
    });
  } catch (error) {
    console.error('Mark In error:', error);
    return NextResponse.json({ error: error.message || 'Failed to record Mark In' }, { status: 500 });
  }
}
