import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Shift reminder notifications are disabled. Only Mark IN / Mark OUT notifications are active.",
    evaluatedEmployees: 0,
    newRemindersCount: 0,
    newReminders: [],
  });
}

export async function POST() {
  return NextResponse.json({
    success: true,
    message: "Shift reminder notifications are disabled. Only Mark IN / Mark OUT notifications are active.",
    evaluatedEmployees: 0,
    newRemindersCount: 0,
    newReminders: [],
  });
}
