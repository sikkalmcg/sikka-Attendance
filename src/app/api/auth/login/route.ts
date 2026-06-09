import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

const DEV_DUMMY_USERS = [
  // Using the creds shared by the user for local dev
  { username: 'ajaysomra', password: 'Mayank@2012', id: '1', role: 'SUPER_ADMIN', fullName: 'Ajay Somra', plantIds: [] },
  { username: 'mayank.hr', password: 'Mayank@2012', id: '2', role: 'HR', fullName: 'Mayank Sharma', plantIds: [] },
];

function jsonBadRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

function jsonUnauthorized(message = 'Invalid username or password') {
  return NextResponse.json({ message }, { status: 401 });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return jsonBadRequest('Missing body');

  const { username, password, deviceId, deviceName } = body as {
    username?: string;
    password?: string;
    deviceId?: string;
    deviceName?: string;
  };

  if (!username || !password) return jsonBadRequest('Missing username/password');

  // Spaces aur extra trim handle karne ke liye (jaise frontend par kiya hai)
  const cleanUser = username.trim().replace(/\s/g, '');
  const cleanPass = password.trim().replace(/\s/g, '');

  // 1) Dev fallback
  const devUser = DEV_DUMMY_USERS.find((u) => u.username === cleanUser && u.password === cleanPass);
  if (devUser) {
    return NextResponse.json({
      sessionId: `${devUser.id}-${Date.now()}`,
      id: devUser.id,
      username: devUser.username,
      fullName: devUser.fullName,
      role: devUser.role,
      plantIds: devUser.plantIds || [],
      deviceId: deviceId || null,
      deviceName: deviceName || null,
    });
  }

  // 2) Database Lookup
  try {
    const db = await getDb();
    
    // --- PART A: Admin/HR Check (`users` collection) ---
    const usersCol = db.collection('users');
    const userDoc = (await usersCol.findOne({ username: cleanUser })) as any;

    if (userDoc && userDoc.password === cleanPass) {
      return NextResponse.json({
        sessionId: `${userDoc._id || 'unknown'}-${Date.now()}`,
        id: String(userDoc._id || ''),
        username: cleanUser,
        fullName: userDoc.fullName || cleanUser,
        role: userDoc.role || 'ADMIN',
        plantIds: userDoc.plantIds || [],
        deviceId: deviceId || null,
        deviceName: deviceName || null,
      });
    }

    // --- PART B: Employee Fallback Check (`employees` collection) ---
    // Agar standard user nahi mila, toh check karein ki kya yeh Aadhaar aur Mobile se login kar raha hai
    const employeesCol = db.collection('employees');
    
    // Yeh query database mein dono formats (aadhaarNumber aur normal aadhaar) ko safe side check karegi
    const employeeDoc = (await employeesCol.findOne({
      $or: [
        { aadhaarNumber: cleanUser, mobileNumber: cleanPass },
        { aadhaar: cleanUser, mobile: cleanPass },
        { Aadhaar: cleanUser, Mobile: cleanPass },
        { employeeId: cleanUser } // Employee ID login support karne ke liye
      ]
    })) as any;

    if (employeeDoc) {
      const empFullName = employeeDoc.firstName 
        ? `${employeeDoc.firstName} ${employeeDoc.lastName || ''}`.trim() 
        : (employeeDoc.name || "Employee");

      return NextResponse.json({
        sessionId: `${employeeDoc._id || 'unknown'}-${Date.now()}`,
        id: String(employeeDoc._id || employeeDoc.id || ''),
        username: cleanUser,
        fullName: empFullName,
        role: 'EMPLOYEE',
        plantIds: employeeDoc.plantIds || [],
        employeeId: employeeDoc.employeeId || null,
        firmId: employeeDoc.firmId || null,
        deviceId: deviceId || null,
        deviceName: deviceName || null,
      });
    }

    // Agar dono jagah kuch nahi mila toh Unauthorized
    return jsonUnauthorized();

  } catch (error) {
    console.error("Database connection or query error during login:", error);
    // Server internals hide rakhne ke liye default error message
    return jsonUnauthorized('Invalid username or password');
  }
}