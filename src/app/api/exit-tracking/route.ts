import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { calculateDistance } from '@/lib/utils';

export const PLANT_RADIUS_METERS = 700;

// Haversine distance is imported from utils (returns meters).

// ============================================================
// POST: Register a facility exit or return for an employee.
// This endpoint is generic and compliant with the spec so a
// native mobile app (Flutter / React Native) can consume the
// exact same payload for background geofencing.
//
// Request body (spec-compliant):
// {
//   employeeCode, employeeName, designation, plant,
//   date, outPlantTime?, gpsLatitude, gpsLongitude,
//   completeAddress?, distanceFromPlant?,
//   attendanceId?, action: 'OUT' | 'RETURN'
// }
// ============================================================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      employeeCode,
      employeeName,
      designation,
      plant,
      date,
      outPlantTime,
      gpsLatitude,
      gpsLongitude,
      completeAddress,
      distanceFromPlant,
      attendanceId,
      action,
    } = body;

    if (typeof gpsLatitude !== 'number' || typeof gpsLongitude !== 'number') {
      return NextResponse.json({ error: 'gpsLatitude and gpsLongitude are required numbers' }, { status: 400 });
    }
    if (!employeeCode && !attendanceId) {
      return NextResponse.json({ error: 'employeeCode or attendanceId is required' }, { status: 400 });
    }

    const db = await getDb();
    const plantExits = db.collection('plantExits');
    const attendanceCol = db.collection('attendance');

    // Resolve plant coordinates if not provided to compute distance.
    let plantName = plant;
    let distanceM = distanceFromPlant;
    if (typeof distanceM !== 'number') {
      const plantDoc = await db.collection('plants').findOne({ name: plant });
      if (plantDoc && typeof plantDoc.lat === 'number' && typeof plantDoc.lng === 'number') {
        distanceM = calculateDistance(gpsLatitude, gpsLongitude, plantDoc.lat, plantDoc.lng);
      } else {
        distanceM = null;
      }
    }

    const nowIso = new Date().toISOString();
    const timeNowStr = formatDateTimeLocal(new Date());

    // Resolve the active out record for this employee on this date (if any) so a RETURN can patch it.
    const activeFilter: any = { date };
    if (attendanceId) activeFilter.attendanceId = attendanceId;
    else activeFilter.employeeCode = employeeCode;

    const activeOut = await plantExits.findOne({ ...activeFilter, inPlantTime: null });

    if (action === 'OUT') {
      // A new facility exit record (Outside Plant).
      const record = {
        employeeCode,
        employeeName: employeeName || 'Unknown',
        designation: designation || 'Staff',
        plant: plantName || 'N/A',
        date,
        attendanceId: attendanceId || null,
        outPlantTime: outPlantTime || timeNowStr,
        gpsLatitude,
        gpsLongitude,
        completeAddress: completeAddress || 'Location Not Available',
        distanceFromPlant: distanceM != null ? Math.round(distanceM) : null,
        inPlantTime: null,
        totalOutDuration: null,
        currentPlant: null,
        trackingStatus: 'Outside Plant',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // If there is already an open out record, update it (avoid duplicate OUT events).
      let resultId;
      if (activeOut) {
        await plantExits.updateOne({ _id: activeOut._id }, { $set: { ...record, updatedAt: nowIso } });
        resultId = activeOut._id;
      } else {
        const result = await plantExits.insertOne(record);
        resultId = result.insertedId;
      }

      // Also persist onto the attendance record exitEvents for the approvals page (legacy path).
      if (attendanceId) {
        const att = await attendanceCol.findOne({ $or: [{ _id: attendanceId }, { _id: new ObjectId(attendanceId) }, { id: attendanceId }] });
        if (att) {
          const exitEvents = Array.isArray(att.exitEvents) ? att.exitEvents : [];
          const existingIdx = exitEvents.findIndex((e: any) => e.id === String(resultId));
          const event = {
            id: String(resultId),
            employeeCode,
            employeeName: employeeName || 'Unknown',
            designation: designation || 'Staff',
            plant: plantName || 'N/A',
            date,
            outPlantTime: outPlantTime || timeNowStr,
            gpsLatitude,
            gpsLongitude,
            completeAddress: completeAddress || 'Location Not Available',
            distanceFromPlant: distanceM != null ? Math.round(distanceM) : null,
            inPlantTime: null,
            totalOutDuration: null,
            currentPlant: null,
            trackingStatus: 'Outside Plant',
          };
          if (existingIdx >= 0) exitEvents[existingIdx] = event;
          else exitEvents.push(event);
          await attendanceCol.updateOne({ _id: att._id }, { $set: { exitEvents, currentGeofenceStatus: 'Outside Plant' } });
        }
      }

      return NextResponse.json({ status: 'Outside Plant', id: String(resultId) }, { status: 201 });
    }

    if (action === 'RETURN') {
      // Patch the active out record with return details.
      if (!activeOut) {
        return NextResponse.json({ error: 'No active out record found to return' }, { status: 404 });
      }

      const outTime = new Date(activeOut.outPlantTime);
      const inTime = new Date();
      const diffMs = inTime.getTime() - outTime.getTime();
      const totalMinutes = Math.max(0, Math.round(diffMs / 60000));
      const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
      const mm = String(totalMinutes % 60).padStart(2, '0');
      const totalOutDuration = `${hh}:${mm}`;

      await plantExits.updateOne(
        { _id: activeOut._id },
        {
          $set: {
            inPlantTime: timeNowStr,
            totalOutDuration,
            currentPlant: plantName || activeOut.plant,
            trackingStatus: 'Returned',
            updatedAt: nowIso,
          },
        }
      );

      // Patch the attendance record exitEvents too.
      if (activeOut.attendanceId) {
        const att = await attendanceCol.findOne({ $or: [{ _id: activeOut.attendanceId }, { _id: new ObjectId(activeOut.attendanceId) }, { id: activeOut.attendanceId }] });
        if (att && Array.isArray(att.exitEvents)) {
          const exitEvents = att.exitEvents.map((e: any) =>
            e.id === String(activeOut._id)
              ? { ...e, inPlantTime: timeNowStr, totalOutDuration, currentPlant: plantName || e.plant, trackingStatus: 'Returned' }
              : e
          );
          await attendanceCol.updateOne({ _id: att._id }, { $set: { exitEvents, currentGeofenceStatus: 'Inside Plant' } });
        }
      }

      return NextResponse.json({ status: 'Returned', id: String(activeOut._id) });
    }

    return NextResponse.json({ error: 'Invalid action. Use OUT or RETURN.' }, { status: 400 });
  } catch (error) {
    console.error('Exit tracking POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// ============================================================
// GET: Fetch facility exit history (optionally filtered).
// ============================================================
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeCode = searchParams.get('employeeCode');
    const date = searchParams.get('date');
    const plant = searchParams.get('plant');

    const db = await getDb();
    const plantExits = db.collection('plantExits');

    const filter: any = {};
    if (employeeCode) filter.employeeCode = employeeCode;
    if (date) filter.date = date;
    if (plant) filter.plant = plant;

    const history = await plantExits.find(filter).sort({ outPlantTime: -1 }).toArray();
    return NextResponse.json(history);
  } catch (error) {
    console.error('Exit tracking GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}

function formatDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
