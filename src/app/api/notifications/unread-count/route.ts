import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let employeeId = searchParams.get('employeeId');

    if (!employeeId) {
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get('sikka_session')?.value;
      if (sessionCookie) {
        try {
          const user = JSON.parse(sessionCookie);
          employeeId = user.employeeId || user.username || user.id;
        } catch {}
      }
    }

    if (!employeeId) {
      return NextResponse.json({ unreadCount: 0 });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ unreadCount: 0 });
    }

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

    const query = {
      $and: [
        {
          $or: [
            { employeeId: { $in: targetIds } },
            { employeeId: { $exists: false } },
            { employeeId: null },
            { employeeId: '' },
          ],
        },
        {
          $or: [
            { isRead: false },
            { read: false },
            { isRead: { $exists: false } },
          ],
        },
      ],
    };

    const unreadCount = await db.collection('notifications').countDocuments(query);

    return NextResponse.json({ unreadCount });
  } catch (error: any) {
    console.error('Error in /api/notifications/unread-count:', error);
    return NextResponse.json({ unreadCount: 0 });
  }
}
