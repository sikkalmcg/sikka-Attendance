import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * High-Performance Single-Roundtrip Data Bootstrap API
 * Fetches all necessary data collections in ONE single HTTP request and ONE MongoDB connection.
 * Dramatically speeds up initial load time for APK and Web users.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const role = (searchParams.get('role') || 'EMPLOYEE').toUpperCase();
    const employeeId = searchParams.get('employeeId') || '';

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
    }

    const isEmployee = role === 'EMPLOYEE';

    if (isEmployee && employeeId) {
      // 1. Resolve employee identification synonyms (ID, Mobile, Aadhaar, Username)
      const cleanEmpId = employeeId.trim();
      const matchedEmp = await db.collection('employees').findOne({
        $or: [
          { employeeId: cleanEmpId },
          { id: cleanEmpId },
          { mobile: cleanEmpId },
          { mobileNumber: cleanEmpId },
          { aadhaar: cleanEmpId },
          { aadhaarNumber: cleanEmpId },
          { username: cleanEmpId },
        ],
      }).catch(() => null);

      const targetIds: string[] = [cleanEmpId, 'GLOBAL', 'ALL', 'N/A', ''];
      if (matchedEmp) {
        if (matchedEmp.employeeId) targetIds.push(matchedEmp.employeeId);
        if (matchedEmp.id) targetIds.push(matchedEmp.id);
        if (matchedEmp.mobile) targetIds.push(matchedEmp.mobile);
        if (matchedEmp.aadhaar) targetIds.push(matchedEmp.aadhaar);
      }

      // Fast parallel fetch for employee collections
      const [
        employees,
        attendance,
        plants,
        holidays,
        leaveRequests,
        notifications,
      ] = await Promise.all([
        db.collection('employees').find({}).toArray().catch(() => []),
        db.collection('attendance').find({}).toArray().catch(() => []),
        db.collection('plants').find({}).toArray().catch(() => []),
        db.collection('holidays').find({}).toArray().catch(() => []),
        db.collection('leaveRequests').find({}).toArray().catch(() => []),
        db.collection('notifications').find({
          $or: [
            { employeeId: { $in: targetIds } },
            { employeeId: { $exists: false } },
            { employeeId: null },
            { employeeId: '' },
            { targetRole: { $in: ['EMPLOYEE', 'ALL', 'GLOBAL'] } },
          ],
        }).sort({ createdAt: -1, timestamp: -1, _id: -1 }).toArray().catch(() => []),
      ]);

      return NextResponse.json({
        employees,
        attendance,
        plants,
        holidays,
        leaveRequests,
        notifications,
        vouchers: [],
        payroll: [],
        firms: [],
        users: [],
      });
    }

    // 2. Admin / HR / Super Admin bootstrap (loads all management tables in parallel)
    const [
      employees,
      attendance,
      vouchers,
      plants,
      firms,
      holidays,
      leaveRequests,
      users,
      notifications,
      payroll,
    ] = await Promise.all([
      db.collection('employees').find({}).toArray().catch(() => []),
      db.collection('attendance').find({}).toArray().catch(() => []),
      db.collection('vouchers').find({}).toArray().catch(() => []),
      db.collection('plants').find({}).toArray().catch(() => []),
      db.collection('firms').find({}).toArray().catch(() => []),
      db.collection('holidays').find({}).toArray().catch(() => []),
      db.collection('leaveRequests').find({}).toArray().catch(() => []),
      db.collection('users').find({}).toArray().catch(() => []),
      db.collection('notifications').find({}).sort({ createdAt: -1, timestamp: -1, _id: -1 }).toArray().catch(() => []),
      db.collection('payroll').find({}).toArray().catch(() => []),
    ]);

    return NextResponse.json({
      employees,
      attendance,
      vouchers,
      plants,
      firms,
      holidays,
      leaveRequests,
      users,
      notifications,
      payroll,
    });
  } catch (error: any) {
    console.error('Data bootstrap error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to bootstrap data' }, { status: 500 });
  }
}
