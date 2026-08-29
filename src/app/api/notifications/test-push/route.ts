import { NextResponse } from 'next/server';
import { sendFCMPushNotification } from '@/lib/fcm-service';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

/**
 * Secure Test API for developers/admins to test FCM Push Notifications.
 *
 * Usage (POST JSON):
 * {
 *   "employeeId": "EMP001",
 *   "type": "DAY_IN_REMINDER", // or DAY_OUT_REMINDER, NIGHT_IN_REMINDER, NIGHT_OUT_REMINDER
 *   "title": "Test Reminder",
 *   "message": "This is a test notification from Sikka HRMS",
 *   "testSecret": "YOUR_TEST_SECRET" // optional or check env
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Missing request body' }, { status: 400 });
    }

    const {
      employeeId,
      token,
      title = 'Attendance Reminder Test',
      message = 'Hope you are now at work. Please Mark IN your attendance.',
      type = 'DAY_IN_REMINDER',
      shift = 'DAY',
      testSecret,
    } = body;

    const expectedSecret = process.env.TEST_SECRET || process.env.CRON_SECRET;
    if (expectedSecret && testSecret !== expectedSecret) {
      // Optional security check if secret is set
      // Allow if running in development mode
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized test request' }, { status: 401 });
      }
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    // If specific token is passed directly, register it temporarily or send directly
    if (token) {
      await db.collection('device_tokens').updateOne(
        { token },
        {
          $set: {
            token,
            employeeId: employeeId || 'TEST_USER',
            role: 'EMPLOYEE',
            active: true,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );
    }

    const result = await sendFCMPushNotification({
      title,
      message,
      type,
      employeeId: employeeId || '',
      targetRole: 'EMPLOYEE',
      shift: shift === 'NIGHT' ? 'NIGHT' : 'DAY',
      shiftDate: new Date().toISOString().split('T')[0],
      eventId: `TEST_${employeeId || 'GLOBAL'}_${Date.now()}`,
      deepLink: '/dashboard/attendance',
      data: { isTest: true, testTimestamp: new Date().toISOString() },
    });

    return NextResponse.json({
      success: result.success,
      details: result,
      info: {
        title,
        message,
        type,
        employeeId: employeeId || 'ALL_REGISTERED_EMPLOYEES',
      },
    });
  } catch (error: any) {
    console.error('Test push error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to send test push' },
      { status: 500 }
    );
  }
}
