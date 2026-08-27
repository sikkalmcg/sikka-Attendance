import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

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

    // Role-based targeting check:
    // Employee Mark IN / Mark OUT / Shift Reminders MUST ONLY go to Employee users.
    const isEmployeeOnlyType = ['MARK_IN', 'MARK_OUT', 'AUTO_OUT', 'SHIFT_REMINDER'].includes(type);

    const query: any = {};

    if (isEmployeeOnlyType) {
      // Must be an employee token and match target employeeId (or all employees if broadcast)
      query.role = { $in: ['EMPLOYEE', 'Employee'] };
      if (employeeId) {
        query.employeeId = employeeId;
      }
    } else if (targetRole) {
      query.role = targetRole.toUpperCase();
      if (employeeId) {
        query.employeeId = employeeId;
      }
    }

    const deviceTokens = await db.collection('device_tokens').find(query).toArray();

    if (!deviceTokens || deviceTokens.length === 0) {
      return NextResponse.json({
        success: true,
        sentCount: 0,
        message: 'No registered target devices found for push notification',
      });
    }

    // Store notification record for history & tracking
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

    const tokensList = deviceTokens.map((d: any) => d.token).filter(Boolean);

    // If FCM Server Key or Firebase Admin is configured via env, send native push
    const fcmServerKey = process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVER_KEY;
    let pushResult = { successCount: tokensList.length, failureCount: 0 };

    if (fcmServerKey && tokensList.length > 0) {
      try {
        const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${fcmServerKey}`,
          },
          body: JSON.stringify({
            registration_ids: tokensList,
            notification: {
              title: title || 'Attendance Notification',
              body: message || '',
              sound: 'default',
              badge: '1',
              channel_id: 'sikka_attendance_channel',
            },
            data: {
              title: title || 'Attendance Notification',
              message: message || '',
              type,
              employeeId: employeeId || '',
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
              timestamp: new Date().toISOString(),
              ...data,
            },
            priority: 'high',
          }),
        });

        if (!fcmResponse.ok) {
          const errText = await fcmResponse.text();
          console.warn('FCM send error response:', errText);
        }
      } catch (fcmErr) {
        console.error('Error invoking FCM push service:', fcmErr);
      }
    }

    return NextResponse.json({
      success: true,
      sentCount: tokensList.length,
      targetRole: isEmployeeOnlyType ? 'EMPLOYEE' : targetRole,
      recipients: deviceTokens.map((d: any) => ({ employeeId: d.employeeId, role: d.role })),
    });
  } catch (error: any) {
    console.error('Error processing push notification:', error);
    return NextResponse.json({ error: error?.message || 'Failed to send push notification' }, { status: 500 });
  }
}
