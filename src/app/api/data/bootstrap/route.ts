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

    // Resolve session user for notification & query filtering
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('sikka_session')?.value;
    let sessionUser: any = null;
    if (sessionCookie) {
      try { sessionUser = JSON.parse(sessionCookie); } catch {}
    }

    // Header/Query fallback if cookie is absent
    const roleParam = searchParams.get('role') || req.headers.get('x-user-role');
    const empIdParam = searchParams.get('empId') || req.headers.get('x-employee-id');

    const sessionRole = String(sessionUser?.role || roleParam || '').toUpperCase();
    const isAdmin = ADMIN_ROLES.includes(sessionRole);
    const sessionEmpId = sessionUser?.employeeId || sessionUser?.username || sessionUser?.id || empIdParam || '';

    // Check high-speed in-memory cache
    const cacheKey = isAdmin ? 'admin_all' : `emp_${sessionEmpId || 'public'}`;
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

    // Build employee-specific queries if authenticated as standard employee
    let notificationQuery: any = {};
    let attendanceQuery: any = {};
    const targetIds = new Set<string>();

    if (!isAdmin && sessionEmpId) {
      targetIds.add(sessionEmpId);
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

      if (matchedEmp) {
        if (matchedEmp.employeeId) targetIds.add(matchedEmp.employeeId);
        if (matchedEmp.id) targetIds.add(String(matchedEmp.id));
        if (matchedEmp.mobile) targetIds.add(matchedEmp.mobile);
        if (matchedEmp.mobileNumber) targetIds.add(matchedEmp.mobileNumber);
        if (matchedEmp.aadhaar) targetIds.add(matchedEmp.aadhaar);
        if (matchedEmp.aadhaarNumber) targetIds.add(matchedEmp.aadhaarNumber);
        if (matchedEmp.username) targetIds.add(matchedEmp.username);
        if (matchedEmp.name) targetIds.add(matchedEmp.name);
        if ((matchedEmp as any).fullName) targetIds.add((matchedEmp as any).fullName);
      }

      const empIds = Array.from(targetIds).filter(Boolean);

      // STRICT: only this employee's notifications
      notificationQuery = { employeeId: { $in: empIds } };

      // Build attendance query: employee gets complete personal history
      attendanceQuery = {
        $or: [
          { employeeId: { $in: empIds } },
          { employeeName: { $in: empIds } },
        ]
      };
    }

    // Fetch all collections in parallel without arbitrary truncation
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
      db.collection('employees').find({}).batchSize(500).toArray().catch((err) => { console.error('[Bootstrap] employees error:', err); return []; }),
      db.collection('attendance').find(attendanceQuery, {
        projection: {
          employeeId: 1,
          employeeName: 1,
          date: 1,
          inDate: 1,
          outDate: 1,
          inTime: 1,
          outTime: 1,
          hours: 1,
          status: 1,
          attendanceType: 1,
          approved: 1,
          approvedBy: 1,
          inPlant: 1,
          outPlant: 1,
          remark: 1,
          address: 1,
          addressOut: 1,
          autoCheckout: 1,
          autoOut: 1,
          unapprovedOutDuration: 1,
          inDateTime: 1,
          outDateTime: 1,
          approvalActionDate: 1,
          editedBy: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }).batchSize(5000).sort({ date: -1 }).toArray().catch((err) => { console.error('[Bootstrap] attendance error:', err); return []; }),
      db.collection('plants').find({}).toArray().catch((err) => { console.error('[Bootstrap] plants error:', err); return []; }),
      db.collection('holidays').find({}).toArray().catch((err) => { console.error('[Bootstrap] holidays error:', err); return []; }),
      db.collection('leaveRequests').find({}).sort({ createdAt: -1, fromDate: -1 }).toArray().catch((err) => { console.error('[Bootstrap] leaveRequests error:', err); return []; }),
      db.collection('notifications').find(notificationQuery).sort({ createdAt: -1, timestamp: -1, _id: -1 }).limit(isAdmin ? 200 : 100).toArray().catch((err) => { console.error('[Bootstrap] notifications error:', err); return []; }),
      db.collection('vouchers').find({}).sort({ date: -1 }).toArray().catch((err) => { console.error('[Bootstrap] vouchers error:', err); return []; }),
      db.collection('firms').find({}).toArray().catch((err) => { console.error('[Bootstrap] firms error:', err); return []; }),
      db.collection('users').find({}).toArray().catch((err) => { console.error('[Bootstrap] users error:', err); return []; }),
      db.collection('payroll').find({}).sort({ createdAt: -1 }).toArray().catch((err) => { console.error('[Bootstrap] payroll error:', err); return []; }),
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

    // Store in in-memory cache for fast sub-millisecond future requests
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
