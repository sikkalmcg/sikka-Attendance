import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.token) {
      return NextResponse.json({ error: 'Missing device token' }, { status: 400 });
    }

    const { token, employeeId, role, deviceName, platform, appVersion = '1.0.0' } = body;
    const cleanToken = String(token).trim();
    const cleanRole = String(role || 'EMPLOYEE').toUpperCase();
    let cleanEmpId = String(employeeId || '').trim();

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    // Resolve employee canonical ID if mobile/aadhaar was provided
    if (cleanEmpId) {
      const emp = await db.collection('employees').findOne({
        $or: [
          { employeeId: cleanEmpId },
          { id: cleanEmpId },
          { mobile: cleanEmpId },
          { mobileNumber: cleanEmpId },
          { aadhaar: cleanEmpId },
          { aadhaarNumber: cleanEmpId },
          { username: cleanEmpId },
        ],
      }).catch(() => null);

      if (emp?.employeeId) {
        cleanEmpId = emp.employeeId;
      }
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Update `employee_devices` collection (Section 3)
    await db.collection('employee_devices').updateOne(
      {
        $or: [
          { deviceToken: cleanToken },
          { token: cleanToken },
        ],
      },
      {
        $set: {
          employeeId: cleanEmpId,
          deviceToken: cleanToken,
          token: cleanToken,
          deviceType: platform || 'android',
          platform: platform || 'android',
          deviceName: deviceName || 'Android Device',
          appVersion,
          isActive: true,
          active: true,
          lastTokenUpdatedAt: nowIso,
          lastActiveAt: nowIso,
          updatedAt: nowIso,
        },
        $setOnInsert: {
          createdAt: nowIso,
        },
      },
      { upsert: true }
    );

    // 2. Update `device_tokens` collection (for multi-collection compatibility)
    await db.collection('device_tokens').updateOne(
      { token: cleanToken },
      {
        $set: {
          token: cleanToken,
          deviceToken: cleanToken,
          employeeId: cleanEmpId,
          role: cleanRole,
          deviceName: deviceName || 'Android Device',
          platform: platform || 'android',
          active: true,
          isActive: true,
          lastTokenUpdatedAt: nowIso,
          lastActiveAt: nowIso,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    );

    // 3. Create MongoDB Performance Indexes in background
    db.collection('notifications').createIndex({ employeeId: 1, isRead: 1, notificationDateTime: -1 }).catch(() => {});
    db.collection('notifications').createIndex({ employeeId: 1, read: 1 }).catch(() => {});
    db.collection('device_tokens').createIndex({ employeeId: 1, active: 1 }).catch(() => {});
    db.collection('employee_devices').createIndex({ employeeId: 1, isActive: 1 }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Employee device token registered successfully in MongoDB',
      employeeId: cleanEmpId,
      deviceToken: cleanToken,
      registeredAt: nowIso,
    });
  } catch (error: any) {
    console.error('Error registering device token:', error);
    return NextResponse.json({ error: error?.message || 'Failed to register device' }, { status: 500 });
  }
}
