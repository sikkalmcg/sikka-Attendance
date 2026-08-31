import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { realtimeBroadcaster } from '@/lib/realtime-events';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Missing request body' }, { status: 400 });
    }

    const {
      employeeId = '',
      employeeName = '',
      role = '',
      department = '',
      designation = '',
      deviceId = '',
      deviceName = '',
      platform = '',
      pushSubscription = null,
      subscription = null,
      notificationPermission = 'granted',
      deviceStatus = 'ACTIVE',
      token = '',
    } = body;

    const resolvedPushSub = pushSubscription || subscription || null;
    const resolvedDeviceId = String(deviceId || token || '').trim() || `device_${Date.now()}`;
    let cleanEmpId = String(employeeId || '').trim();

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    // 1. Enrich missing employee metadata from MongoDB `employees` or `users` collection
    let resolvedName = employeeName;
    let resolvedRole = role;
    let resolvedDept = department;
    let resolvedDesig = designation;

    if (cleanEmpId) {
      const [emp, user] = await Promise.all([
        db.collection('employees').findOne({
          $or: [
            { employeeId: cleanEmpId },
            { id: cleanEmpId },
            { mobile: cleanEmpId },
            { mobileNumber: cleanEmpId },
            { aadhaar: cleanEmpId },
            { aadhaarNumber: cleanEmpId },
            { username: cleanEmpId },
          ],
        }).catch(() => null),
        db.collection('users').findOne({
          $or: [
            { username: cleanEmpId },
            { id: cleanEmpId },
            { employeeId: cleanEmpId },
          ],
        }).catch(() => null),
      ]);

      if (emp) {
        cleanEmpId = emp.employeeId || cleanEmpId;
        if (!resolvedName) {
          resolvedName = emp.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : (emp.name || '');
        }
        if (!resolvedDept) resolvedDept = emp.department || '';
        if (!resolvedDesig) resolvedDesig = emp.designation || '';
        if (!resolvedRole) resolvedRole = emp.role || (emp as any).userRole || 'EMPLOYEE';
      }

      if (user) {
        if (!resolvedRole) resolvedRole = user.role || 'EMPLOYEE';
        if (!resolvedName && user.fullName) resolvedName = user.fullName;
      }
    }

    if (!resolvedRole) resolvedRole = 'EMPLOYEE';
    if (!resolvedName) resolvedName = cleanEmpId || 'Employee';

    const now = new Date();
    const nowIso = now.toISOString();

    const deviceDoc: any = {
      employeeId: cleanEmpId,
      employeeName: resolvedName,
      role: String(resolvedRole).toUpperCase(),
      department: resolvedDept,
      designation: resolvedDesig,
      deviceId: resolvedDeviceId,
      deviceName: deviceName || 'Web Browser',
      platform: platform || 'web',
      pushSubscription: resolvedPushSub,
      subscription: resolvedPushSub, // legacy alias compatibility
      token: resolvedDeviceId, // token alias
      deviceToken: resolvedDeviceId,
      notificationPermission: notificationPermission || 'granted',
      deviceStatus: deviceStatus || 'ACTIVE',
      isActive: deviceStatus !== 'INACTIVE',
      active: deviceStatus !== 'INACTIVE',
      lastTokenUpdated: nowIso,
      lastTokenUpdatedAt: nowIso,
      lastActiveAt: nowIso,
      updatedAt: nowIso,
    };

    // 2. Query filter: Find if device already exists for this deviceId OR this subscription endpoint
    const orFilters: any[] = [{ deviceId: resolvedDeviceId }, { token: resolvedDeviceId }];
    if (resolvedPushSub && resolvedPushSub.endpoint) {
      orFilters.push({ 'pushSubscription.endpoint': resolvedPushSub.endpoint });
      orFilters.push({ 'subscription.endpoint': resolvedPushSub.endpoint });
    }

    // 3. Upsert into `employee_devices`
    await db.collection('employee_devices').updateOne(
      { $or: orFilters },
      {
        $set: deviceDoc,
        $setOnInsert: {
          createdAt: nowIso,
        },
      },
      { upsert: true }
    );

    // 4. Also keep `device_tokens` synchronized for multi-table compatibility
    await db.collection('device_tokens').updateOne(
      { $or: orFilters },
      {
        $set: deviceDoc,
        $setOnInsert: {
          createdAt: nowIso,
        },
      },
      { upsert: true }
    );

    // Broadcast device registration event
    realtimeBroadcaster.broadcast('device_registered', {
      collection: 'employee_devices',
      action: 'UPSERT',
      data: { employeeId: cleanEmpId, deviceId: resolvedDeviceId, deviceName },
    });

    return NextResponse.json({
      success: true,
      message: 'Device and Web-Push subscription registered successfully in MongoDB',
      device: {
        employeeId: cleanEmpId,
        employeeName: resolvedName,
        role: resolvedRole,
        deviceId: resolvedDeviceId,
        hasPushSubscription: Boolean(resolvedPushSub?.endpoint),
        notificationPermission,
        lastTokenUpdated: nowIso,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/device-registry/subscribe:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to register device' },
      { status: 500 }
    );
  }
}
