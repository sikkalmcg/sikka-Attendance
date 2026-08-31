import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { updateCachedCollection } from '@/lib/data-cache';
import { getSessionUser } from '@/lib/auth/session';
import { realtimeBroadcaster } from '@/lib/realtime-events';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionUser = getSessionUser(req);
    const role = String(sessionUser?.role || body?.role || '').toUpperCase();
    const employeeId = body?.employeeId || sessionUser?.employeeId || sessionUser?.username || '';
    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(role);

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    if (isAdmin || body?.clearAllGlobal) {
      // Admin clear all: delete all notifications from MongoDB
      await db.collection('notifications').deleteMany({});
      updateCachedCollection('notifications', 'DELETE_ALL' as any, null);
      realtimeBroadcaster.broadcast('data_mutation', { collection: 'notifications', action: 'DELETE_ALL' });
      return NextResponse.json({ success: true, message: 'All notifications cleared' });
    }

    if (employeeId) {
      // Employee clear: delete for this specific employee
      await db.collection('notifications').deleteMany({
        $or: [
          { employeeId: employeeId },
          { employeeId: String(employeeId) },
          { employeeId: 'ALL' },
          { employeeId: 'GLOBAL' }
        ]
      });
      realtimeBroadcaster.broadcast('data_mutation', { collection: 'notifications', action: 'DELETE' });
      return NextResponse.json({ success: true, message: 'Employee notifications cleared' });
    }

    // Fallback: delete all
    await db.collection('notifications').deleteMany({});
    updateCachedCollection('notifications', 'DELETE_ALL' as any, null);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error clearing notifications:', error);
    return NextResponse.json({ error: error?.message || 'Failed to clear notifications' }, { status: 500 });
  }
}
