import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { sendFCMPushNotificationToMany } from '@/lib/fcm-service';

export const dynamic = 'force-dynamic';

function getWordCount(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { employeeIds, message, title = 'New Notification', senderUserId, senderUserName } = body;

    // 1. Validate employee IDs
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json({ error: 'Please select at least one employee.' }, { status: 400 });
    }

    // 2. Validate message length (max 100 words)
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

    const finalSenderId = String(senderUserId || 'ADMIN').trim();
    const finalSenderName = String(senderUserName || 'Admin').trim();
    const now = new Date();
    const nowIso = now.toISOString();

    // 3. Deduplicate selected IDs
    const uniqueEmpIds = Array.from(new Set(employeeIds.map((id: string) => String(id).trim()).filter(Boolean)));

    // 4. Resolve all employee details from DB in one query
    const employeeRecords = await db.collection('employees').find({
      $or: [
        { employeeId: { $in: uniqueEmpIds } },
        { id: { $in: uniqueEmpIds } },
        { mobile: { $in: uniqueEmpIds } },
        { mobileNumber: { $in: uniqueEmpIds } },
        { username: { $in: uniqueEmpIds } },
      ],
    }).toArray().catch(() => []);

    // Build a map for quick lookup: rawId → employee record
    const empByIdMap = new Map<string, any>();
    for (const emp of employeeRecords) {
      const aliases = [emp.employeeId, emp.id, emp.mobile, emp.mobileNumber, emp.username].filter(Boolean);
      for (const alias of aliases) {
        empByIdMap.set(String(alias).trim(), emp);
      }
    }

    // 5. Insert one notification record per selected employee (for the in-app bell)
    const createdNotifications: any[] = [];
    const insertedIds: string[] = [];

    for (const rawEmpId of uniqueEmpIds) {
      const emp = empByIdMap.get(rawEmpId);
      const targetEmpId = emp?.employeeId || rawEmpId;
      const targetEmpName = emp
        ? (emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim())
        : rawEmpId;

      const notifDoc = {
        employeeId: targetEmpId,
        employeeName: targetEmpName,
        title: title || 'New Notification',
        message: cleanMessage,
        senderUserId: finalSenderId,
        senderUserName: finalSenderName,
        senderUser: finalSenderName,
        notificationDateTime: nowIso,
        timestamp: nowIso,
        isRead: false,
        read: false,
        readAt: null,
        pushSent: false,
        pushSentAt: null,
        status: 'pending',
        type: 'CUSTOM_NOTIFICATION',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const insertResult = await db.collection('notifications').insertOne(notifDoc);
      const insertedId = insertResult.insertedId.toString();
      insertedIds.push(insertedId);

      createdNotifications.push({
        id: insertedId,
        employeeId: targetEmpId,
        employeeName: targetEmpName,
      });
    }

    // 6. Dispatch push to ALL selected employees in ONE batch call
    //    This fetches all device tokens in a single MongoDB query and sends to all devices.
    const pushBatchResult = await sendFCMPushNotificationToMany(uniqueEmpIds, {
      title: title || 'New Notification',
      message: cleanMessage,
      type: 'CUSTOM_NOTIFICATION',
      deepLink: '/dashboard/notifications',
      data: {
        senderUserId: finalSenderId,
        senderUserName: finalSenderName,
        dateTime: nowIso,
      },
    });

    // 7. Update push delivery status for each notification record
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
      responseMessage += ` Push delivered to ${withPushCount} device(s). ${withoutPushCount} employee(s) will see it when they open the app.`;
    } else if (withPushCount === uniqueEmpIds.length) {
      responseMessage += ` Push notification delivered to all devices.`;
    } else if (withPushCount === 0) {
      responseMessage += ` Notification saved — employees will see it when they open the app.`;
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
