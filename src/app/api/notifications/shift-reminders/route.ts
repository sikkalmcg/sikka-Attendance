import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { evaluateShiftAttendanceReminders, getISTDate } from "@/lib/shift-notification-service";
import { sendFCMPushNotification } from "@/lib/fcm-service";
import type { AttendanceRecord, Employee, Holiday, LeaveRequest } from "@/lib/types";

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
    const [employeesRaw, attendanceRaw, holidaysRaw, leaveRequestsRaw, existingNotificationsRaw] = await Promise.all([
      db.collection("employees").find({ active: { $ne: false } }).toArray().catch(() => []),
      db.collection("attendance").find({}).toArray().catch(() => []),
      db.collection("holidays").find({}).toArray().catch(() => []),
      db.collection("leaveRequests").find({ status: "APPROVED" }).toArray().catch(() => []),
      db.collection("notifications").find({
        type: { $in: ["SHIFT_REMINDER", "DAY_IN_REMINDER", "DAY_OUT_REMINDER", "NIGHT_IN_REMINDER", "NIGHT_OUT_REMINDER"] }
      }).toArray().catch(() => []),
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

    const leaveRequests: LeaveRequest[] = (leaveRequestsRaw || []).map((l: any) => ({
      ...l,
      id: l.id || l._id?.toString(),
    }));

    const existingNotifications = (existingNotificationsRaw || []).map((n: any) => ({
      ...n,
      id: n.id || n._id?.toString(),
      dedupeKey: n.dedupeKey,
    }));

    const currentIST = getISTDate();

    // 2. Evaluate shift reminders based on exact business logic & time thresholds
    const remindersToCreate = evaluateShiftAttendanceReminders({
      employees,
      attendanceRecords,
      holidays,
      leaveRequests,
      existingNotifications,
      currentISTTime: currentIST,
    });

    const insertedReminders: any[] = [];
    const pushResults: any[] = [];

    // 3. Insert into MongoDB & dispatch FCM Push with strict deduplication
    for (const reminder of remindersToCreate) {
      try {
        const notifDoc = {
          title: reminder.title,
          message: reminder.message,
          timestamp: reminder.timestamp,
          read: false,
          type: reminder.type,
          shift: reminder.shift,
          reminderType: reminder.reminderType,
          employeeId: reminder.employeeId,
          employeeName: reminder.employeeName,
          dedupeKey: reminder.dedupeKey,
          shiftDate: reminder.shiftDate,
          action: reminder.action,
          deepLink: reminder.deepLink,
          createdAt: new Date(),
        };

        const result = await db.collection("notifications").updateOne(
          { dedupeKey: reminder.dedupeKey },
          {
            $setOnInsert: notifDoc,
          },
          { upsert: true }
        );

        // If newly inserted (upsertedCount > 0), dispatch FCM Push Notification
        if (result?.upsertedCount && result.upsertedCount > 0) {
          insertedReminders.push(reminder);

          const pushRes = await sendFCMPushNotification({
            title: reminder.title,
            message: reminder.message,
            type: reminder.type,
            employeeId: reminder.employeeId,
            targetRole: "EMPLOYEE",
            eventId: reminder.dedupeKey,
            shift: reminder.shift,
            shiftDate: reminder.shiftDate,
            deepLink: reminder.deepLink,
            data: {
              reminderType: reminder.reminderType,
              action: reminder.action,
              employeeName: reminder.employeeName,
            },
          });

          pushResults.push({
            employeeId: reminder.employeeId,
            type: reminder.type,
            pushSuccess: pushRes.success,
            tokensSent: pushRes.totalTokens,
            successCount: pushRes.successCount,
          });
        }
      } catch (insertErr) {
        console.error("Error inserting and dispatching reminder:", insertErr);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: currentIST.toISOString(),
      evaluatedEmployees: employees.length,
      newRemindersCount: insertedReminders.length,
      newReminders: insertedReminders,
      pushResults,
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
