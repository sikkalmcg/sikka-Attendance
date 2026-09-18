import { NextResponse } from 'next/server';
import { processAutoMarkOut } from '@/lib/autoMarkOut';

export async function GET(request) {
  try {
    const result = await processAutoMarkOut();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('Auto mark out cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
