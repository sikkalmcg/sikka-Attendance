import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR'];

const EXCLUDED_REMINDER_TYPES = [
  'DAY_MARK_IN_REMINDER',
  'DAY_MARK_OUT_REMINDER',
  'NIGHT_MARK_IN_REMINDER',
  'NIGHT_MARK_OUT_REMINDER',
  'SHIFT_REMINDER',
  'DAY_IN_REMINDER',
  'DAY_OUT_REMINDER',
  'NIGHT_IN_REMINDER',
  'NIGHT_OUT_REMINDER',
  'REMINDER'
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // 1. Resolve session user
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('sikka_session')?.value;
    let sessionUser: any = null;
    if (sessionCookie) {
      try { sessionUser = JSON.parse(sessionCookie); } catch {}
    }

    const sessionRole = String(sessionUser?.role || '').toUpperCase();
    const isAdmin = ADMIN_ROLES.includes(sessionRole);

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    // 2. Admin receives system/admin notifications, but strictly NEVER receives employee attendance reminders
    if (isAdmin) {
      const allNotifs = await db
        .collection('notifications')
        .find({
          type: { $nin: EXCLUDED_REMINDER_TYPES },
          notificationType: { $nin: EXCLUDED_REMINDER_TYPES },
          notification_type: { $nin: EXCLUDED_REMINDER_TYPES },
          reminderType: { $exists: false },
        })
        .sort({ createdAt: -1, timestamp: -1, _id: -1 })
        .limit(200)
        .toArray();
      return NextResponse.json(allNotifs);
    }

    // 3. Employee: strict filtering by Employee ID / aliases (excluding reminders)
    let employeeId = sessionUser?.employeeId || sessionUser?.username || sessionUser?.id || '';
    if (!employeeId) {
      employeeId = searchParams.get('employeeId') || '';
    }

    if (!employeeId) {
      return NextResponse.json([]);
    }

    const matchedEmp = await db.collection('employees').findOne({
      $or: [
        { employeeId },
        { id: employeeId },
        { mobile: employeeId },
        { mobileNumber: employeeId },
        { username: employeeId },
        { aadhaar: employeeId },
        { aadhaarNumber: employeeId },
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

    const notifs = await db
      .collection('notifications')
      .find({
        $and: [
          { employeeId: { $in: Array.from(targetIds).filter(Boolean) } },
          {
            type: { $nin: EXCLUDED_REMINDER_TYPES },
            notificationType: { $nin: EXCLUDED_REMINDER_TYPES },
            notification_type: { $nin: EXCLUDED_REMINDER_TYPES },
            reminderType: { $exists: false },
          },
        ],
      })
      .sort({ createdAt: -1, timestamp: -1, _id: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json(notifs);
  } catch (error: any) {
    console.error('Error in /api/data/notifications:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch notifications' }, { status: 500 });
  }
}
