import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Plant from '@/models/Plant';
import { authorizeEmployee } from '@/lib/rbac';
import { matchPlantForLocation } from '@/lib/geolocation';
import { normalizePlant } from '@/lib/normalize';

async function getReadableAddress(lat, lng) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
      headers: { 'User-Agent': 'SikkaAttendanceApp/1.0' },
      signal: timer.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        const parts = data.display_name.split(',').map((s) => s.trim()).filter(Boolean);
        return parts.slice(0, 4).join(', ');
      }
    }
  } catch {}
  return `Outside Plant (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

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

    // Check against all active configured plants in the system
    const rawPlants = await Plant.find({
      $or: [{ status: 'Active' }, { active: true }],
    }).lean();

    if (rawPlants.length === 0) {
      const readableLocation = await getReadableAddress(lat, lng);
      return NextResponse.json({
        matched: false,
        outside: true,
        reason: 'NO_ACTIVE_PLANTS',
        message: 'No active plants configured in the system.',
        readableLocation,
      });
    }

    const activePlants = rawPlants.map(normalizePlant);
    const matchResult = matchPlantForLocation(lat, lng, activePlants);

    if (matchResult.matched) {
      const pName = matchResult.plant.plantName || matchResult.plant.name;
      const pLoc = matchResult.plant.location;
      const readableLocation = pLoc
        ? (pLoc.toLowerCase().includes(pName.toLowerCase()) ? pLoc : `${pName}, ${pLoc}`)
        : pName;

      return NextResponse.json({
        matched: true,
        plant: {
          id: matchResult.plant.plantId,
          name: pName,
          location: pLoc,
          radiusMeters: matchResult.plant.radiusMeters,
        },
        readableLocation,
        distance: matchResult.distance,
        allowedRadius: matchResult.radiusMeters,
      });
    }

    const readableLocation = await getReadableAddress(lat, lng);

    return NextResponse.json({
      matched: false,
      outside: true,
      reason: 'OUTSIDE_RADIUS',
      nearestPlant: matchResult.nearestPlant ? matchResult.nearestPlant.plantName : 'Configured Plant',
      distance: matchResult.distance,
      allowedRadius: matchResult.radiusMeters,
      readableLocation,
      message: 'You are currently outside all configured plant locations.',
    });
  } catch (error) {
    console.error('Location check error:', error);
    return NextResponse.json({ error: 'Failed to evaluate location' }, { status: 500 });
  }
}
