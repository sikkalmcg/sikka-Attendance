import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { sendFCMPushNotification } from '@/lib/fcm-service';

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

    const createdNotifications: any[] = [];
    const uniqueEmpIds = Array.from(new Set(employeeIds.map((id: string) => String(id).trim()).filter(Boolean)));

    for (const rawEmpId of uniqueEmpIds) {
      // Find matching employee details from DB
      const emp = await db.collection('employees').findOne({
        $or: [
          { employeeId: rawEmpId },
          { id: rawEmpId },
          { mobile: rawEmpId },
          { mobileNumber: rawEmpId },
          { aadhaar: rawEmpId },
          { aadhaarNumber: rawEmpId },
          { username: rawEmpId },
        ],
      }).catch(() => null);

      const targetEmpId = emp?.employeeId || rawEmpId;
      const targetEmpName = emp ? (emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim()) : rawEmpId;

      // 3. Step 1: Create notification record in MongoDB (Section 10)
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

      // 4. Step 2 & 3: Find employee device tokens & Send FCM push notification (Section 2, 9, 10, 11)
      try {
        const pushRes = await sendFCMPushNotification({
          notificationId: insertedId,
          title: title || 'New Notification',
          message: cleanMessage,
          type: 'CUSTOM_NOTIFICATION',
          employeeId: targetEmpId,
          targetRole: 'EMPLOYEE',
          deepLink: '/dashboard/attendance',
          data: {
            notificationId: insertedId,
            senderUserId: finalSenderId,
            senderUserName: finalSenderName,
            dateTime: nowIso,
          },
        });

        // 5. Step 4: Update push status in MongoDB
        if (pushRes.success && pushRes.successCount > 0) {
          await db.collection('notifications').updateOne(
            { _id: insertResult.insertedId },
            {
              $set: {
                pushSent: true,
                pushSentAt: new Date().toISOString(),
                status: 'sent',
                pushError: null,
                updatedAt: new Date().toISOString(),
              },
            }
          );
        } else {
          await db.collection('notifications').updateOne(
            { _id: insertResult.insertedId },
            {
              $set: {
                pushSent: false,
                status: 'failed',
                pushError: pushRes.error || (pushRes.totalTokens === 0 ? 'No active device tokens found' : 'FCM delivery failed'),
                updatedAt: new Date().toISOString(),
              },
            }
          );
        }
      } catch (pushErr: any) {
        console.warn(`Push dispatch exception for employee ${targetEmpId}:`, pushErr);
        await db.collection('notifications').updateOne(
          { _id: insertResult.insertedId },
          {
            $set: {
              pushSent: false,
              status: 'failed',
              pushError: pushErr?.message || 'Push dispatch exception',
              updatedAt: new Date().toISOString(),
            },
          }
        );
      }

      createdNotifications.push({
        id: insertedId,
        employeeId: targetEmpId,
        employeeName: targetEmpName,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Notification sent successfully to ${createdNotifications.length} employee${createdNotifications.length > 1 ? 's' : ''}.`,
      count: createdNotifications.length,
      records: createdNotifications,
    });
  } catch (error: any) {
    console.error('Error in /api/notifications/send:', error);
    return NextResponse.json({ error: error?.message || 'Failed to send notification' }, { status: 500 });
  }
}
