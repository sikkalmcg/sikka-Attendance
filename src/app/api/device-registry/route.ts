import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { POST as handleSubscribe } from './subscribe/route';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '15', 10)));
    const search = (searchParams.get('search') || '').trim();

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    const query: any = {};
    if (search) {
      const regex = { $regex: search, $options: 'i' };
      query.$or = [
        { employeeName: regex },
        { employeeId: regex },
        { department: regex },
        { designation: regex },
        { deviceId: regex },
        { deviceName: regex },
        { platform: regex },
        { token: regex },
        { 'pushSubscription.endpoint': regex },
        { 'subscription.endpoint': regex },
      ];
    }

    const collection = db.collection('employee_devices');

    const [total, items] = await Promise.all([
      collection.countDocuments(query),
      collection
        .find(query)
        .sort({ lastActiveAt: -1, updatedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    const data = items.map((doc: any) => ({
      ...doc,
      id: doc.id || doc._id?.toString(),
    }));

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/device-registry:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch device registry records' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return handleSubscribe(req);
}
