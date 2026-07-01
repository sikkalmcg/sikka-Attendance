import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const history = await db.plantExitEvent.findMany({
      include: {
        locations: true,
        // Yahan aap employee aur plant details relational links add kar sakte hain
      },
      orderBy: { exitTime: 'desc' }
    });
    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}