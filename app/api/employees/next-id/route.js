import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { authorizeSystemUser } from '@/lib/rbac';
import { getNextEmployeeIdPreview } from '@/lib/employeeIds';

export async function GET(request) {
  const auth = await authorizeSystemUser(request, 'employee');
  if (!auth.authorized) return auth.response;

  try {
    await connectToDatabase();
    const employeeId = await getNextEmployeeIdPreview();
    return NextResponse.json({ success: true, employeeId });
  } catch (error) {
    console.error('Error previewing next Employee ID:', error);
    return NextResponse.json({ error: 'Could not load the next Employee ID.' }, { status: 500 });
  }
}
