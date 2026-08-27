import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.token) {
      return NextResponse.json({ error: 'Missing device token' }, { status: 400 });
    }

    const { token, employeeId, role, deviceName, platform } = body;
    const cleanToken = String(token).trim();
    const cleanRole = String(role || 'EMPLOYEE').toUpperCase();
    const cleanEmpId = String(employeeId || '').trim();

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    const collection = db.collection('device_tokens');
    await collection.updateOne(
      { token: cleanToken },
      {
        $set: {
          token: cleanToken,
          employeeId: cleanEmpId,
          role: cleanRole,
          deviceName: deviceName || 'Android Device',
          platform: platform || 'android',
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: 'Device token registered successfully' });
  } catch (error: any) {
    console.error('Error registering device token:', error);
    return NextResponse.json({ error: error?.message || 'Failed to register device' }, { status: 500 });
  }
}
