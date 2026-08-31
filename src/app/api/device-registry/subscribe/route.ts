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
      platform = 'Android',
      manufacturer = '',
      model = '',
      osVersion = '',
      appVersion = '1.0.0',
      pushSubscription = null,
      subscription = null,
      fcmToken = '',
      token = '',
      notificationPermission = 'granted',
      locationPermission = 'granted',
      backgroundEnabled = true,
      deviceStatus = 'ACTIVE',
    } = body;

    const resolvedPushSub = pushSubscription || subscription || null;
    const resolvedFcm = String(fcmToken || token || resolvedPushSub?.endpoint || '').trim();
    const resolvedDeviceId = String(deviceId || resolvedFcm || '').trim() || `device_${Date.now()}`;
    let cleanEmpId = String(employeeId || '').trim();

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    // 1. Resolve employee canonical ID and details from MongoDB `employees` or `users`
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

    const calculatedDeviceName =
      deviceName ||
      (model ? `${manufacturer || ''} ${model}`.trim() : '') ||
      (platform === 'android' || platform === 'Android' ? 'Android Device' : 'Authorized Web Node');

    const deviceDoc: any = {
      employeeId: cleanEmpId,
      employeeName: resolvedName,
      role: String(resolvedRole).toUpperCase(),
      department: resolvedDept,
      designation: resolvedDesig,

      deviceId: resolvedDeviceId,
      fcmToken: resolvedFcm || resolvedDeviceId,
      token: resolvedFcm || resolvedDeviceId,
      deviceToken: resolvedFcm || resolvedDeviceId,

      platform: platform || 'Android',
      manufacturer: manufacturer || '',
      model: model || '',
      osVersion: osVersion || '',
      appVersion: appVersion || '1.0.0',
      deviceName: calculatedDeviceName,

      pushSubscription: resolvedPushSub,
      subscription: resolvedPushSub,

      notificationPermission: notificationPermission || 'granted',
      locationPermission: locationPermission || 'granted',
      backgroundEnabled: backgroundEnabled ?? true,

      deviceStatus: deviceStatus || 'ACTIVE',
      status: deviceStatus || 'ACTIVE',
      isActive: deviceStatus !== 'INACTIVE',
      active: deviceStatus !== 'INACTIVE',

      lastTokenUpdatedAt: nowIso,
      lastTokenUpdated: nowIso,
      lastActiveAt: nowIso,
      lastHeartbeatAt: nowIso,
      updatedAt: nowIso,
    };

    // 2. Query filter: Find if device already exists for this deviceId or fcmToken
    const orFilters: any[] = [{ deviceId: resolvedDeviceId }];
    if (resolvedFcm) {
      orFilters.push({ fcmToken: resolvedFcm }, { token: resolvedFcm }, { deviceToken: resolvedFcm });
    }
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
          deviceRegisteredAt: nowIso,
        },
      },
      { upsert: true }
    );

    // 4. Also keep `device_tokens` synchronized
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

    // 5. Broadcast real-time event
    realtimeBroadcaster.broadcast('device_registered', {
      collection: 'employee_devices',
      action: 'UPSERT',
      data: {
        employeeId: cleanEmpId,
        deviceId: resolvedDeviceId,
        deviceName: calculatedDeviceName,
        platform,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Device and FCM registration saved successfully in MongoDB',
      device: {
        employeeId: cleanEmpId,
        employeeName: resolvedName,
        role: resolvedRole,
        deviceId: resolvedDeviceId,
        fcmToken: resolvedFcm ? 'Registered' : 'Not Registered',
        notificationPermission,
        deviceStatus: 'ACTIVE',
        lastActiveAt: nowIso,
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
