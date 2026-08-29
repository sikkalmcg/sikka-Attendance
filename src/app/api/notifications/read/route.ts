import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const { notificationId, employeeId, markAll = false } = body || {};

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const nowIso = new Date().toISOString();

    if (markAll && employeeId) {
      // Resolve employee aliases
      const matchedEmp = await db.collection('employees').findOne({
        $or: [
          { employeeId },
          { id: employeeId },
          { mobile: employeeId },
          { mobileNumber: employeeId },
          { aadhaar: employeeId },
          { aadhaarNumber: employeeId },
          { username: employeeId },
        ],
      }).catch(() => null);

      const targetIds = [employeeId, 'GLOBAL', 'ALL', ''];
      if (matchedEmp) {
        if (matchedEmp.employeeId) targetIds.push(matchedEmp.employeeId);
        if (matchedEmp.id) targetIds.push(matchedEmp.id);
        if (matchedEmp.mobile) targetIds.push(matchedEmp.mobile);
        if (matchedEmp.aadhaar) targetIds.push(matchedEmp.aadhaar);
      }

      await db.collection('notifications').updateMany(
        {
          $or: [
            { employeeId: { $in: targetIds } },
            { employeeId: { $exists: false } },
            { employeeId: null },
            { employeeId: '' },
          ],
        },
        {
          $set: {
            isRead: true,
            read: true,
            readStatus: 'READ',
            read_status: 'READ',
            readAt: nowIso,
            openedAt: nowIso,
            opened_at: nowIso,
            updatedAt: nowIso,
          },
        }
      );

      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (!notificationId) {
      return NextResponse.json({ error: 'Missing notificationId' }, { status: 400 });
    }

    // Mark single notification as read
    const filter: any = {
      $or: [
        { id: notificationId },
        { notificationId: notificationId },
        { notification_id: notificationId },
      ],
    };

    if (ObjectId.isValid(notificationId)) {
      filter.$or.push({ _id: new ObjectId(notificationId) });
    }

    await db.collection('notifications').updateOne(filter, {
      $set: {
        isRead: true,
        read: true,
        readStatus: 'READ',
        read_status: 'READ',
        readAt: nowIso,
        openedAt: nowIso,
        opened_at: nowIso,
        updatedAt: nowIso,
      },
    });

    return NextResponse.json({ success: true, message: 'Notification marked as read' });
  } catch (error: any) {
    console.error('Error in /api/notifications/read:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update read status' }, { status: 500 });
  }
}
