import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getCachedBootstrapData, setCachedBootstrapData } from '@/lib/data-cache';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR'];

/**
 * High-Performance Single-Roundtrip Data Bootstrap API
 * Returns all necessary MongoDB collections in a single unified payload.
 * Notifications are filtered by the logged-in user's employee ID for security.
 * Admin roles receive all notifications.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Resolve session user for notification filtering
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('sikka_session')?.value;
    let sessionUser: any = null;
    if (sessionCookie) {
      try { sessionUser = JSON.parse(sessionCookie); } catch {}
    }
    const sessionRole = String(sessionUser?.role || '').toUpperCase();
    const isAdmin = ADMIN_ROLES.includes(sessionRole);
    const sessionEmpId = sessionUser?.employeeId || sessionUser?.username || sessionUser?.id || '';

    // Cache key — include empId so different users get their own cached slice
    const cacheKey = isAdmin ? 'admin' : sessionEmpId;

    // Return from in-memory cache if available & fresh
    if (!forceRefresh) {
      const cached = getCachedBootstrapData(cacheKey);
      if (cached) {
        return NextResponse.json(cached, {
          headers: {
            'Cache-Control': 'no-cache, must-revalidate',
            'X-Cache-Status': 'HIT',
          },
        });
      }
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
    }

    // Build notification query based on role
    let notificationQuery: any = {};
    if (!isAdmin && sessionEmpId) {
      // Resolve all aliases for this employee
      const matchedEmp = await db.collection('employees').findOne({
        $or: [
          { employeeId: sessionEmpId },
          { id: sessionEmpId },
          { mobile: sessionEmpId },
          { mobileNumber: sessionEmpId },
          { username: sessionEmpId },
          { aadhaar: sessionEmpId },
          { aadhaarNumber: sessionEmpId },
        ],
      }).catch(() => null);

      const targetIds = new Set<string>();
      targetIds.add(sessionEmpId);
      if (matchedEmp) {
        if (matchedEmp.employeeId) targetIds.add(matchedEmp.employeeId);
        if (matchedEmp.id) targetIds.add(String(matchedEmp.id));
        if (matchedEmp.mobile) targetIds.add(matchedEmp.mobile);
        if (matchedEmp.mobileNumber) targetIds.add(matchedEmp.mobileNumber);
        if (matchedEmp.aadhaar) targetIds.add(matchedEmp.aadhaar);
        if (matchedEmp.aadhaarNumber) targetIds.add(matchedEmp.aadhaarNumber);
        if (matchedEmp.username) targetIds.add(matchedEmp.username);
      }
      // STRICT: only this employee's notifications (Section 5)
      notificationQuery = { employeeId: { $in: Array.from(targetIds).filter(Boolean) } };
    }
    // For admin: notificationQuery = {} → returns all notifications

    // Fetch all collections in parallel
    const [
      employees,
      attendance,
      plants,
      holidays,
      leaveRequests,
      notifications,
      vouchers,
      firms,
      users,
      payroll,
    ] = await Promise.all([
      db.collection('employees').find({}).toArray().catch(() => []),
      db.collection('attendance').find({}).sort({ date: -1 }).limit(1200).toArray().catch(() => []),
      db.collection('plants').find({}).toArray().catch(() => []),
      db.collection('holidays').find({}).toArray().catch(() => []),
      db.collection('leaveRequests').find({}).sort({ createdAt: -1, fromDate: -1 }).limit(300).toArray().catch(() => []),
      db.collection('notifications').find(notificationQuery).sort({ createdAt: -1, timestamp: -1, _id: -1 }).limit(isAdmin ? 200 : 100).toArray().catch(() => []),
      db.collection('vouchers').find({}).sort({ date: -1 }).limit(300).toArray().catch(() => []),
      db.collection('firms').find({}).toArray().catch(() => []),
      db.collection('users').find({}).toArray().catch(() => []),
      db.collection('payroll').find({}).sort({ createdAt: -1 }).limit(300).toArray().catch(() => []),
    ]);

    const payload = {
      employees,
      attendance,
      plants,
      holidays,
      leaveRequests,
      notifications,
      vouchers,
      firms,
      users,
      payroll,
    };

    setCachedBootstrapData(payload, cacheKey);

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-cache, must-revalidate',
        'X-Cache-Status': 'MISS',
      },
    });
  } catch (error: any) {
    console.error('Data bootstrap error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to bootstrap data' }, { status: 500 });
  }
}
