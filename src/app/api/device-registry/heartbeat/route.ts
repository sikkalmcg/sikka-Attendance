import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { realtimeBroadcaster } from '@/lib/realtime-events';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      employeeId = '',
      deviceId = '',
      notificationPermission = '',
      locationPermission = '',
      batteryLevel = null,
      appVersion = '',
    } = body;

    const cleanEmpId = String(employeeId || '').trim();
    const cleanDeviceId = String(deviceId || '').trim();

    if (!cleanEmpId && !cleanDeviceId) {
      return NextResponse.json({ error: 'Missing employeeId or deviceId' }, { status: 400 });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    const nowIso = new Date().toISOString();

    const updateFields: any = {
      lastActiveAt: nowIso,
      lastHeartbeatAt: nowIso,
      updatedAt: nowIso,
      isActive: true,
      active: true,
      deviceStatus: 'ACTIVE',
      status: 'ACTIVE',
    };

    if (notificationPermission) {
      updateFields.notificationPermission = notificationPermission;
      if (notificationPermission === 'denied') {
        updateFields.deviceStatus = 'PERMISSION_DISABLED';
        updateFields.backgroundStatus = 'Restricted';
      }
    }

    if (locationPermission) {
      updateFields.locationPermission = locationPermission;
    }

    if (appVersion) {
      updateFields.appVersion = appVersion;
    }

    if (batteryLevel !== null) {
      updateFields.batteryLevel = batteryLevel;
    }

    const filter: any = {};
    if (cleanDeviceId) {
      filter.$or = [{ deviceId: cleanDeviceId }, { token: cleanDeviceId }, { employeeId: cleanEmpId }];
    } else {
      filter.employeeId = cleanEmpId;
    }

    const res = await db.collection('employee_devices').updateOne(filter, { $set: updateFields });

    // Also update device_tokens
    await db.collection('device_tokens').updateMany(filter, { $set: updateFields }).catch(() => {});

    if (res.matchedCount > 0) {
      realtimeBroadcaster.broadcast('device_registered', {
        collection: 'employee_devices',
        action: 'HEARTBEAT',
        data: { employeeId: cleanEmpId, deviceId: cleanDeviceId, status: updateFields.deviceStatus },
      });
    }

    return NextResponse.json({
      success: true,
      lastHeartbeatAt: nowIso,
      status: updateFields.deviceStatus,
    });
  } catch (error: any) {
    console.error('Error in POST /api/device-registry/heartbeat:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to process heartbeat' },
      { status: 500 }
    );
  }
}
