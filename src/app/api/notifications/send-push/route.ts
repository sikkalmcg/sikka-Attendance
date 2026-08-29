import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { sendFCMPushNotification } from '@/lib/fcm-service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Missing request body' }, { status: 400 });
    }

    const {
      title,
      message,
      type = 'ATTENDANCE',
      employeeId = '',
      targetRole = 'EMPLOYEE',
      data = {},
    } = body;

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    const isEmployeeOnlyType = [
      'MARK_IN',
      'MARK_OUT',
      'AUTO_OUT',
      'SHIFT_REMINDER',
      'DAY_IN_REMINDER',
      'DAY_OUT_REMINDER',
      'NIGHT_IN_REMINDER',
      'NIGHT_OUT_REMINDER',
    ].includes(type);

    // 1. Store notification document in MongoDB for Bell notification history
    const notifDoc = {
      title: title || 'Attendance Notification',
      message: message || '',
      type,
      employeeId: employeeId || '',
      targetRole: isEmployeeOnlyType ? 'EMPLOYEE' : targetRole,
      read: false,
      timestamp: new Date().toISOString(),
      createdAt: new Date(),
      data: { ...data, type, employeeId },
    };

    await db.collection('notifications').insertOne(notifDoc).catch((err) => {
      console.warn('Failed to insert notification doc:', err);
    });

    // 2. Dispatch FCM Push Notification via unified service
    const pushResult = await sendFCMPushNotification({
      title: title || 'Attendance Notification',
      message: message || '',
      type,
      employeeId,
      targetRole: isEmployeeOnlyType ? 'EMPLOYEE' : targetRole,
      eventId: `PUSH_${employeeId || 'BROADCAST'}_${Date.now()}`,
      data,
      deepLink: '/dashboard/attendance',
    });

    return NextResponse.json({
      success: true,
      sentCount: pushResult.totalTokens,
      successCount: pushResult.successCount,
      failureCount: pushResult.failureCount,
      targetRole: isEmployeeOnlyType ? 'EMPLOYEE' : targetRole,
    });
  } catch (error: any) {
    console.error('Error processing push notification:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to send push notification' },
      { status: 500 }
    );
  }
}
