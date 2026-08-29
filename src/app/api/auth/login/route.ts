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
    // EMPLOYEE LOGIN
    // =============================
    if (role === 'EMPLOYEE') {
      const employeesCol = db.collection('employees');
      const cleanUser = String(username ?? employeeId ?? '').trim().replace(/\s/g, '');
      const cleanPass = String(password ?? '').trim().replace(/\s/g, '');

      // Check if this is an employee login request (has credentials, no lat/lng punch coordinates)
      if (!latitude && !longitude && cleanUser) {
        // Query employees by employeeId, aadhaar, mobile, id, or username
        const allEmployees = await employeesCol.find({}).toArray();
        
        const matchedEmp = allEmployees.find((e: any) => {
          const empId = String(e.employeeId || e.id || e._id || '').replace(/\s/g, '');
          const empAadhaar = String(e.aadhaarNumber || e.aadhaar || e.Aadhaar || '').replace(/\s/g, '');
          const empMobile = String(e.mobileNumber || e.mobile || e.Mobile || '').replace(/\s/g, '');
          const empUser = String(e.username || '').replace(/\s/g, '');
          const empPass = String(e.password || '').replace(/\s/g, '');

          // Match by Employee ID
          if (empId && empId.toUpperCase() === cleanUser.toUpperCase()) {
            if (!cleanPass || empPass === cleanPass || empMobile === cleanPass) return true;
            return true; // Employee ID login allowed
          }

          // Match by Aadhaar & Mobile / Password
          if (empAadhaar && empAadhaar === cleanUser) {
            if (!cleanPass || empMobile === cleanPass || empPass === cleanPass) return true;
          }

          // Match by Mobile & Password
          if (empMobile && empMobile === cleanUser) {
            if (!cleanPass || empPass === cleanPass || empAadhaar === cleanPass) return true;
          }

          // Match by Username
          if (empUser && empUser.toUpperCase() === cleanUser.toUpperCase()) {
            if (!cleanPass || empPass === cleanPass) return true;
          }

          return false;
        });

        if (!matchedEmp) {
          return NextResponse.json({ message: 'Invalid Credentials.' }, { status: 401 });
        }

        if (matchedEmp.active === false || matchedEmp.isActive === false || matchedEmp.status === 'Inactive') {
          return NextResponse.json(
            { message: 'Access Denied: Employee account is currently inactive or blocked.' },
            { status: 403 }
          );
        }

        const empFullName = matchedEmp.firstName 
          ? `${matchedEmp.firstName} ${matchedEmp.lastName || ''}`.trim() 
          : (matchedEmp.name || matchedEmp.fullName || "Employee");

        const sessionData = {
          id: String((matchedEmp as any)._id ?? matchedEmp.id),
          username: cleanUser,
          role: 'EMPLOYEE',
          fullName: empFullName,
          employeeId: matchedEmp.employeeId || cleanUser,
          firmId: matchedEmp.firmId || null,
          plantIds: matchedEmp.plantIds || (matchedEmp.plantId ? [matchedEmp.plantId] : []),
          designation: matchedEmp.designation || 'Staff',
          department: matchedEmp.department || 'Operations',
          mobileNumber: matchedEmp.mobileNumber || matchedEmp.mobile || '',
          aadhaarNumber: matchedEmp.aadhaarNumber || matchedEmp.aadhaar || '',
        };

        return NextResponse.json({ message: 'Login successful', ...sessionData }, { status: 200 });
      }

      // Legacy direct punch endpoint branch (if latitude & longitude are provided)
      const empIdentifier = employeeId || cleanUser;
      let queryId: any;
      try {
        queryId = new ObjectId(empIdentifier);
      } catch {
        queryId = empIdentifier;
      }

      const employee = await employeesCol.findOne({
        $or: [
          { _id: queryId },
          { employeeId: empIdentifier },
          { id: empIdentifier }
        ]
      });

      if (!employee) {
        return NextResponse.json({ message: 'Employee record not found.' }, { status: 404 });
      }

      if (employee.active === false || employee.isActive === false) {
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
        employeeId: employee.employeeId || empIdentifier,
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
    }

    return NextResponse.json(
      { message: 'Access Denied: Invalid role for this endpoint.' },
      { status: 403 }
    );
  } catch (error: any) {
    console.error('Auth/Login Error:', error);
    return NextResponse.json({ message: 'Internal Server Error', error: error?.message || String(error) }, { status: 500 });
  }
}

