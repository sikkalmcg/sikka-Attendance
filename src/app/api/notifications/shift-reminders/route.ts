import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { evaluateShiftAttendanceReminders, getISTDate } from "@/lib/shift-notification-service";
import type { AttendanceRecord, Employee, Holiday } from "@/lib/types";

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleShiftReminders();
}

export async function POST() {
  return handleShiftReminders();
}

async function handleShiftReminders() {
  try {
    const db = await getDb().catch((err) => {
      console.warn("MongoDB connection deferred in shift-reminders:", err);
      return null;
    });

    if (!db) {
      return NextResponse.json({ success: true, evaluatedEmployees: 0, newRemindersCount: 0, newReminders: [] });
    }

    // 1. Fetch relevant collections with catch fallback
    const [employeesRaw, attendanceRaw, holidaysRaw, existingNotificationsRaw] = await Promise.all([
      db.collection("employees").find({ active: { $ne: false } }).toArray().catch(() => []),
      db.collection("attendance").find({}).toArray().catch(() => []),
      db.collection("holidays").find({}).toArray().catch(() => []),
      db.collection("notifications").find({ type: "SHIFT_REMINDER" }).toArray().catch(() => []),
    ]);

    const employees: Employee[] = (employeesRaw || []).map((e: any) => ({
      ...e,
      id: e.id || e._id?.toString(),
    }));

    const attendanceRecords: AttendanceRecord[] = (attendanceRaw || []).map((a: any) => ({
      ...a,
      id: a.id || a._id?.toString(),
    }));

    const holidays: Holiday[] = (holidaysRaw || []).map((h: any) => ({
      ...h,
      id: h.id || h._id?.toString(),
    }));

    const existingNotifications = (existingNotificationsRaw || []).map((n: any) => ({
      ...n,
      id: n.id || n._id?.toString(),
      dedupeKey: n.dedupeKey,
    }));

    const currentIST = getISTDate();

    // 2. Evaluate shift reminders
    const remindersToCreate = evaluateShiftAttendanceReminders({
      employees,
      attendanceRecords,
      holidays,
      existingNotifications,
      currentISTTime: currentIST,
    });

    const insertedReminders: any[] = [];

    // 3. Insert with strict deduplication
    for (const reminder of remindersToCreate) {
      try {
        const result = await db.collection("notifications").updateOne(
          { dedupeKey: reminder.dedupeKey },
          {
            $setOnInsert: {
              ...reminder,
              createdAt: new Date(),
            },
          },
          { upsert: true }
        );

        if (result?.upsertedCount && result.upsertedCount > 0) {
          insertedReminders.push(reminder);
        }
      } catch (insertErr) {
        console.error("Error inserting reminder:", insertErr);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: currentIST.toISOString(),
      evaluatedEmployees: employees.length,
      newRemindersCount: insertedReminders.length,
      newReminders: insertedReminders,
    });
  } catch (error: any) {
    console.error("Error processing shift attendance reminders:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to process shift attendance reminders",
      },
      { status: 500 }
    );
  }
}
