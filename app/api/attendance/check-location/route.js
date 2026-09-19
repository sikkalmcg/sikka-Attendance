import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Plant from '@/models/Plant';
import Employee from '@/models/Employee';
import { authorizeEmployee } from '@/lib/rbac';
import { matchPlantForLocation } from '@/lib/geolocation';
import { getAssignedPlantQuery, getAssignedPlantReferences } from '@/lib/attendanceLocation';
import { normalizePlant } from '@/lib/normalize';

export async function POST(request) {
  const auth = await authorizeEmployee(request);
  if (!auth.authorized) return auth.response;

  try {
    const { latitude, longitude } = await request.json();

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'Latitude and Longitude are required.' }, { status: 400 });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: 'Invalid coordinate values.' }, { status: 400 });
    }

    await connectToDatabase();

    const { session } = auth;
    const employee = await Employee.findOne({
      $or: [
        { employeeId: session.employeeId },
        { _id: session.sub },
        ...(session.aadhaarNumber ? [{ aadhaarNumber: session.aadhaarNumber }, { aadhaar: session.aadhaarNumber }] : []),
      ],
    }).select('plantId plantName unitIds').lean();
    const assignedPlantReferences = getAssignedPlantReferences(employee, session);
    const rawPlants = assignedPlantReferences.length === 0 ? [] : await Plant.find({
      $and: [
        { $or: [{ status: 'Active' }, { active: true }] },
        getAssignedPlantQuery(assignedPlantReferences),
      ],
    });
    if (rawPlants.length === 0) {
      return NextResponse.json({
        matched: false,
        reason: 'NO_ASSIGNED_ACTIVE_PLANT',
        message: 'No active plant is assigned to this employee.',
      });
    }

    const activePlants = rawPlants.map(normalizePlant);
    const matchResult = matchPlantForLocation(lat, lng, activePlants);

    if (matchResult.matched) {
      return NextResponse.json({
        matched: true,
        plant: {
          id: matchResult.plant.plantId,
          name: matchResult.plant.plantName,
          location: matchResult.plant.location,
          radiusMeters: matchResult.plant.radiusMeters,
        },
        distance: matchResult.distance,
        allowedRadius: matchResult.radiusMeters,
      });
    }

    return NextResponse.json({
      matched: false,
      outside: true,
      reason: 'OUTSIDE_RADIUS',
      nearestPlant: matchResult.nearestPlant ? matchResult.nearestPlant.plantName : 'Authorized Plant',
      distance: matchResult.distance,
      allowedRadius: matchResult.radiusMeters,
      message: 'You are currently outside all authorized plant locations.',
    });
  } catch (error) {
    console.error('Location check error:', error);
    return NextResponse.json({ error: 'Failed to evaluate location' }, { status: 500 });
  }
}
