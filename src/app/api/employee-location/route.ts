import { NextResponse, NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { sendFCMPushNotification } from '@/lib/fcm-service';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const getISTTime = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
};

// Convert any timestamp or time string into standard IST 12-hour format "hh:mm a" (e.g. "01:30 PM")
function formatToReadableISTTime(rawTime: any): string {
  if (!rawTime) return format(getISTTime(), 'hh:mm a');
  const str = String(rawTime).trim();
  if (!str) return format(getISTTime(), 'hh:mm a');

  // Case 1: Time string only e.g. "14:34" or "09:04" or "02:34 PM" or "9:04:00 AM"
  if (/^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?$/i.test(str)) {
    const match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = match[2];
      const ampmSpec = match[3]?.toUpperCase();
      if (ampmSpec) {
        return `${String(h).padStart(2, '0')}:${m} ${ampmSpec}`;
      }
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
    }
  }

  // Case 2: Date + Time string without explicit timezone offset (e.g. "2026-09-01 09:04:00" or "2026-09-01T09:04:00")
  // Since our system stores local IST times without timezone, extract the time portion directly to prevent false UTC+5:30 shift
  const dtMatch = str.match(/^\d{4}-\d{2}-\d{2}[ T](\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(AM|PM))?$/i);
  if (dtMatch) {
    let h = parseInt(dtMatch[1], 10);
    const m = dtMatch[2];
    const ampmSpec = dtMatch[3]?.toUpperCase();
    if (ampmSpec) {
      return `${String(h).padStart(2, '0')}:${m} ${ampmSpec}`;
    }
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
  }

  // Case 3: ISO string with explicit Z or +/- timezone offset (convert UTC/offset to IST)
  try {
    const parsed = new Date(str);
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

// Clean address string for high readability
function cleanAddressString(addr: string): string {
  if (!addr) return '';
  return addr
    .replace(/,\s*IND$/i, '')
    .replace(/,\s*India$/i, '')
    .trim();
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
          return cleanAddressString(addr);
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
        return cleanAddressString(data.display_name);
      }
    }
  } catch (e) {
    console.warn('OSM reverse geocode error in /api/employee-location:', e);
  }

  return '';
}

