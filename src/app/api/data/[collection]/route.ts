import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getSessionUser } from '@/lib/auth/session';
import { invalidateBootstrapCache, updateCachedCollection } from '@/lib/data-cache';
import { realtimeBroadcaster } from '@/lib/realtime-events';
import { format, parseISO, isValid, isBefore } from 'date-fns';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function validateAttendancePayload(payload: any) {
  const statusUpper = String(payload.status || payload.attendanceType || payload.displayStatus || '').toUpperCase();
  const isAbsentOrNonPresent = statusUpper === 'ABSENT' || statusUpper === 'WEEKLY OFF' || statusUpper === 'HOLIDAY' || statusUpper === 'LEAVE' || statusUpper === 'REJECTED';
  const isRestoration = payload.restoredBy !== undefined || payload.restoredAt !== undefined;
  const isStatusOrApprovalUpdate = payload.approved !== undefined || payload.exitEvents !== undefined || payload.currentGeofenceStatus !== undefined;

  const inDate = (payload.inDate || payload.date || "").trim();
  const inTime = (payload.inTime || "").trim();

  // If this is an absent/leave/holiday/rejected entry, restoration, or status update without inTime, skip timestamp requirement
  if (!inTime && (isAbsentOrNonPresent || isRestoration || isStatusOrApprovalUpdate)) {
    return { valid: true };
  }

  // If inTime is not provided for a regular shift/present record, require IN Date and IN Time
  if (!inDate || !inTime) {
    if (isAbsentOrNonPresent || isRestoration) {
      return { valid: true };
    }
    return { valid: false, error: "IN Date and IN Time are mandatory." };
  }

  // Server time in Asia/Kolkata (IST)
  const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const todayISTStr = format(nowIST, "yyyy-MM-dd");
  const nowISTTimeStr = format(nowIST, "HH:mm");

  // Check IN Date/Time future restriction
  if (inDate > todayISTStr) {
    return { valid: false, error: "Future date and time are not allowed. Please select the current or a previous date and time." };
  }

  if (inDate === todayISTStr && inTime > nowISTTimeStr) {
    return { valid: false, error: "Future date and time are not allowed. Please select the current or a previous date and time." };
  }

  const inDT = parseISO(`${inDate}T${inTime}:00`);
  if (!isValid(inDT)) {
    return { valid: false, error: "Invalid IN Date or Time format." };
  }

  // OUT Date & Time validation (if provided)
  const outDate = (payload.outDate || "").trim();
  const outTime = (payload.outTime || "").trim();

  if (outDate || outTime) {
    if (!outDate || !outTime) {
      return { valid: false, error: "Both OUT Date and OUT Time must be provided if OUT is entered." };
    }

    if (outDate > todayISTStr) {
      return { valid: false, error: "Future date and time are not allowed. Please select the current or a previous date and time." };
    }

    if (outDate === todayISTStr && outTime > nowISTTimeStr) {
      return { valid: false, error: "Future date and time are not allowed. Please select the current or a previous date and time." };
    }

    const outDT = parseISO(`${outDate}T${outTime}:00`);
    if (!isValid(outDT)) {
      return { valid: false, error: "Invalid OUT Date or Time format." };
    }

    if (isBefore(outDT, inDT)) {
      return { valid: false, error: "OUT date and time cannot be earlier than IN date and time." };
    }
  }

  return { valid: true };
}

// 1. GET HANDLER: Saari collections ka data read karne ke liye
export async function GET(
  req: Request,
  { params }: { params: { collection: string } }
) {
  try {
    const { collection } = params;
    const db = await getDb();
    
    if (collection === 'notifications') {
      const data = await db.collection(collection).find({}).sort({ createdAt: -1, timestamp: -1, _id: -1 }).limit(100).toArray();
      return NextResponse.json(data);
    }

    if (collection === 'attendance') {
      const data = await db.collection(collection).find({}).sort({ date: -1, inDateTime: -1, _id: -1 }).toArray();
      return NextResponse.json(data);
    }

    const data = await db.collection(collection).find({}).toArray();
    return NextResponse.json(data);
  } catch (error: any) {
    if (error?.digest === 'DYNAMIC_SERVER_USAGE' || error?.message?.includes('Dynamic server usage')) {
      throw error;
    }
    console.error(`GET Error in ${params.collection}:`, error);
    return NextResponse.json({ error: "Failed to fetch data", details: error?.message || String(error) }, { status: 500 });
  }
}

