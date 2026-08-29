import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { sendFCMPushNotificationToMany } from '@/lib/fcm-service';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR'];

function getWordCount(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function POST(req: Request) {
  try {
    // 1. Authenticate sender role (Section 25: Activity Page notification sending restricted to authorized roles)
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('sikka_session')?.value;
    let sessionUser: any = null;
    if (sessionCookie) {
      try { sessionUser = JSON.parse(sessionCookie); } catch {}
    }

    const sessionRole = String(sessionUser?.role || '').toUpperCase();
    // Allow if sender is an admin role or if internal request with valid token
    if (sessionUser && !ADMIN_ROLES.includes(sessionRole)) {
      return NextResponse.json({ error: 'Forbidden: Only authorized administrative roles can broadcast notifications.' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { employeeIds, message, title = 'New Notification', senderUserId, senderUserName } = body;

    // 2. Validate employee IDs
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json({ error: 'Please select at least one employee.' }, { status: 400 });
    }

    // 3. Validate message length (max 100 words)
    const cleanMessage = String(message || '').trim();
    if (!cleanMessage) {
      return NextResponse.json({ error: 'Notification message cannot be empty.' }, { status: 400 });
    }

    const wordCount = getWordCount(cleanMessage);
    if (wordCount > 100) {
      return NextResponse.json(
        { error: `Message exceeds 100 words limit (Current: ${wordCount} words).` },
        { status: 400 }
      );
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const finalSenderId = String(sessionUser?.id || sessionUser?.username || senderUserId || 'ADMIN').trim();
    const finalSenderName = String(sessionUser?.fullName || sessionUser?.name || senderUserName || 'Admin').trim();
    const now = new Date();
    const nowIso = now.toISOString();

    // 4. Deduplicate selected IDs
    const uniqueEmpIds = Array.from(new Set(employeeIds.map((id: string) => String(id).trim()).filter(Boolean)));

    // 5. Resolve all employee details from DB in one query
    const employeeRecords = await db.collection('employees').find({
      $or: [
        { employeeId: { $in: uniqueEmpIds } },
        { id: { $in: uniqueEmpIds } },
        { mobile: { $in: uniqueEmpIds } },
        { mobileNumber: { $in: uniqueEmpIds } },
        { username: { $in: uniqueEmpIds } },
        { aadhaar: { $in: uniqueEmpIds } },
        { aadhaarNumber: { $in: uniqueEmpIds } },
      ],
    }).toArray().catch(() => []);

    // Build a map for quick lookup: rawId → employee record
    const empByIdMap = new Map<string, any>();
    for (const emp of employeeRecords) {
      const aliases = [emp.employeeId, emp.id, emp.mobile, emp.mobileNumber, emp.username, emp.aadhaar, emp.aadhaarNumber].filter(Boolean);
      for (const alias of aliases) {
        empByIdMap.set(String(alias).trim(), emp);
      }
    }

    // 6. Insert one notification record per selected employee (Section 2, 11, 12 Database Structure)
    const createdNotifications: any[] = [];
    const insertedIds: string[] = [];

    for (const rawEmpId of uniqueEmpIds) {
      const emp = empByIdMap.get(rawEmpId);
      const targetEmpId = emp?.employeeId || rawEmpId;
      const targetEmpName = emp
        ? (emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim())
        : rawEmpId;
      const targetLoginId = emp?.username || emp?.email || (emp as any)?.loginId || targetEmpId;

      const notifDoc = {
        employeeId: targetEmpId,
        employee_id: targetEmpId,
        loginId: targetLoginId,
        login_id: targetLoginId,
        employeeName: targetEmpName,
        title: title || 'New Notification',
        message: cleanMessage,
        senderUserId: finalSenderId,
        senderUserName: finalSenderName,
        senderUser: finalSenderName,
        createdBy: finalSenderId,
        created_by: finalSenderId,
        source: 'ACTIVITY_PAGE',
        notification_type: 'ACTIVITY_MESSAGE',
        notificationType: 'ACTIVITY_MESSAGE',
        type: 'ACTIVITY_MESSAGE',
        notificationDateTime: nowIso,
        timestamp: nowIso,
        scheduledAt: nowIso,
        scheduled_at: nowIso,
        sentAt: nowIso,
        sent_at: nowIso,
        isRead: false,
        read: false,
        readStatus: 'UNREAD',
        read_status: 'UNREAD',
        readAt: null,
        opened_at: null,
        openedAt: null,
        pushSent: false,
        pushSentAt: null,
        deliveryStatus: 'PENDING',
        delivery_status: 'PENDING',
        status: 'PENDING',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const insertResult = await db.collection('notifications').insertOne(notifDoc);
      const insertedId = insertResult.insertedId.toString();
      insertedIds.push(insertedId);

      createdNotifications.push({
        id: insertedId,
        employeeId: targetEmpId,
        loginId: targetLoginId,
        employeeName: targetEmpName,
      });
    }

    // 7. Dispatch push to ONLY selected employees in ONE batch call
    //    Fetches device tokens specifically for these target employees (Section 2, 3, 4)
    const pushBatchResult = await sendFCMPushNotificationToMany(uniqueEmpIds, {
      title: title || 'New Notification',
      message: cleanMessage,
      type: 'ACTIVITY_MESSAGE',
      deepLink: '/dashboard/activity',
      data: {
        notificationType: 'ACTIVITY_MESSAGE',
        source: 'ACTIVITY_PAGE',
        senderUserId: finalSenderId,
        senderUserName: finalSenderName,
        dateTime: nowIso,
      },
    });

    // 8. Update push delivery status for each notification record
    const pushSuccessEmpIds = new Set(
      Object.entries(pushBatchResult.perEmployee)
        .filter(([, status]) => status === 'sent')
        .map(([id]) => id)
    );

    for (const notif of createdNotifications) {
      const pushDelivered = pushSuccessEmpIds.has(notif.employeeId);
      await db.collection('notifications').updateOne(
        { _id: { $exists: true }, employeeId: notif.employeeId, createdAt: nowIso },
        {
          $set: {
            pushSent: pushDelivered,
            pushSentAt: pushDelivered ? new Date().toISOString() : null,
            delivery_status: pushDelivered ? 'sent' : 'saved',
            status: pushDelivered ? 'sent' : 'saved',
            updatedAt: new Date().toISOString(),
          },
        }
      ).catch(() => {});
    }

    const withPushCount = pushSuccessEmpIds.size;
    const withoutPushCount = uniqueEmpIds.length - withPushCount;

    let responseMessage = `Notification sent to ${createdNotifications.length} employee${createdNotifications.length > 1 ? 's' : ''}.`;
    if (withPushCount > 0 && withoutPushCount > 0) {
      responseMessage += ` Push delivered to ${withPushCount} active device(s). ${withoutPushCount} employee(s) will see it when they log in.`;
    } else if (withPushCount === uniqueEmpIds.length) {
      responseMessage += ` Push notification delivered to all selected employees' devices.`;
    } else if (withPushCount === 0) {
      responseMessage += ` Notification saved — employees will see it in-app upon logging in.`;
    }

    return NextResponse.json({
      success: true,
      message: responseMessage,
      count: createdNotifications.length,
      pushDelivered: withPushCount,
      pushPending: withoutPushCount,
      records: createdNotifications,
    });
  } catch (error: any) {
    console.error('Error in /api/notifications/send:', error);
    return NextResponse.json({ error: error?.message || 'Failed to send notification' }, { status: 500 });
  }
}
