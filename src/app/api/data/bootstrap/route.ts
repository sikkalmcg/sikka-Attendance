import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getCachedBootstrapData, setCachedBootstrapData } from '@/lib/data-cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * High-Performance Single-Roundtrip Data Bootstrap API
 * Returns all necessary MongoDB collections in a single unified payload.
 * Uses in-memory server caching for ultra-fast responses (< 50ms).
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    // 1. Return from in-memory cache if available & fresh
    if (!forceRefresh) {
      const cached = getCachedBootstrapData();
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

    // 2. Fetch all collections in parallel with index-backed optimizations
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
      db.collection('notifications').find({}).sort({ createdAt: -1, timestamp: -1, _id: -1 }).limit(60).toArray().catch(() => []),
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

    // Store in in-memory server cache
    setCachedBootstrapData(payload);

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
