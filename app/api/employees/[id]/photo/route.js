import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import Employee from '@/models/Employee';
import {
  authorizeSystemUser,
  getScopedPlantContext,
  hasEmployeePlantAccess,
} from '@/lib/rbac';
import { parseEmployeePhoto } from '@/lib/employeePhoto';

async function findEmployee(id) {
  const decodedId = decodeURIComponent(String(id || '').trim());
  const conditions = [
    { _id: decodedId },
    { id: decodedId },
    { employeeId: decodedId },
  ];
  if (mongoose.Types.ObjectId.isValid(decodedId)) {
    conditions.unshift({ _id: new mongoose.Types.ObjectId(decodedId) });
  }
  return Employee.findOne({
    $or: conditions,
  });
}

export async function GET(request, { params }) {
  let auth = await authorizeSystemUser(request, 'employee');
  if (!auth.authorized) auth = await authorizeSystemUser(request, 'approval');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await connectToDatabase();
    const employee = await findEmployee(id);
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const plantScope = await getScopedPlantContext(auth.session);
    if (!plantScope.isAllPlants && !hasEmployeePlantAccess(plantScope, employee)) {
      return NextResponse.json({ error: 'Access denied to this employee photo.' }, { status: 403 });
    }
    const storedPhoto = [
      employee.photoData,
      employee.avatar,
      employee.photo,
      employee.image,
      employee.profileImage,
    ].find((candidate) => typeof candidate === 'string' && candidate.startsWith('data:image/'));
    if (!storedPhoto) return NextResponse.json({ error: 'Employee photo not found' }, { status: 404 });

    const photo = parseEmployeePhoto(storedPhoto);
    const bytes = Buffer.from(photo.dataUrl.split(',')[1], 'base64');
    return new Response(bytes, {
      headers: {
        'Content-Type': photo.mimeType,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Error fetching employee photo:', error);
    return NextResponse.json({ error: 'Failed to fetch employee photo' }, { status: 500 });
  }
}
