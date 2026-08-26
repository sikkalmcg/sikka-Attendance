import { format, isSunday, subDays, parseISO, isValid } from "date-fns";
import type { AttendanceRecord, Employee, Holiday } from "@/lib/types";

export type EmployeeShift = 'DAY' | 'NIGHT';

/**
 * Get current time in Indian Standard Time (IST)
 */
export const getISTDate = (): Date => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};

/**
 * Extract time from inTime string or inDateTime
 * Expected formats: "HH:mm", "HH:mm:ss", or ISO string
 */
export const parseHourMinute = (timeStr: string | null | undefined): { hour: number; minute: number } | null => {
  if (!timeStr) return null;
  const clean = String(timeStr).trim();
  
  // Format: "HH:mm" or "HH:mm:ss"
  if (clean.includes(":")) {
    const parts = clean.split(":");
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    if (!isNaN(hour) && !isNaN(minute)) {
      return { hour, minute };
    }
  }

  // Format: ISO String
  try {
    const parsed = parseISO(clean);
    if (isValid(parsed)) {
      const ist = new Date(parsed.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      return { hour: ist.getHours(), minute: ist.getMinutes() };
    }
  } catch {}

  return null;
};

/**
 * Automatically identify employee's current shift based on their previous/latest valid attendance record.
 * Rule:
 * - If previous/latest valid record inTime is in evening/night window (>= 18:00 or < 05:00) -> NIGHT
 * - If previous/latest valid record inTime is in day window (05:00 to 17:59) -> DAY
 * - If no history exists -> default DAY
 */
export const determineEmployeeShift = (
  employeeAttendanceHistory: AttendanceRecord[]
): EmployeeShift => {
  if (!employeeAttendanceHistory || employeeAttendanceHistory.length === 0) {
    return 'DAY';
  }

  // Find valid records with a marked inTime, excluding system missing or absent placeholders
  const validRecords = employeeAttendanceHistory.filter((r) => {
    if (!r) return false;
    const isMissingPlaceholder = String(r.id || '').startsWith('missing-');
    const isAbsent = r.status === 'ABSENT' || String(r.remark || '').toLowerCase().includes('absent');
    return !isMissingPlaceholder && !isAbsent && Boolean(r.inTime || r.inDateTime);
  });

  if (validRecords.length === 0) {
    return 'DAY';
  }

  // Sort descending by date and inTime
  validRecords.sort((a, b) => {
    const dateComp = String(b.date || '').localeCompare(String(a.date || ''));
    if (dateComp !== 0) return dateComp;
    return String(b.inTime || '').localeCompare(String(a.inTime || ''));
  });

  const latestRecord = validRecords[0];
  const timeParsed = parseHourMinute(latestRecord.inTime || latestRecord.inDateTime);
  
  if (!timeParsed) {
    return 'DAY';
  }

  const { hour } = timeParsed;
  // Night shift: inTime starts from 18:00 (06:00 PM) onwards or before 05:00 AM
  if (hour >= 18 || hour < 5) {
    return 'NIGHT';
  }

  return 'DAY';
};

/**
 * Check whether a given date is a working day (not a holiday and not a Sunday)
 */
export const isWorkingDay = (dateStr: string, holidays: Holiday[] = []): boolean => {
  if (!dateStr) return false;
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return false;

    // Check Sunday (Weekly Off)
    if (isSunday(d)) {
      return false;
    }

    // Check Holidays collection
    const holidayMatch = (holidays || []).some((h) => h.date === dateStr);
    if (holidayMatch) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

export interface ShiftReminderNotificationItem {
  message: string;
  timestamp: string;
  read: boolean;
  type: 'SHIFT_REMINDER';
  shift: EmployeeShift;
  reminderType: 'MARK_IN' | 'MARK_OUT';
  employeeId: string;
  employeeName: string;
  dedupeKey: string;
}

/**
 * Evaluates shift reminder notifications for employees based on current IST time.
 */
export const evaluateShiftAttendanceReminders = (params: {
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  holidays: Holiday[];
  existingNotifications: Array<{ dedupeKey?: string; employeeId?: string; message?: string; timestamp?: string; type?: string }>;
  currentISTTime?: Date;
}): ShiftReminderNotificationItem[] => {
  const {
    employees = [],
    attendanceRecords = [],
    holidays = [],
    existingNotifications = [],
    currentISTTime = getISTDate(),
  } = params;

  const todayStr = format(currentISTTime, "yyyy-MM-dd");
  const yesterdayStr = format(subDays(currentISTTime, 1), "yyyy-MM-dd");
  const currentHour = currentISTTime.getHours();
  const currentMinute = currentISTTime.getMinutes();

  // Total minutes from midnight for easy comparison
  const currentTotalMinutes = currentHour * 60 + currentMinute;

  // Schedule thresholds (in minutes from midnight):
  // 10:00 AM = 600
  // 06:00 PM (18:00) = 1080
  // 08:00 PM (20:00) = 1200
  // 06:00 AM = 360
  const isAfter10AM = currentTotalMinutes >= 10 * 60;
  const isAfter06PM = currentTotalMinutes >= 18 * 60;
  const isAfter08PM = currentTotalMinutes >= 20 * 60;
  const isAfter06AM = currentTotalMinutes >= 6 * 60;

  const isTodayWorkingDay = isWorkingDay(todayStr, holidays);
  const isYesterdayWorkingDay = isWorkingDay(yesterdayStr, holidays);

  // Set of existing deduplication keys
  const existingDedupeKeys = new Set<string>();
  existingNotifications.forEach((n) => {
    if (n.dedupeKey) {
      existingDedupeKeys.add(n.dedupeKey);
    }
  });

  const remindersToCreate: ShiftReminderNotificationItem[] = [];

  employees.forEach((emp) => {
    if (emp.active === false) return;

    const empId = String(emp.employeeId || emp.id || (emp as any)._id || '').trim();
    if (!empId) return;

    const empFullName = emp.firstName
      ? `${emp.firstName} ${emp.lastName || ''}`.trim()
      : (emp.name || (emp as any).fullName || "Employee");

    // Match employee's attendance records by any identifier
    const empHistory = attendanceRecords.filter((r) => {
      if (!r) return false;
      const recEmpId = String(r.employeeId || '').trim().toUpperCase();
      const targetEmpId = empId.toUpperCase();
      const userIdent = String((emp as any).username || '').trim().toUpperCase();
      return recEmpId === targetEmpId || (userIdent && recEmpId === userIdent);
    });

    // 1. Determine shift
    const shift = determineEmployeeShift(empHistory);

    // 2. Find today's and yesterday's attendance records
    const todayRecord = empHistory.find((r) => r.date === todayStr && !String(r.id || '').startsWith('missing-'));
    const yesterdayRecord = empHistory.find((r) => r.date === yesterdayStr && !String(r.id || '').startsWith('missing-'));

    const hasMarkedInToday = Boolean(todayRecord && todayRecord.inTime);
    const hasMarkedOutToday = Boolean(
      todayRecord &&
      (todayRecord.outTime || todayRecord.status === 'Closed' || todayRecord.status === 'Auto OUT')
    );

    const nowFormatted = format(currentISTTime, "yyyy-MM-dd HH:mm:ss");

    // ==========================================
    // DAY SHIFT NOTIFICATIONS
    // ==========================================
    if (shift === 'DAY') {
      // Day Shift - 10:00 AM Mark IN Reminder
      if (isTodayWorkingDay && isAfter10AM) {
        const dedupeKey = `${empId}_${todayStr}_DAY_IN`;
        if (!hasMarkedInToday && !existingDedupeKeys.has(dedupeKey)) {
          remindersToCreate.push({
            message: `${empFullName} – Now how you are in working Please Mark IN your attendance.`,
            timestamp: nowFormatted,
            read: false,
            type: 'SHIFT_REMINDER',
            shift: 'DAY',
            reminderType: 'MARK_IN',
            employeeId: empId,
            employeeName: empFullName,
            dedupeKey,
          });
          existingDedupeKeys.add(dedupeKey);
        }
      }

      // Day Shift - 06:00 PM Mark OUT Reminder
      if (isTodayWorkingDay && isAfter06PM) {
        const dedupeKey = `${empId}_${todayStr}_DAY_OUT`;
        // Send if marked IN but has not marked OUT
        if (hasMarkedInToday && !hasMarkedOutToday && !existingDedupeKeys.has(dedupeKey)) {
          remindersToCreate.push({
            message: `${empFullName} – Hope you are now in working Please Mark Out before leave your work place.`,
            timestamp: nowFormatted,
            read: false,
            type: 'SHIFT_REMINDER',
            shift: 'DAY',
            reminderType: 'MARK_OUT',
            employeeId: empId,
            employeeName: empFullName,
            dedupeKey,
          });
          existingDedupeKeys.add(dedupeKey);
        }
      }
    }

    // ==========================================
    // NIGHT SHIFT NOTIFICATIONS
    // ==========================================
    if (shift === 'NIGHT') {
      // Night Shift - 08:00 PM Mark IN Reminder
      if (isTodayWorkingDay && isAfter08PM) {
        const dedupeKey = `${empId}_${todayStr}_NIGHT_IN`;
        if (!hasMarkedInToday && !existingDedupeKeys.has(dedupeKey)) {
          remindersToCreate.push({
            message: `${empFullName} – Now how you are in working Please Mark IN your attendance.`,
            timestamp: nowFormatted,
            read: false,
            type: 'SHIFT_REMINDER',
            shift: 'NIGHT',
            reminderType: 'MARK_IN',
            employeeId: empId,
            employeeName: empFullName,
            dedupeKey,
          });
          existingDedupeKeys.add(dedupeKey);
        }
      }

      // Night Shift - 06:00 AM (Next Day) Mark OUT Reminder
      // Check the open night shift started on previous evening (yesterday)
      if (isAfter06AM) {
        const dedupeKey = `${empId}_${yesterdayStr}_NIGHT_OUT`;
        const hasYesterdayNightIn = Boolean(yesterdayRecord && yesterdayRecord.inTime);
        const hasYesterdayNightOut = Boolean(
          yesterdayRecord &&
          (yesterdayRecord.outTime || yesterdayRecord.status === 'Closed' || yesterdayRecord.status === 'Auto OUT')
        );

        if (
          hasYesterdayNightIn &&
          !hasYesterdayNightOut &&
          !existingDedupeKeys.has(dedupeKey) &&
          isYesterdayWorkingDay
        ) {
          remindersToCreate.push({
            message: `${empFullName} – Hope you are now in working Please Mark Out before leave your work place.`,
            timestamp: nowFormatted,
            read: false,
            type: 'SHIFT_REMINDER',
            shift: 'NIGHT',
            reminderType: 'MARK_OUT',
            employeeId: empId,
            employeeName: empFullName,
            dedupeKey,
          });
          existingDedupeKeys.add(dedupeKey);
        }
      }
    }
  });

  return remindersToCreate;
};
