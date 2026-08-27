import { NextResponse } from 'next/server';
import { eachDayOfInterval, endOfYear, format, isSunday, startOfYear } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get('year');
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  if (isNaN(year)) {
    return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 });
  }

  const start = startOfYear(new Date(year, 0, 1));
  const end = endOfYear(new Date(year, 11, 31));
  const days = eachDayOfInterval({ start, end });

  const sundays = days
    .filter(d => isSunday(d))
    .map(d => ({
      id: `sun-${format(d, "yyyy-MM-dd")}`,
      date: format(d, "yyyy-MM-dd"),
      name: "Weekly Off",
      type: "WEEKLY_OFF",
      auto: true,
    }));

  return NextResponse.json(sundays);
}
