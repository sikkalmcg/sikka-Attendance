import { NextResponse, NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { sendFCMPushNotification } from '@/lib/fcm-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const getISTTime = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
};

// Convert any timestamp or time string into standard IST 12-hour format "hh:mm a" (e.g. "02:34 PM")
function formatToReadableTime(rawTime: any): string {
  if (!rawTime) return '';
  const str = String(rawTime).trim();
  if (!str) return '';

  // Case 1: Time string only e.g. "14:34" or "14:34:00" or "02:34 PM"
  if (/^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?$/i.test(str)) {
    if (/AM|PM/i.test(str)) return str.toUpperCase();
    const parts = str.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
    }
  }

  // Case 2: Full date/time string or ISO string
  try {
    const isoClean = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str;
    const parsed = new Date(isoClean);
    if (!isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(parsed);
    }
  } catch (e) {}

  return str;
}

// Reverse geocode helper (ArcGIS with OpenStreetMap fallback)
async function reverseGeocodeCoords(lat: number, lng: number): Promise<string> {
  // 1. Try ArcGIS if API key exists
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
    } catch (e) {
      console.warn('ArcGIS reverse geocode error in /api/employee-location:', e);
    }
  }

  // 2. Try OpenStreetMap Nominatim as reliable fallback
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
  } catch (e) {
    console.warn('OSM reverse geocode error in /api/employee-location:', e);
  }

  return '';
}