async function handleGetEmployeeLocation(
  employeeId: string,
  triggerPush: boolean,
  liveLat?: number | null,
  liveLng?: number | null
) {
  const db = await getDb();
  if (!db) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const empIdUpper = employeeId.toUpperCase();
  const nowIso = new Date().toISOString();
  const todayStr = format(getISTTime(), 'yyyy-MM-dd');

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
  const empName = employeeDoc?.name || (employeeDoc as any)?.fullName || 'Employee';

  // 2. If fresh GPS coordinates are supplied with request, save immediately to device registry & return live address
  if (typeof liveLat === 'number' && typeof liveLng === 'number') {
    const freshAddress = await reverseGeocodeCoords(liveLat, liveLng);
    const finalFreshAddr = freshAddress || `GPS: ${liveLat.toFixed(6)}, ${liveLng.toFixed(6)}`;

    const existingDev = await db.collection('employee_devices').findOne({
      $or: [
        { employeeId: { $in: synonymList } },
        { employeeName: { $in: synonymList } },
      ],
    }).catch(() => null);

    const devUpdateData = {
      employeeId: employeeDoc?.employeeId || employeeId,
      employeeName: empName,
      gpsLatitude: liveLat,
      gpsLongitude: liveLng,
      completeAddress: finalFreshAddr,
      locationAddress: finalFreshAddr,
      lastActiveAt: nowIso,
      lastHeartbeatAt: nowIso,
      updatedAt: nowIso,
      isActive: true,
      active: true,
      deviceStatus: 'ACTIVE',
    };

    if (existingDev) {
      await db.collection('employee_devices').updateOne(
        { _id: existingDev._id },
        { $set: devUpdateData }
      ).catch(() => {});
    } else {
      await db.collection('employee_devices').insertOne({
        ...devUpdateData,
        createdAt: nowIso,
      }).catch(() => {});
    }

    const formattedTime = formatToReadableISTTime(nowIso);

    return NextResponse.json({
      success: true,
      employeeId,
      employeeName: empName,
      status: 'LIVE',
      isLive: true,
      address: finalFreshAddr,
      lastUpdated: formattedTime,
      lastUpdatedDate: todayStr,
      lat: liveLat,
      lng: liveLng,
      deviceName: 'Employee Mobile Device',
      source: 'LIVE_GPS_CAPTURE',
    });
  }

  // 3. Trigger background location request to employee device if requested
  if (triggerPush) {
    sendFCMPushNotification({
      title: 'Location Sync',
      message: 'Background location sync requested',
      type: 'REQUEST_LOCATION',
      employeeId,
      data: { action: 'SYNC_LOCATION', timestamp: nowIso },
    }).catch(() => {});
  }

  // 4. Query data sources in parallel: plantExits, employee_devices, attendance
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

  const candidatePoints: Array<{
    lat: number | null;
    lng: number | null;
    address: string;
    rawTime: string;
    timestampMs: number;
    source: string;
    isLive: boolean;
    isToday: boolean;
    deviceName: string;
  }> = [];

  // Parse candidate from employee_devices (live heartbeats)
  for (const dev of deviceRecords) {
    const lat = typeof dev.gpsLatitude === 'number' ? dev.gpsLatitude : (dev.gpsLatitude ? parseFloat(dev.gpsLatitude) : null);
    const lng = typeof dev.gpsLongitude === 'number' ? dev.gpsLongitude : (dev.gpsLongitude ? parseFloat(dev.gpsLongitude) : null);
    const timeStr = dev.lastActiveAt || dev.lastHeartbeatAt || dev.updatedAt || '';
    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
      const isToday = Boolean(timeStr && timeStr.startsWith(todayStr));
      const parsedTime = timeStr ? new Date(timeStr).getTime() : 0;
      const isLive = isToday;
      candidatePoints.push({
        lat,
        lng,
        address: dev.completeAddress || dev.locationAddress || dev.address || '',
        rawTime: timeStr,
        timestampMs: parsedTime,
        source: 'DEVICE_REGISTRY',
        isLive,
        isToday,
        deviceName: dev.deviceName || dev.model || 'Employee Mobile Device',
      });
    }
  }

  // Parse candidate from plantExits (live exit tracking)
  for (const exit of plantExitRecords) {
    const timeStr = exit.outPlantTime || exit.updatedAt || '';
    const isToday = Boolean(timeStr && timeStr.startsWith(todayStr));
    const history = Array.isArray(exit.outLocationHistory) ? exit.outLocationHistory : [];
    if (history.length > 0) {
      const lastPt = history[history.length - 1];
      const lat = typeof lastPt.lat === 'number' ? lastPt.lat : (lastPt.lat ? parseFloat(lastPt.lat) : null);
      const lng = typeof lastPt.lng === 'number' ? lastPt.lng : (lastPt.lng ? parseFloat(lastPt.lng) : null);
      if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
        const ptTime = lastPt.time || timeStr;
        const parsedTime = ptTime ? new Date(ptTime.replace(' ', 'T')).getTime() : 0;
        candidatePoints.push({
          lat,
          lng,
          address: lastPt.address || exit.completeAddress || '',
          rawTime: ptTime,
          timestampMs: parsedTime,
          source: 'EXIT_TRACKING_HISTORY',
          isLive: isToday && !exit.inPlantTime && exit.trackingStatus === 'Outside Plant',
          isToday,
          deviceName: 'Employee Mobile Device',
        });
      }
    } else if (exit.gpsLatitude && exit.gpsLongitude) {
      const lat = typeof exit.gpsLatitude === 'number' ? exit.gpsLatitude : parseFloat(exit.gpsLatitude);
      const lng = typeof exit.gpsLongitude === 'number' ? exit.gpsLongitude : parseFloat(exit.gpsLongitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        const parsedTime = timeStr ? new Date(timeStr.replace(' ', 'T')).getTime() : 0;
        candidatePoints.push({
          lat,
          lng,
          address: exit.completeAddress || '',
          rawTime: timeStr,
          timestampMs: parsedTime,
          source: 'EXIT_TRACKING_EVENT',
          isLive: isToday && !exit.inPlantTime,
          isToday,
          deviceName: 'Employee Mobile Device',
        });
      }
    }
  }

  // Parse candidate from attendance punches
  for (const att of attendanceRecords) {
    const isToday = att.date === todayStr;
    const timeStr = att.outDateTime || att.inDateTime || (att.outTime ? `${att.date} ${att.outTime}` : `${att.date} ${att.inTime}`);
    const parsedTime = timeStr ? new Date(timeStr.replace(' ', 'T')).getTime() : 0;
    const lat = att.latOut || att.lat;
    const lng = att.lngOut || att.lng;
    if (typeof lat === 'number' && typeof lng === 'number') {
      candidatePoints.push({
        lat,
        lng,
        address: att.addressOut || att.address || '',
        rawTime: timeStr,
        timestampMs: parsedTime,
        source: 'ATTENDANCE_PUNCH',
        isLive: isToday,
        isToday,
        deviceName: 'Employee Mobile Device',
      });
    }
  }

  // Sort candidate points by timestampMs descending so most recent location is ALWAYS chosen
  candidatePoints.sort((a, b) => b.timestampMs - a.timestampMs);
  const bestPoint = candidatePoints[0] || null;

  if (!bestPoint) {
    return NextResponse.json({
      success: true,
      employeeId,
      employeeName: empName,
      status: 'NO_RECORDS',
      isLive: false,
      address: '',
      lastUpdated: null,
      lat: null,
      lng: null,
      deviceName: 'No Registered Device',
    });
  }

  // 5. Resolve clean human-readable street address
  let finalAddress = cleanAddressString(bestPoint.address);
  if (bestPoint.lat !== null && bestPoint.lng !== null) {
    if (!finalAddress || finalAddress.includes('Plant Zone') || finalAddress === 'Location unavailable') {
      const geocoded = await reverseGeocodeCoords(bestPoint.lat, bestPoint.lng);
      if (geocoded) {
        finalAddress = geocoded;
      }
    }
  }

  if (!finalAddress && bestPoint.lat && bestPoint.lng) {
    finalAddress = `GPS: ${bestPoint.lat.toFixed(6)}, ${bestPoint.lng.toFixed(6)}`;
  }

  const formattedTime = formatToReadableISTTime(bestPoint.rawTime || nowIso);

  return NextResponse.json({
    success: true,
    employeeId,
    employeeName: empName,
    status: 'LIVE',
    isLive: true,
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
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');
    const lat = latParam ? parseFloat(latParam) : null;
    const lng = lngParam ? parseFloat(lngParam) : null;

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    return await handleGetEmployeeLocation(employeeId, triggerPush, lat, lng);
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
    const lat = typeof body.gpsLatitude === 'number' ? body.gpsLatitude : (typeof body.lat === 'number' ? body.lat : null);
    const lng = typeof body.gpsLongitude === 'number' ? body.gpsLongitude : (typeof body.lng === 'number' ? body.lng : null);

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    return await handleGetEmployeeLocation(employeeId, triggerPush, lat, lng);
  } catch (error: any) {
    console.error('Error in POST /api/employee-location:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch employee location' }, { status: 500 });
  }
}


