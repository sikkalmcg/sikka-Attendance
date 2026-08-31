import { NextResponse } from "next/server";
import { format } from "date-fns";
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

    const currentIST = getISTDate();
    const nowIso = currentIST.toISOString();
    const fourteenDaysAgoStr = format(new Date(currentIST.getTime() - 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
    const sevenDaysAgoDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // 1. Fetch relevant collections with fast indexed range queries
    const [employeesRaw, usersRaw, attendanceRaw, holidaysRaw, leaveRequestsRaw, existingNotificationsRaw] = await Promise.all([
      db.collection("employees").find({ active: { $ne: false } }).toArray().catch(() => []),
      db.collection("users").find({}).toArray().catch(() => []),
      db.collection("attendance").find({ date: { $gte: fourteenDaysAgoStr } }).toArray().catch(() => []),
      db.collection("holidays").find({}).toArray().catch(() => []),
      db.collection("leaveRequests").find({ status: "APPROVED" }).toArray().catch(() => []),
      db.collection("notifications").find({
        $or: [
          { type: { $in: ["DAY_MARK_IN_REMINDER", "DAY_MARK_OUT_REMINDER", "NIGHT_MARK_IN_REMINDER", "NIGHT_MARK_OUT_REMINDER", "SHIFT_REMINDER", "DAY_IN_REMINDER", "DAY_OUT_REMINDER", "NIGHT_IN_REMINDER", "NIGHT_OUT_REMINDER"] } },
          { notification_type: { $in: ["DAY_MARK_IN_REMINDER", "DAY_MARK_OUT_REMINDER", "NIGHT_MARK_IN_REMINDER", "NIGHT_MARK_OUT_REMINDER", "SHIFT_REMINDER", "DAY_IN_REMINDER", "DAY_OUT_REMINDER", "NIGHT_IN_REMINDER", "NIGHT_OUT_REMINDER"] } },
        ],
        createdAt: { $gte: sevenDaysAgoDate }
      }).toArray().catch(() => []),
    ]);

    // Build set of admin/manager usernames or IDs to strictly exclude
    const nonEmployeeUsernames = new Set<string>();
    (usersRaw || []).forEach((u: any) => {
      const roleStr = String(u.role || '').toUpperCase();
      if (roleStr && roleStr !== 'EMPLOYEE') {
        if (u.username) nonEmployeeUsernames.add(String(u.username).toUpperCase());
        if (u.id) nonEmployeeUsernames.add(String(u.id).toUpperCase());
        if (u._id) nonEmployeeUsernames.add(String(u._id).toUpperCase());
        if (u.employeeId) nonEmployeeUsernames.add(String(u.employeeId).toUpperCase());
      }
    });

    const employees: Employee[] = (employeesRaw || [])
      .filter((e: any) => {
        const role = String(e.role || e.userRole || 'EMPLOYEE').toUpperCase();
        if (role !== 'EMPLOYEE') return false;
        const empCode = String(e.employeeId || e.id || '').toUpperCase();
        const username = String(e.username || '').toUpperCase();
        if (nonEmployeeUsernames.has(empCode) || nonEmployeeUsernames.has(username)) {
          return false;
        }
        return true;
      })
      .map((e: any) => ({
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
        const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const notifDoc = {
          id: notifId,
          notificationId: notifId,
          notification_id: notifId,
          employeeId: reminder.employeeId,
          employee_id: reminder.employeeId,
          loginId: reminder.loginId || reminder.employeeId,
          login_id: reminder.loginId || reminder.employeeId,
          title: reminder.title,
          message: reminder.message,
          timestamp: reminder.timestamp,
          notificationDateTime: reminder.timestamp,
          read: false,
          isRead: false,
          readStatus: 'UNREAD',
          read_status: 'UNREAD',
          readAt: null,
          opened_at: null,
          type: reminder.type,
          notificationType: reminder.type,
          notification_type: reminder.type,
          shift: reminder.shift,
          reminderType: reminder.reminderType,
          employeeName: reminder.employeeName,
          dedupeKey: reminder.dedupeKey,
          shiftDate: reminder.shiftDate,
          action: reminder.action,
          deepLink: reminder.deepLink,
          source: 'SYSTEM_SCHEDULER',
          createdBy: 'SYSTEM_SCHEDULER',
          created_by: 'SYSTEM_SCHEDULER',
          senderUser: 'SYSTEM_SCHEDULER',
          senderUserName: 'System Scheduler',
          scheduledAt: nowIso,
          scheduled_at: nowIso,
          sentAt: nowIso,
          sent_at: nowIso,
          deliveryStatus: 'PENDING',
          delivery_status: 'PENDING',
          pushSent: false,
          createdAt: new Date(),
          updatedAt: new Date(),
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
            notificationId: notifId,
            eventId: reminder.dedupeKey,
            shift: reminder.shift,
            shiftDate: reminder.shiftDate,
            deepLink: reminder.deepLink,
            data: {
              notificationType: reminder.type,
              reminderType: reminder.reminderType,
              action: reminder.action,
              employeeName: reminder.employeeName,
              loginId: reminder.loginId || reminder.employeeId,
              source: 'SYSTEM_SCHEDULER',
            },
          });

          // Update delivery status
          const isDelivered = pushRes.success && pushRes.successCount > 0;
          await db.collection("notifications").updateOne(
            { dedupeKey: reminder.dedupeKey },
            {
              $set: {
                pushSent: isDelivered,
                deliveryStatus: isDelivered ? 'DELIVERED' : 'SENT',
                delivery_status: isDelivered ? 'DELIVERED' : 'SENT',
                updatedAt: new Date(),
              },
            }
          ).catch(() => {});

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
