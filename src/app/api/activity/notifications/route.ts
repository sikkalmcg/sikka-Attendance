import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

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
        { employee_id: regex },
        { title: regex },
        { message: regex },
        { type: regex },
        { notificationType: regex },
        { notification_type: regex },
        { source: regex },
        { senderUser: regex },
        { senderUserName: regex },
      ];
    }

    const collection = db.collection('notifications');

    const [total, items] = await Promise.all([
      collection.countDocuments(query),
      collection
        .find(query)
        .sort({ createdAt: -1, timestamp: -1, notificationDateTime: -1, _id: -1 })
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
    console.error('Error in GET /api/activity/notifications:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch activity notifications' },
      { status: 500 }
    );
  }
}