// 2. POST HANDLER: Naya data insert karne ke liye
// For `attendance` we MUST prevent duplicates for same employee+date and enforce role-based access.
export async function POST(
  req: Request,
  { params }: { params: { collection: string } }
) {
  try {
    const { collection } = params;
    const body = await req.json();
    const db = await getDb();

    if (collection === 'attendance') {
      const employeeId = body?.employeeId;
      const date = body?.date || body?.inDate;

      if (!employeeId || !date) {
        return NextResponse.json({ error: 'Missing employeeId/date for attendance upsert' }, { status: 400 });
      }

      const validation = validateAttendancePayload(body);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error, message: validation.error }, { status: 400 });
      }

      const attendanceCol = db.collection(collection);

      // Upsert by (employeeId, date)
      const existing = await attendanceCol.findOne({ employeeId, date });
      if (!existing) {
        const result = await attendanceCol.insertOne(body);
        const insertedDoc = { ...body, _id: result.insertedId };
        updateCachedCollection('attendance', 'INSERT', insertedDoc);
        realtimeBroadcaster.broadcast('attendance_updated', { collection: 'attendance', action: 'INSERT', data: body });
        return NextResponse.json({ success: true, id: result.insertedId });
      }

      // Merge: always keep one record per employee+date.
      const updateFields: any = { ...body };
      delete updateFields._id;
      delete updateFields.id;

      await attendanceCol.updateOne(
        { employeeId, date },
        { $set: updateFields }
      );
      updateCachedCollection('attendance', 'UPDATE', { ...existing, ...updateFields });
      realtimeBroadcaster.broadcast('attendance_updated', { collection: 'attendance', action: 'UPDATE', data: updateFields });
      return NextResponse.json({ success: true, id: existing._id });
    }

    const result = await db.collection(collection).insertOne(body);
    const createdDoc = { ...body, _id: result.insertedId };
    updateCachedCollection(collection, 'INSERT', createdDoc);

    if (collection === 'attendance') {
      realtimeBroadcaster.broadcast('attendance_updated', { collection, action: 'INSERT', data: body });
    } else if (collection === 'leaveRequests') {
      realtimeBroadcaster.broadcast('leave_updated', { collection, action: 'INSERT', data: body });
    } else if (collection === 'notifications') {
      realtimeBroadcaster.broadcast('notification_created', { collection, action: 'INSERT', data: body });
    } else {
      realtimeBroadcaster.broadcast('data_mutation', { collection, action: 'INSERT', data: body });
    }

    return NextResponse.json({ success: true, id: result.insertedId });
  } catch (error: any) {
    console.error(`POST Error in ${params.collection}:`, error);
    return NextResponse.json({ error: "Failed to create record" }, { status: 500 });
  }
}

// 3. PUT HANDLER: Data update karne ke liye
export async function PUT(
  req: Request,
  { params }: { params: { collection: string } }
) {
  try {
    const { collection } = params;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    const body = await req.json();
    const db = await getDb();

    if (collection === 'attendance') {
      const validation = validateAttendancePayload(body);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error, message: validation.error }, { status: 400 });
      }
    }

    const updateData = { ...body };
    delete updateData._id;
    delete updateData.id;

    let query: any = { id: id };
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: new ObjectId(id) }, { id: id }, { _id: id }] };
    }

    const result = await db.collection(collection).updateOne(
      query,
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    updateCachedCollection(collection, 'UPDATE', { id, _id: id, ...updateData });

    if (collection === 'attendance') {
      realtimeBroadcaster.broadcast('attendance_updated', { collection, action: 'UPDATE', data: updateData });
    } else if (collection === 'leaveRequests') {
      realtimeBroadcaster.broadcast('leave_updated', { collection, action: 'UPDATE', data: updateData });
    } else if (collection === 'notifications') {
      realtimeBroadcaster.broadcast('notification_created', { collection, action: 'UPDATE', data: updateData });
    } else {
      realtimeBroadcaster.broadcast('data_mutation', { collection, action: 'UPDATE', data: updateData });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`PUT Error in ${params.collection}:`, error);
    return NextResponse.json({ error: "Failed to update record" }, { status: 500 });
  }
}

// 4. DELETE HANDLER: Data delete karne ke liye
export async function DELETE(
  req: Request,
  { params }: { params: { collection: string } }
) {
  try {
    const { collection } = params;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    const db = await getDb();

    let query: any = { id: id };
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: new ObjectId(id) }, { id: id }, { _id: id }] };
    }

    const result = await db.collection(collection).deleteOne(query);

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    updateCachedCollection(collection, 'DELETE', { id, _id: id });
    realtimeBroadcaster.broadcast('data_mutation', { collection, action: 'DELETE' });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`DELETE Error in ${params.collection}:`, error);
    return NextResponse.json({ error: "Failed to delete record" }, { status: 500 });
  }
}