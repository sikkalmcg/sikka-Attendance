import { NextResponse } from 'next/server';
import { getDb, toObjectId } from '@/lib/mongodb';
import { getSessionUser, requireSessionUser } from '@/lib/auth/session';
import { canDeleteCollection, isSuperAdmin } from '@/app/api/_utils/permissions';

const ALLOWED_COLLECTIONS = new Set([
  'employees',
  'attendance',
  'vouchers',
  'payroll',
  'plants',
  'firms',
  'users',
  'holidays',
  'notifications',
  'leaveRequests',
]);

type Params = { params: { collection: string } };

function badRequest(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ message }, { status: 401 });
}

export async function GET(_req: Request, { params }: Params) {
  const collection = params.collection;
  if (!ALLOWED_COLLECTIONS.has(collection)) return badRequest('Invalid collection');

  const user = getSessionUser();

  // Role-based filtering to match existing frontend logic.
  // - employees/attendance/vouchers/plants/firms/holidays/leaveRequests: only if logged in
  // - payroll: only HR/ADMIN/SUPER_ADMIN (frontend checks isAdminRole)
  // - users: only SUPER_ADMIN
  // - notifications: SUPER_ADMIN sees all; EMPLOYEE sees where employeeId == currentUser.username
  if (collection === 'payroll' && (!user || !['SUPER_ADMIN', 'ADMIN', 'HR'].includes(user.role))) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  if (collection === 'users' && (!user || user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  if (!user) {
    return unauthorized();
  }

  const db = await getDb();
  const col = db.collection(collection);

  let docs: any[];

  if (collection === 'notifications') {
    if (user.role === 'SUPER_ADMIN') {
      docs = await col.find({}).toArray();
    } else {
      // existing frontend: where('employeeId','==', currentUser.username)
      docs = await col.find({ employeeId: user.username }).toArray();
    }
  } else if (collection === 'payroll') {
    docs = await col.find({}).toArray();
  } else {
    docs = await col.find({}).toArray();
  }

  const data = docs.map((d) => ({ ...d, id: String(d._id) }));
  return NextResponse.json({ data }, { status: 200 });
}

export async function POST(req: Request, { params }: Params) {
  const collection = params.collection;
  if (!ALLOWED_COLLECTIONS.has(collection)) return badRequest('Invalid collection');

  // For writes, we still require session.
  let user;
  try {
    user = requireSessionUser();
  } catch {
    return unauthorized();
  }

  const body = await req.json().catch(() => null);
  if (!body) return badRequest('Missing body');

  const db = await getDb();
  const col = db.collection(collection);
  const result = await col.insertOne(body);

  return NextResponse.json({ id: String(result.insertedId) }, { status: 201 });
}

export async function PATCH(req: Request, { params }: Params) {
  const collection = params.collection;
  if (!ALLOWED_COLLECTIONS.has(collection)) return badRequest('Invalid collection');

  let user;
  try {
    user = requireSessionUser();
  } catch {
    return unauthorized();
  }

  const body = await req.json().catch(() => null);
  if (!body?.id) return badRequest('Missing id');

  const id = body.id as string;
  const { id: _, ...rest } = body;

  const db = await getDb();
  const col = db.collection(collection);
  await col.updateOne({ _id: toObjectId(id) }, { $set: rest });

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(_req: Request, { params }: Params) {
  const collection = params.collection;
  if (!ALLOWED_COLLECTIONS.has(collection)) return badRequest('Invalid collection');

  const user = getSessionUser();
  if (!canDeleteCollection(user)) {
    return NextResponse.json({ message: 'Permission Denied' }, { status: 403 });
  }

  const url = new URL(_req.url);
  const id = url.searchParams.get('id');
  if (!id) return badRequest('Missing id');

  const db = await getDb();
  const col = db.collection(collection);
  await col.deleteOne({ _id: toObjectId(id) });

  return NextResponse.json({ ok: true }, { status: 200 });
}

