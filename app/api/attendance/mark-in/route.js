import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import Plant from '@/models/Plant';
import Employee from '@/models/Employee';
import { authorizeEmployee } from '@/lib/rbac';
import {
  OUTSIDE_PLANT_LABEL,
  evaluateAssignedPlantLocation,
  getAssignedPlantQuery,
  getAssignedPlantReferences,
} from '@/lib/attendanceLocation';
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

    // Strict check: Allow Mark In only once per calendar date (IST)
    const todayIST = formatInTimeZone(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
    const existingToday = await Attendance.findOne({
      $and: [
        {
          $or: [
            { employeeId: session.employeeId },
            { employeeId: session.sub },
            ...(session.aadhaarNumber ? [{ aadhaarNumber: session.aadhaarNumber }] : []),
          ],
        },
        {
          $or: [
            { attendanceDate: todayIST },
            { inDate: todayIST },
            { date: todayIST },
          ],
        },
      ],
    });

    if (existingToday) {
      return NextResponse.json(
        { error: 'Mark In already completed for this date.' },
        { status: 409 }
      );
    }

    // Transaction safety & duplicate protection: Check if employee already has an active session
    const existingActive = await Attendance.findOne({
      $and: [
        {
          $or: [
            { employeeId: session.employeeId },
            { employeeId: session.sub },
            ...(session.aadhaarNumber ? [{ aadhaarNumber: session.aadhaarNumber }] : []),
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

    // Evaluate this Mark IN only against the employee's assigned plant configuration.
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
    let markInLocationType = 'PLANT';
    let plantId = locationResult.plantId;
    let plantName = locationResult.plantName;
    let markInPlantName = locationResult.plantName;

    if (!locationResult.withinPlantRadius) {
      // Outside the assigned plant: employee must provide a valid work type.
      if (!locationType || !['WORK_FROM_HOME', 'FIELD_WORK'].includes(locationType)) {
        return NextResponse.json(
          {
            error: 'You are outside your assigned plant location. Please select Work From Home or Field Work.',
            outside: true,
            distance: locationResult.distanceMeters,
            nearestPlant: assignedPlants[0]?.plantName || 'Assigned Plant',
            allowedRadius: locationResult.allowedRadiusMeters,
          },
          { status: 400 }
        );
      }

      markInLocationType = locationType;
      plantId = null;
      markInPlantName = locationType === 'WORK_FROM_HOME' ? 'Outside Plant - WFM' : 'Outside Plant - Field Work';
      plantName = markInPlantName;
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
      markInWithinPlantRadius: locationResult.withinPlantRadius,
      markInDistanceMeters: locationResult.distanceMeters,
      markInAllowedRadiusMeters: locationResult.allowedRadiusMeters,
      markOutPlantName: 'Under Process',
      markOutType: null,
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
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Mark In already completed for this date.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message || 'Failed to record Mark In' }, { status: 500 });
  }
}
