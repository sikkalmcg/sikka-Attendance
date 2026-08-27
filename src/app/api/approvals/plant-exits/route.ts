import { NextResponse, NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// GET: Fetch facility exit history from the MongoDB `plantExits` collection.
// Supports optional filters: employeeCode, date, plant, trackingStatus.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const employeeCode = searchParams.get('employeeCode');
    const date = searchParams.get('date');
    const plant = searchParams.get('plant');
    const trackingStatus = searchParams.get('trackingStatus');

    const db = await getDb();
    const plantExits = db.collection('plantExits');

    const filter: any = {};
    if (employeeCode) filter.employeeCode = employeeCode;
    if (date) filter.date = date;
    if (plant) filter.plant = plant;
    if (trackingStatus) filter.trackingStatus = trackingStatus;

    const history = await plantExits.find(filter).sort({ outPlantTime: -1 }).toArray();
    return NextResponse.json(history);
  } catch (error: any) {
    if (error?.digest === 'DYNAMIC_SERVER_USAGE' || error?.message?.includes('Dynamic server usage')) {
      throw error;
    }
    console.error('Plant exits GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch facility exit history' }, { status: 500 });
  }
}
