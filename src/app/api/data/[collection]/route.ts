import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getSessionUser } from '@/lib/auth/session';
import { invalidateBootstrapCache } from '@/lib/data-cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

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
      const data = await db.collection(collection).find({}).sort({ date: -1, inDateTime: -1, _id: -1 }).limit(2000).toArray();
      return NextResponse.json(data);
    }

    const data = await db.collection(collection).find({}).toArray();
    return NextResponse.json(data);
  } catch (error: any) {
    if (error?.digest === 'DYNAMIC_SERVER_USAGE' || error?.message?.includes('Dynamic server usage')) {
      throw error;
    }
    console.error(`GET Error in ${params.collection}:`, error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
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
      const sessionUser = getSessionUser(req);
      const userRole = String(sessionUser?.role || body?.userRole || body?.role || '').trim().toUpperCase();

      // Enforce: Non-employees cannot create punch-in attendance records
      if (userRole && userRole !== 'EMPLOYEE' && !body.isApprovalAction) {
        return NextResponse.json(
          {
            success: false,
            message: "Only employees are allowed to Mark IN and Mark OUT."
          },
          { status: 403 }
        );
      }

      const employeeId = body?.employeeId;
      const date = body?.date;

      if (!employeeId || !date) {
        return NextResponse.json({ error: 'Missing employeeId/date for attendance upsert' }, { status: 400 });
      }

      const attendanceCol = db.collection(collection);

      // Upsert by (employeeId, date)
      const existing = await attendanceCol.findOne({ employeeId, date });
      if (!existing) {
        const result = await attendanceCol.insertOne(body);
        invalidateBootstrapCache();
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
      invalidateBootstrapCache();
      return NextResponse.json({ success: true, id: existing._id });
    }

    const result = await db.collection(collection).insertOne(body);
    invalidateBootstrapCache();
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
      const sessionUser = getSessionUser(req);
      const userRole = String(sessionUser?.role || body?.userRole || body?.role || '').trim().toUpperCase();

      // If user is trying to manually punch OUT but has non-employee role (and not an admin approval update)
      if (body.outTime && !body.approved && !body.isApprovalAction && userRole && userRole !== 'EMPLOYEE') {
        return NextResponse.json(
          {
            success: false,
            message: "Only employees are allowed to Mark IN and Mark OUT."
          },
          { status: 403 }
        );
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

    invalidateBootstrapCache();
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

    invalidateBootstrapCache();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`DELETE Error in ${params.collection}:`, error);
    return NextResponse.json({ error: "Failed to delete record" }, { status: 500 });
  }
}