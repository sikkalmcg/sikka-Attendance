import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ message: 'Missing request body' }, { status: 400 });
    }

    const { username, password, role, latitude, longitude, plantId, address, employeeId } = body;

    const db = await getDb();

    // =============================
    // HR / ADMIN / SUPER_ADMIN LOGIN
    // =============================
    // The app-login page currently POSTs { username, password, deviceId, deviceName }
    // and expects a role-based session response.
    if (role && role !== 'EMPLOYEE') {
      const usersCol = db.collection('users');

      const cleanUser = String(username ?? '').trim().replace(/\s/g, '');
      const cleanPass = String(password ?? '').trim().replace(/\s/g, '');
      const cleanRole = String(role ?? '').trim().toUpperCase();

      if (!cleanUser || !cleanPass) {
        return NextResponse.json({ message: 'Missing username or password' }, { status: 400 });
      }

      const user = await usersCol.findOne({
        username: cleanUser,
        role: cleanRole,
        status: { $in: ['Active', 'active', true] },
        password: cleanPass,
      });

      if (!user) {
        return NextResponse.json({ message: 'Invalid Credentials.' }, { status: 401 });
      }

      const sessionData = {
        id: String((user as any)._id ?? user.id),
        username: cleanUser,
        role: cleanRole,
        fullName: (user as any).fullName || 'User',
        plantIds: (user as any).plantIds || [],
      };

      return NextResponse.json({ message: 'Login successful', ...sessionData }, { status: 200 });
    }

    // =============================
    // EMPLOYEE LOGIN / FALLBACK
    // =============================
    // If role is EMPLOYEE, we keep existing behavior untouched for attendance marking.

    // Existing attendance-mark endpoint logic expects:
    // { employeeId, role: 'EMPLOYEE', latitude, longitude, plantId, address }
    if (role !== 'EMPLOYEE') {
      return NextResponse.json(
        { message: 'Access Denied: Invalid role for this endpoint.' },
        { status: 403 }
      );
    }

    const employeesCol = db.collection('employees');

    // Find employee using either ObjectId or string ID
    let queryId: any;
    try {
      queryId = new ObjectId(employeeId);
    } catch {
      queryId = employeeId;
    }

    const employee = await employeesCol.findOne({ _id: queryId });

    if (!employee) {
      return NextResponse.json({ message: 'Employee record not found.' }, { status: 404 });
    }

    if (employee.isActive === false) {
      return NextResponse.json(
        { message: 'Access Denied: Employee account is currently inactive or blocked.' },
        { status: 403 }
      );
    }

    if (!latitude || !longitude) {
      return NextResponse.json(
        { message: 'Validation Failed: GPS Location is required to Mark IN.' },
        { status: 400 }
      );
    }

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
      updatedAt: now.toISOString(),
    };

    const result = await attendanceCol.insertOne(newAttendance);

    return NextResponse.json(
      {
        message: 'Attendance Marked IN Successfully!',
        attendanceId: result.insertedId,
        data: newAttendance,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Mark IN Error:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

