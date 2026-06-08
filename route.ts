import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { SUPER_ADMIN_USER } from '@/lib/constants';
import { DeviceHistoryEntry } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const { username, password, deviceId, deviceName } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ message: 'Username and password are required' }, { status: 400 });
    }

    if (!deviceId || !deviceName) {
      return NextResponse.json({ message: 'Device information is missing' }, { status: 400 });
    }

    const db = await getDb();
    const newSessionId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

    // 1. Check for Super Admin
    if (username === SUPER_ADMIN_USER.username && password === SUPER_ADMIN_USER.password) {
      const userData = { ...SUPER_ADMIN_USER, id: "super-1", sessionId: newSessionId };
      return NextResponse.json(userData, { status: 200 });
    }

    // 2. Check for Managed User
    const usersCol = db.collection('users');
    const user = await usersCol.findOne({ username: username.toLowerCase(), password: password });

    if (user) {
      if (user.status === 'Inactive') {
        return NextResponse.json({ message: "Access Denied: Your account has been deactivated by the administrator." }, { status: 403 });
      }
      
      const userData = { ...user, id: String(user._id), sessionId: newSessionId };
      await usersCol.updateOne({ _id: user._id }, { $set: { sessionId: newSessionId } });
      
      return NextResponse.json(userData, { status: 200 });
    }

    // 3. Check for Employee (Aadhaar/Mobile)
    if ((username.length === 12 || username.length === 10) && password.length >= 8) {
        const employeesCol = db.collection('employees');
        const cleanUsername = username.replace(/\s/g, '');

        const registeredEmp = await employeesCol.findOne({
            $or: [
                { aadhaar: cleanUsername },
                { mobile: cleanUsername }
            ]
        });

        if (registeredEmp) {
            if (registeredEmp.active === false) {
                return NextResponse.json({ message: "Access Denied: Your account has been deactivated by the administrator." }, { status: 403 });
            }

            const deviceTakenByOther = await employeesCol.findOne({
                deviceId: deviceId,
                aadhaar: { $ne: registeredEmp.aadhaar }
            });

            if (deviceTakenByOther) {
                return NextResponse.json({ message: "Device Security Violation: This device is already registered with another employee." }, { status: 403 });
            }

            if (registeredEmp.deviceId && registeredEmp.deviceId !== deviceId) {
                const switchMsg = `${registeredEmp.name} ${registeredEmp.department}/${registeredEmp.designation} login in Device ID ${deviceId} on ${new Date().toLocaleString('en-IN')}`;
                await db.collection('notifications').insertOne({
                    message: switchMsg,
                    timestamp: new Date().toISOString(),
                    read: false,
                    type: 'DEVICE_SWITCH',
                    employeeId: registeredEmp.employeeId
                });
            }

            let history: DeviceHistoryEntry[] = registeredEmp.deviceHistory || [];
            const nowIso = new Date().toISOString();

            const lastEntry = history[history.length - 1];
            if (!lastEntry || lastEntry.deviceId !== deviceId) {
              if(lastEntry) lastEntry.to = nowIso;
              history.push({
                id: "h-" + Date.now(),
                from: nowIso,
                to: "Present",
                deviceId: deviceId!,
                deviceName: deviceName
              });
            }

            await employeesCol.updateOne({ _id: registeredEmp._id }, {
                $set: { deviceId, deviceName, deviceHistory: history, sessionId: newSessionId }
            });

            const userData = {
                id: String(registeredEmp._id),
                username: cleanUsername,
                fullName: registeredEmp.name, 
                employeeId: registeredEmp.employeeId,
                role: "EMPLOYEE",
                permissions: ["Attendance"],
                sessionId: newSessionId,
                active: true
            };
            
            return NextResponse.json(userData, { status: 200 });
        }
    }

    return NextResponse.json({ message: 'Invalid credentials. Please check your username and password.' }, { status: 401 });

  } catch (err) {
    console.error("Login API error:", err);
    return NextResponse.json({ message: 'An error occurred during login. Please try again.' }, { status: 500 });
  }
}