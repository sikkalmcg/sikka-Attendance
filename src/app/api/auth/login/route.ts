import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ message: 'Missing request body' }, { status: 400 });
    }

    const { employeeId, role, latitude, longitude, plantId, address } = body;

    // ----------------------------------------------------------------------
    // RULE 1, 2 & 5: Restrict User Login (Admin/HR) from marking attendance
    // Validation Gateway is only applicable for Employees.
    // ----------------------------------------------------------------------
    if (role !== 'EMPLOYEE') {
      return NextResponse.json(
        { message: 'Access Denied: Only Employees can Mark IN/OUT. Admins and HR are restricted.' },
        { status: 403 }
      );
    }

    const db = await getDb();
    const employeesCol = db.collection('employees');

    // Find employee using either ObjectId or string ID
    let queryId;
    try {
      queryId = new ObjectId(employeeId);
    } catch {
      queryId = employeeId;
    }

    const employee = await employeesCol.findOne({ _id: queryId });

    if (!employee) {
      return NextResponse.json({ message: 'Employee record not found.' }, { status: 404 });
    }

    // ----------------------------------------------------------------------
    // RULE 5: Block if employee record is inactive, blocked, or deleted
    // ----------------------------------------------------------------------
    if (employee.isActive === false) {
      return NextResponse.json(
        { message: 'Access Denied: Employee account is currently inactive or blocked.' },
        { status: 403 }
      );
    }

    // ----------------------------------------------------------------------
    // RULE 3: Validation Gateway (GPS Check)
    // ----------------------------------------------------------------------
    if (!latitude || !longitude) {
      return NextResponse.json(
        { message: 'Validation Failed: GPS Location is required to Mark IN.' },
        { status: 400 }
      );
    }

    // (Optional: Implement Plant Radius Validation logic here using plantId and distance calculation)

    const attendanceCol = db.collection('attendance');
    const now = new Date();

    const newAttendance = {
      employeeId: employeeId,
      firmId: employee.firmId || null,
      plantId: plantId || employee.plantId || null,
      date: now.toISOString().split('T')[0],
      inTime: now.toISOString(),
      inLocationLatitude: parseFloat(latitude),
      inLocationLongitude: parseFloat(longitude),
      inLocationAddress: address || 'Address pending',
      isApproved: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    const result = await attendanceCol.insertOne(newAttendance);

    return NextResponse.json({
      message: 'Attendance Marked IN Successfully!',
      attendanceId: result.insertedId,
      data: newAttendance
    }, { status: 200 });

  } catch (error) {
    console.error('Mark IN Error:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}