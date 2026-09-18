import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Plant from '@/models/Plant';
import { authorizeSystemUser } from '@/lib/rbac';

export async function PUT(request, { params }) {
  const auth = await authorizeSystemUser(request, 'plant');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const data = await request.json();
    await connectToDatabase();

    // Build update object — never overwrite plantId (it's immutable after creation)
    const updateFields = {};
    if (data.plantName !== undefined) {
      updateFields.plantName = String(data.plantName).trim();
      updateFields.name = updateFields.plantName;
    }
    if (data.location !== undefined) updateFields.location = String(data.location).trim();
    if (data.latitude !== undefined) {
      updateFields.latitude = Number(data.latitude);
      updateFields.lat = updateFields.latitude;
    }
    if (data.longitude !== undefined) {
      updateFields.longitude = Number(data.longitude);
      updateFields.lng = updateFields.longitude;
    }
    if (data.radiusMeters !== undefined) {
      updateFields.radiusMeters = Number(data.radiusMeters);
      updateFields.radius = updateFields.radiusMeters;
    }
    if (data.status !== undefined) {
      updateFields.status = data.status;
      updateFields.active = data.status === 'Active';
    }

    // Use findOneAndUpdate to avoid Mongoose re-validation of required fields on save()
    const updatedPlant = await Plant.findOneAndUpdate(
      { $or: [{ _id: id }, { plantId: id }] },
      { $set: updateFields },
      { new: true, runValidators: false }
    );

    if (!updatedPlant) {
      return NextResponse.json({ error: 'Plant not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, plant: updatedPlant });
  } catch (error) {
    console.error('Error updating plant:', error);
    return NextResponse.json({ error: error.message || 'Failed to update plant' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await authorizeSystemUser(request, 'plant');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await connectToDatabase();

    const plant = await Plant.findOneAndDelete({
      $or: [{ _id: id }, { id: id }, { plantId: id }],
    });
    if (!plant) {
      return NextResponse.json({ error: 'Plant not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Plant deleted successfully' });
  } catch (error) {
    console.error('Error deleting plant:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete plant' }, { status: 500 });
  }
}