async function handleGetEmployeeLocation(employeeId: string, triggerPush: boolean) {
  const db = await getDb();
  if (!db) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const empIdUpper = employeeId.toUpperCase();

  // 1. Resolve employee metadata & aliases
  const employeeDoc = await db.collection('employees').findOne({
    $or: [
      { employeeId: { $regex: new RegExp(`^${employeeId}$`, 'i') } },
      { id: { $regex: new RegExp(`^${employeeId}$`, 'i') } },
      { mobile: employeeId },
      { mobileNumber: employeeId },
      { username: { $regex: new RegExp(`^${employeeId}$`, 'i') } },
    ],
  }).catch(() => null);

  const synonyms = new Set<string>([empIdUpper]);
  if (employeeDoc) {
    if (employeeDoc.employeeId) synonyms.add(String(employeeDoc.employeeId).toUpperCase());
    if (employeeDoc.id) synonyms.add(String(employeeDoc.id).toUpperCase());
    if (employeeDoc.mobile) synonyms.add(String(employeeDoc.mobile).toUpperCase());
    if (employeeDoc.mobileNumber) synonyms.add(String(employeeDoc.mobileNumber).toUpperCase());
    if (employeeDoc.name) synonyms.add(String(employeeDoc.name).toUpperCase());
    if (employeeDoc.fullName) synonyms.add(String(employeeDoc.fullName).toUpperCase());
    if (employeeDoc.username) synonyms.add(String(employeeDoc.username).toUpperCase());
  }

  const synonymList = Array.from(synonyms);

  // 2. Trigger background location request to employee device if requested
  if (triggerPush) {
    sendFCMPushNotification({
      title: 'Location Sync',
      message: 'Background location sync requested',
      type: 'REQUEST_LOCATION',
      employeeId,
      data: { action: 'SYNC_LOCATION', timestamp: new Date().toISOString() },
    }).catch(() => {});
  }

  // 3. Query data sources in parallel: plantExits, employee_devices, attendance
  const [plantExitRecords, deviceRecords, attendanceRecords] = await Promise.all([
    db.collection('plantExits')
      .find({
        $or: [
          { employeeCode: { $in: synonymList } },
          { employeeName: { $in: synonymList } },
        ],
      })
      .sort({ updatedAt: -1, outPlantTime: -1, _id: -1 })
      .limit(5)
      .toArray()
      .catch(() => []),

    db.collection('employee_devices')
      .find({
        $or: [
          { employeeId: { $in: synonymList } },
          { employeeName: { $in: synonymList } },
        ],
      })
      .sort({ lastActiveAt: -1, lastHeartbeatAt: -1, updatedAt: -1, _id: -1 })
      .limit(5)
      .toArray()
      .catch(() => []),

    db.collection('attendance')
      .find({
        $or: [
          { employeeId: { $in: synonymList } },
          { employeeName: { $in: synonymList } },
        ],
      })
      .sort({ date: -1, inDateTime: -1, _id: -1 })
      .limit(5)
      .toArray()
      .catch(() => []),
  ]);

  let bestPoint: {
    lat: number | null;
    lng: number | null;
    address: string;
    rawTime: string;
    source: string;
    isLive: boolean;
    deviceName: string;
  } | null = null;

  // Check (A): Plant Exits (Continuous live GPS tracking points from employee device)
  for (const exit of plantExitRecords) {
    const history = Array.isArray(exit.outLocationHistory) ? exit.outLocationHistory : [];
    if (history.length > 0) {
      const lastPt = history[history.length - 1];
      if (typeof lastPt.lat === 'number' && typeof lastPt.lng === 'number') {
        bestPoint = {
          lat: lastPt.lat,
          lng: lastPt.lng,
          address: lastPt.address || exit.completeAddress || '',
          rawTime: lastPt.time || exit.outPlantTime || exit.updatedAt || '',
          source: 'EXIT_TRACKING_HISTORY',
          isLive: !exit.inPlantTime && exit.trackingStatus === 'Outside Plant',
          deviceName: 'Employee Mobile Device',
        };
        break;
      }
    }
    if (typeof exit.gpsLatitude === 'number' && typeof exit.gpsLongitude === 'number') {
      bestPoint = {
        lat: exit.gpsLatitude,
        lng: exit.gpsLongitude,
        address: exit.completeAddress || '',
        rawTime: exit.outPlantTime || exit.updatedAt || '',
        source: 'EXIT_TRACKING_EVENT',
        isLive: !exit.inPlantTime,
        deviceName: 'Employee Mobile Device',
      };
      break;
    }
  }

  // Check (B): employee_devices (latest heartbeat / GPS ping from device)
  if (!bestPoint) {
    for (const dev of deviceRecords) {
      if (typeof dev.gpsLatitude === 'number' && typeof dev.gpsLongitude === 'number') {
        const lastActive = dev.lastActiveAt || dev.lastHeartbeatAt || dev.updatedAt;
        let isDeviceLive = dev.deviceStatus === 'ACTIVE' || dev.active === true;
        // If last active was within last 30 minutes, consider live
        if (lastActive) {
          try {
            const ageMs = Date.now() - new Date(lastActive).getTime();
            if (ageMs > 30 * 60 * 1000) {
              isDeviceLive = false;
            }
          } catch (e) {}
        }
        bestPoint = {
          lat: dev.gpsLatitude,
          lng: dev.gpsLongitude,
          address: dev.completeAddress || dev.locationAddress || dev.address || '',
          rawTime: lastActive || '',
          source: 'DEVICE_REGISTRY',
          isLive: isDeviceLive,
          deviceName: dev.deviceName || dev.model || 'Employee Mobile Device',
        };
        break;
      }
    }
  }

  // Check (C): Attendance records (Live Shift punches or exitEvents from employee device)
  if (!bestPoint && attendanceRecords.length > 0) {
    const activeShift = attendanceRecords.find((a: any) => a.status === 'Open' || (a.inTime && !a.outTime && a.status !== 'Closed' && a.status !== 'Auto OUT'));
    const targetAtt = activeShift || attendanceRecords[0];

    if (targetAtt) {
      const exitEvents = Array.isArray(targetAtt.exitEvents) ? targetAtt.exitEvents : [];
      const activeExit = exitEvents.find((e: any) => !e.inPlantTime && e.trackingStatus === 'Outside Plant') || exitEvents[exitEvents.length - 1];

      if (activeExit) {
        const hist = activeExit.outLocationHistory || [];
        const lastHist = hist[hist.length - 1];
        if (lastHist && typeof lastHist.lat === 'number' && typeof lastHist.lng === 'number') {
          bestPoint = {
            lat: lastHist.lat,
            lng: lastHist.lng,
            address: lastHist.address || activeExit.completeAddress || '',
            rawTime: lastHist.time || activeExit.outPlantTime || '',
            source: 'ATTENDANCE_EXIT_POINT',
            isLive: !!activeShift,
            deviceName: 'Employee Mobile Device',
          };
        } else if (typeof activeExit.gpsLatitude === 'number' && typeof activeExit.gpsLongitude === 'number') {
          bestPoint = {
            lat: activeExit.gpsLatitude,
            lng: activeExit.gpsLongitude,
            address: activeExit.completeAddress || '',
            rawTime: activeExit.outPlantTime || '',
            source: 'ATTENDANCE_EXIT_EVENT',
            isLive: !!activeShift,
            deviceName: 'Employee Mobile Device',
          };
        }
      }

      if (!bestPoint) {
        const lat = targetAtt.latOut || targetAtt.lat;
        const lng = targetAtt.lngOut || targetAtt.lng;
        const addr = targetAtt.addressOut || targetAtt.address || '';
        const time = targetAtt.outDateTime || targetAtt.inDateTime || (targetAtt.outTime ? `${targetAtt.date} ${targetAtt.outTime}` : `${targetAtt.date} ${targetAtt.inTime}`);

        if (typeof lat === 'number' && typeof lng === 'number') {
          bestPoint = {
            lat,
            lng,
            address: addr,
            rawTime: time || '',
            source: 'ATTENDANCE_PUNCH',
            isLive: !!activeShift,
            deviceName: 'Employee Mobile Device',
          };
        }
      }
    }
  }

  if (!bestPoint) {
    return NextResponse.json({
      success: true,
      employeeId,
      employeeName: employeeDoc?.name || employeeDoc?.fullName || 'Employee',
      status: 'NO_RECORDS',
      isLive: false,
      address: '',
      lastUpdated: null,
      lat: null,
      lng: null,
      deviceName: 'No Registered Device',
    });
  }

  // 4. Resolve human-readable street address
  let finalAddress = bestPoint.address;
  if (bestPoint.lat !== null && bestPoint.lng !== null) {
    if (!finalAddress || finalAddress.includes('Plant Zone') || finalAddress.includes('Industrial Area') || finalAddress === 'Location Not Available' || finalAddress === 'Location unavailable') {
      const geocoded = await reverseGeocodeCoords(bestPoint.lat, bestPoint.lng);
      if (geocoded) {
        finalAddress = geocoded;
      }
    }
  }

  if (!finalAddress && bestPoint.lat && bestPoint.lng) {
    finalAddress = `GPS: ${bestPoint.lat.toFixed(6)}, ${bestPoint.lng.toFixed(6)}`;
  }

  const formattedTime = formatToReadableTime(bestPoint.rawTime) || 'Recently';

  return NextResponse.json({
    success: true,
    employeeId,
    employeeName: employeeDoc?.name || employeeDoc?.fullName || 'Employee',
    status: bestPoint.isLive ? 'LIVE' : 'LAST_KNOWN',
    isLive: bestPoint.isLive,
    address: finalAddress || 'Address resolving...',
    lastUpdated: formattedTime,
    lat: bestPoint.lat,
    lng: bestPoint.lng,
    deviceName: bestPoint.deviceName,
    source: bestPoint.source,
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const employeeId = (searchParams.get('employeeId') || searchParams.get('employeeCode') || '').trim();
    const triggerPush = searchParams.get('trigger') === 'true';

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    return await handleGetEmployeeLocation(employeeId, triggerPush);
  } catch (error: any) {
    console.error('Error in GET /api/employee-location:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch employee location' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const employeeId = String(body.employeeId || body.employeeCode || '').trim();
    const triggerPush = body.trigger !== false;

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    return await handleGetEmployeeLocation(employeeId, triggerPush);
  } catch (error: any) {
    console.error('Error in POST /api/employee-location:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch employee location' }, { status: 500 });
  }
}
