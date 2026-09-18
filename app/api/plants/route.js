import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Plant from '@/models/Plant';
import { authorizeSystemUser, getScopedPlantContext } from '@/lib/rbac';
import { normalizePlant } from '@/lib/normalize';

export async function GET(request) {
  const auth = await authorizeSystemUser(request, 'plant');
  if (!auth.authorized) return auth.response;

  try {
    await connectToDatabase();
    const plantScope = await getScopedPlantContext(auth.session);

    let query = {};
    if (!plantScope.isAllPlants) {
      query = {
        $or: [
          { _id: { $in: plantScope.plantIds } },
          { id: { $in: plantScope.plantIds } },
          { plantId: { $in: plantScope.plantIds } },
        ],
      };
    }

    const rawPlants = await Plant.find(query).sort({ createdAt: -1 });
    const plants = rawPlants.map(normalizePlant);
    return NextResponse.json({ success: true, plants });
  } catch (error) {
    console.error('Error fetching plants:', error);
    return NextResponse.json({ error: 'Failed to fetch plants' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await authorizeSystemUser(request, 'plant');
  if (!auth.authorized) return auth.response;

  try {
    const data = await request.json();
    const { plantId, plantName, location, latitude, longitude, radiusMeters, status } = data;

    if (!plantId || !plantName || !location || latitude === undefined || longitude === undefined || !radiusMeters) {
      return NextResponse.json(
        { error: 'All fields (Plant ID, Plant Name, Location, Latitude, Longitude, Radius) are required.' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const existing = await Plant.findOne({ plantId: String(plantId).trim().toUpperCase() });
    if (existing) {
      return NextResponse.json({ error: 'A plant with this Plant ID already exists.' }, { status: 400 });
    }

    const plant = await Plant.create({
      plantId: String(plantId).trim().toUpperCase(),
      plantName: String(plantName).trim(),
      location: String(location).trim(),
      latitude: Number(latitude),
      longitude: Number(longitude),
      radiusMeters: Number(radiusMeters),
      status: status || 'Active',
    });

    return NextResponse.json({ success: true, plant }, { status: 201 });
  } catch (error) {
    console.error('Error creating plant:', error);
    return NextResponse.json({ error: error.message || 'Failed to create plant' }, { status: 500 });
  }
}
