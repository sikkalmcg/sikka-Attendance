import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { realtimeBroadcaster } from '@/lib/realtime-events';

export const dynamic = 'force-dynamic';

async function reverseGeocodeCoords(lat: number, lng: number): Promise<string> {
  const apiKey = process.env.ARCGIS_API_KEY;
  if (apiKey) {
    try {
      const url = new URL('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode');
      url.searchParams.set('location', `${lng},${lat}`);
      url.searchParams.set('distance', '0.5');
      url.searchParams.set('maxLocations', '1');
      url.searchParams.set('f', 'json');
      url.searchParams.set('token', apiKey);

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        const addr = data?.address
          ? (typeof data.address === 'object'
              ? data.address.Match_addr || data.address.LongLabel || data.address.Address || ''
              : data.address)
          : '';
        if (addr && !addr.includes('Unknown')) {
          return addr;
        }
      }
    } catch (e) {}
  }

  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(osmUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'SikkaAttendanceApp/1.0 (admin@sikkaenterprises.com)',
        'Accept-Language': 'en',
      },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.display_name) {
        return data.display_name;
      }
    }
  } catch (e) {}

  return '';
}

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
      gpsLatitude = null,
      gpsLongitude = null,
      completeAddress = '',
      address = '',
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

    if (typeof gpsLatitude === 'number' && typeof gpsLongitude === 'number') {
      updateFields.gpsLatitude = gpsLatitude;
      updateFields.gpsLongitude = gpsLongitude;
      let finalAddr = completeAddress || address;
      if (!finalAddr || finalAddr.includes('Plant Zone') || finalAddr === 'Location unavailable') {
        finalAddr = await reverseGeocodeCoords(gpsLatitude, gpsLongitude);
      }
      if (finalAddr) {
        updateFields.completeAddress = finalAddr;
        updateFields.locationAddress = finalAddr;
      }
    }

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

    let empName = cleanEmpId;
    if (cleanEmpId) {
      const empDoc = await db.collection('employees').findOne({
        $or: [
          { employeeId: { $regex: new RegExp(`^${cleanEmpId}$`, 'i') } },
          { id: { $regex: new RegExp(`^${cleanEmpId}$`, 'i') } },
          { username: { $regex: new RegExp(`^${cleanEmpId}$`, 'i') } },
          { mobile: cleanEmpId },
          { mobileNumber: cleanEmpId },
        ]
      }).catch(() => null);
      if (empDoc) {
        empName = empDoc.name || empDoc.fullName || `${empDoc.firstName || ''} ${empDoc.lastName || ''}`.trim() || cleanEmpId;
        updateFields.employeeName = empName;
        updateFields.employeeId = empDoc.employeeId || cleanEmpId;
      } else {
        updateFields.employeeId = cleanEmpId;
      }
    }

    const orClauses: any[] = [];
    if (cleanDeviceId) {
      orClauses.push({ deviceId: cleanDeviceId }, { token: cleanDeviceId });
    }
    if (cleanEmpId) {
      orClauses.push({ employeeId: cleanEmpId });
    }

    if (orClauses.length > 0) {
      const existingDev = await db.collection('employee_devices').findOne({ $or: orClauses }).catch(() => null);
      if (existingDev) {
        await db.collection('employee_devices').updateOne(
          { _id: existingDev._id },
          { $set: updateFields }
        );
      } else {
        await db.collection('employee_devices').insertOne({
          ...updateFields,
          createdAt: nowIso,
          employeeId: cleanEmpId,
          employeeName: empName,
          deviceId: cleanDeviceId || `device_${Date.now()}`,
        });
      }

      // Also keep device_tokens updated
      const existingToken = await db.collection('device_tokens').findOne({ $or: orClauses }).catch(() => null);
      if (existingToken) {
        await db.collection('device_tokens').updateOne(
          { _id: existingToken._id },
          { $set: updateFields }
        ).catch(() => {});
      } else if (cleanDeviceId || cleanEmpId) {
        await db.collection('device_tokens').insertOne({
          ...updateFields,
          createdAt: nowIso,
          employeeId: cleanEmpId,
          employeeName: empName,
          deviceId: cleanDeviceId || `device_${Date.now()}`,
        }).catch(() => {});
      }
    }

    realtimeBroadcaster.broadcast('device_registered', {
      collection: 'employee_devices',
      action: 'HEARTBEAT',
      data: { employeeId: cleanEmpId, deviceId: cleanDeviceId, status: updateFields.deviceStatus },
    });

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
