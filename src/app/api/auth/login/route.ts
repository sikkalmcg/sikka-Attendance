import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

const DEV_DUMMY_USERS = [
  // Using the creds shared by the user for local dev
  { username: 'ajaysomra', password: 'Mayank@2012', id: '1', role: 'SUPER_ADMIN', fullName: 'Ajay Somra', plantIds: [] },
  { username: 'mayank.hr', password: 'Mayank@2012', id: '2', role: 'HR', fullName: 'Mayank Sharma', plantIds: [] },
];

function jsonBadRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

function jsonUnauthorized(message = 'Invalid username or password') {
  return NextResponse.json({ message }, { status: 401 });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return jsonBadRequest('Missing body');

  const { username, password, deviceId, deviceName } = body as {
    username?: string;
    password?: string;
    deviceId?: string;
    deviceName?: string;
  };

  if (!username || !password) return jsonBadRequest('Missing username/password');

  // 1) Dev fallback
  const devUser = DEV_DUMMY_USERS.find((u) => u.username === username && u.password === password);
  if (devUser) {
    return NextResponse.json({
      sessionId: `${devUser.id}-${Date.now()}`,
      id: devUser.id,
      username: devUser.username,
      fullName: devUser.fullName,
      role: devUser.role,
      plantIds: devUser.plantIds || [],
      deviceId: deviceId || null,
      deviceName: deviceName || null,
    });
  }

  // 2) MongoDB lookup (optional; requires users collection schema matching existing types)
  // NOTE: This keeps the endpoint functional even if Mongo isn't seeded.
  try {
    const db = await getDb();
    const usersCol = db.collection('users');

    const userDoc = (await usersCol.findOne({ username })) as any;

    if (!userDoc) return jsonUnauthorized();
    if (userDoc.password && userDoc.password !== password) return jsonUnauthorized();

    return NextResponse.json({
      sessionId: `${userDoc._id || 'unknown'}-${Date.now()}`,
      id: String(userDoc._id || ''),
      username,
      fullName: userDoc.fullName || username,
      role: userDoc.role || 'EMPLOYEE',
      plantIds: userDoc.plantIds || [],
      deviceId: deviceId || null,
      deviceName: deviceName || null,
    });
  } catch {

    // Don't leak server errors to client
    return jsonUnauthorized('Invalid username or password');
  }
}

