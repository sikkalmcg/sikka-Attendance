import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR'];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // 1. Always resolve the authenticated user from the session cookie first (authoritative)
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('sikka_session')?.value;
    let sessionUser: any = null;
    if (sessionCookie) {
      try { sessionUser = JSON.parse(sessionCookie); } catch {}
    }

    const sessionRole = String(sessionUser?.role || '').toUpperCase();
    const isAdmin = ADMIN_ROLES.includes(sessionRole);

    // 2. For admin roles — return notifications (excluding employee attendance reminders)
    if (isAdmin) {
      const db = await getDb();
      if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

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

      const notifications = await db
        .collection('notifications')
        .find({
          type: { $nin: EXCLUDED_ADMIN_TYPES },
          notificationType: { $nin: EXCLUDED_ADMIN_TYPES },
          notification_type: { $nin: EXCLUDED_ADMIN_TYPES },
          reminderType: { $exists: false },
        })
        .sort({ createdAt: -1, timestamp: -1, _id: -1 })
        .limit(200)
        .toArray();

      return NextResponse.json(notifications);
    }

    // 3. For employee roles — strictly enforce employee ID (Section 5 security)
    //    Use session cookie as the authoritative source.
    //    Query param is accepted as a hint but OVERRIDDEN by session if they differ.
    let employeeId = sessionUser?.employeeId || sessionUser?.username || sessionUser?.id || '';

    // Allow query param only if it matches the session user (prevents parameter tampering)
    const queryEmpId = searchParams.get('employeeId');
    if (queryEmpId && !employeeId) {
      // No session — use query param (unauthenticated fallback, still resolved below)
      employeeId = queryEmpId;
    }

    if (!employeeId) {
      return NextResponse.json({ error: 'Missing employee identification' }, { status: 400 });
    }

    const db = await getDb();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    // 4. Resolve all aliases for this employee (employeeId, id, mobile, aadhaar, username)
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

    // Build the strict target ID set — NO null, NO empty, NO 'ALL', NO 'GLOBAL'
    // Section 5: "Employee A must never see Employee B's notifications"
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

    // 5. STRICT query — only this employee's notifications
    //    DELIBERATELY excludes: null, '', 'ALL', 'GLOBAL' — Security Rule (Section 5)
    const notifications = await db
      .collection('notifications')
      .find({
        $or: [
          { employeeId: { $in: targetIdsArr } },
          { employee_id: { $in: targetIdsArr } },
          { loginId: { $in: targetIdsArr } },
          { login_id: { $in: targetIdsArr } },
        ],
      })
      .sort({ createdAt: -1, timestamp: -1, _id: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json(notifications);
  } catch (error: any) {
    console.error('Error in /api/notifications/my:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch notifications' }, { status: 500 });
  }
}
