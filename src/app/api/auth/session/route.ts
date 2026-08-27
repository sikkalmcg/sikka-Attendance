import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = cookies();
  const session = cookieStore.get('sikka_session');
  return NextResponse.json({ session: session?.value ?? null });
}

