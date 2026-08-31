import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR'];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // Always resolve authenticated user from session cookie (authoritative)
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('sikka_session')?.value;
    let sessionUser: any = null;
    if (sessionCookie) {
      try { sessionUser = JSON.parse(sessionCookie); } catch {}
    }

    const sessionRole = String(sessionUser?.role || '').toUpperCase();
    const isAdmin = ADMIN_ROLES.includes(sessionRole);

    const db = await getDb();
    if (!db) return NextResponse.json({ count: 0 });

    // Admin: count unread notifications (strictly excluding employee attendance reminders)
    if (isAdmin) {
      const EXCLUDED_ADMIN_TYPES = [
        'DAY_MARK_IN_REMINDER',
        'DAY_MARK_OUT_REMINDER',
        'NIGHT_MARK_IN_REMINDER',
        'NIGHT_MARK_OUT_REMINDER',
        'SHIFT_REMINDER',
        'DAY_IN_REMINDER',
        'DAY_OUT_REMINDER',
        'NIGHT_IN_REMINDER',
        'NIGHT_OUT_REMINDER'
      ];
      const unreadCount = await db.collection('notifications').countDocuments({
        type: { $nin: EXCLUDED_ADMIN_TYPES },
        notificationType: { $nin: EXCLUDED_ADMIN_TYPES },
        notification_type: { $nin: EXCLUDED_ADMIN_TYPES },
        reminderType: { $exists: false },
        $or: [{ isRead: false }, { read: false }, { isRead: { $exists: false } }],
      });
      return NextResponse.json({ count: unreadCount, unreadCount });
    }

    // Employee: strictly only their own unread notifications
    let employeeId = sessionUser?.employeeId || sessionUser?.username || sessionUser?.id || '';
    if (!employeeId) {
      employeeId = searchParams.get('employeeId') || '';
    }
    if (!employeeId) return NextResponse.json({ count: 0, unreadCount: 0 });

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

    const targetIds = new Set<string>();
    targetIds.add(employeeId);
    if (matchedEmp) {
      if (matchedEmp.employeeId) targetIds.add(matchedEmp.employeeId);
      if (matchedEmp.id) targetIds.add(String(matchedEmp.id));
      if (matchedEmp.mobile) targetIds.add(matchedEmp.mobile);
      if (matchedEmp.mobileNumber) targetIds.add(matchedEmp.mobileNumber);
      if (matchedEmp.aadhaar) targetIds.add(matchedEmp.aadhaar);
      if (matchedEmp.aadhaarNumber) targetIds.add(matchedEmp.aadhaarNumber);
      if (matchedEmp.username) targetIds.add(matchedEmp.username);
    }
    const targetIdsArr = Array.from(targetIds).filter(Boolean);

    // STRICT: no null/empty/ALL/GLOBAL (Section 5 security)
    const unreadCount = await db.collection('notifications').countDocuments({
      $and: [
        {
          $or: [
            { employeeId: { $in: targetIdsArr } },
            { employee_id: { $in: targetIdsArr } },
            { loginId: { $in: targetIdsArr } },
            { login_id: { $in: targetIdsArr } },
          ],
        },
        { $or: [{ isRead: false }, { read: false }, { isRead: { $exists: false } }] },
      ],
    });

    return NextResponse.json({ count: unreadCount, unreadCount });
  } catch (error: any) {
    console.error('Error in /api/notifications/unread-count:', error);
    return NextResponse.json({ count: 0, unreadCount: 0 });
  }
}
