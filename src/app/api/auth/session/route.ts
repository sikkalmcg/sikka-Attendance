import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = cookies();
  const session = cookieStore.get('sikka_session');
  return NextResponse.json({ session: session?.value ?? null });
}

