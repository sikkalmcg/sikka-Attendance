import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Plant from '@/models/Plant';
import { authorizeEmployee } from '@/lib/rbac';
import { matchPlantForLocation } from '@/lib/geolocation';
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

    const rawPlants = await Plant.find({
      $or: [{ status: 'Active' }, { active: true }],
    });
    if (rawPlants.length === 0) {
      return NextResponse.json({
        matched: false,
        reason: 'NO_ACTIVE_PLANTS',
        message: 'No active plants are currently configured in the system.',
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
