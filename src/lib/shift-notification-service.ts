import { format, isSunday, subDays, parseISO, isValid } from "date-fns";
import type { AttendanceRecord, Employee, Holiday, LeaveRequest } from "@/lib/types";

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
 * Authoritative Shift Determination:
 * Identifies employee's applicable shift based on their previous valid attendance record.
 * Rule:
 * - If previous valid record inTime is in evening/night window (>= 18:00 or < 05:00) -> NIGHT
 * - If previous valid record inTime is in day window (05:00 to 17:59) -> DAY
 * - If no history exists -> default DAY
 */
export const determineEmployeeShift = (
  employeeAttendanceHistory: AttendanceRecord[]
): EmployeeShift => {
  if (!employeeAttendanceHistory || employeeAttendanceHistory.length === 0) {
    return 'DAY';
  }

  // Find valid records with a marked inTime, excluding placeholders and absences
  const validRecords = employeeAttendanceHistory.filter((r) => {
    if (!r) return false;
    const isMissingPlaceholder = String(r.id || '').startsWith('missing-');
    const isAbsent = r.status === 'ABSENT' || String(r.remark || '').toLowerCase().includes('absent');
    return !isMissingPlaceholder && !isAbsent && Boolean(r.inTime || r.inDateTime);
  });

  if (validRecords.length === 0) {
    return 'DAY';
  }

  // Sort descending by date and inTime (latest first)
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
  // Night shift: inTime is between 18:00 (06:00 PM) to 05:00 AM
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

/**
 * Check if employee is on an approved leave on a given date
 */
export const isEmployeeOnApprovedLeave = (
  employeeId: string,
  dateStr: string,
  leaveRequests: LeaveRequest[] = []
): boolean => {
  if (!employeeId || !dateStr || !leaveRequests || leaveRequests.length === 0) {
    return false;
  }

  const cleanEmpId = employeeId.trim().toUpperCase();

  return leaveRequests.some((lr) => {
    if (!lr) return false;
    const isApproved = String(lr.status || '').toUpperCase() === 'APPROVED';
    if (!isApproved) return false;

    const lrEmpId = String(lr.employeeId || '').trim().toUpperCase();
    if (lrEmpId !== cleanEmpId) return false;

    const fromDate = String(lr.fromDate || '').trim();
    const toDate = String(lr.toDate || lr.fromDate || '').trim();

    return dateStr >= fromDate && dateStr <= toDate;
  });
};

export interface ShiftReminderNotificationItem {
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'DAY_MARK_IN_REMINDER' | 'DAY_MARK_OUT_REMINDER' | 'NIGHT_MARK_IN_REMINDER' | 'NIGHT_MARK_OUT_REMINDER' | 'DAY_IN_REMINDER' | 'DAY_OUT_REMINDER' | 'NIGHT_IN_REMINDER' | 'NIGHT_OUT_REMINDER' | 'SHIFT_REMINDER';
  shift: EmployeeShift;
  reminderType: 'MARK_IN' | 'MARK_OUT';
  employeeId: string;
  loginId?: string;
  employeeName: string;
  dedupeKey: string;
  shiftDate: string;
  action: 'MARK_IN' | 'MARK_OUT';
  deepLink: string;
  source: 'SYSTEM_SCHEDULER';
}

/**
 * Evaluates shift reminder notifications for all active employees based on current IST time.
 * Covers:
 * 1. 10:00 AM IST - Day Shift Mark IN Reminder (Section 7)
 * 2. 06:00 PM IST - Day Shift Mark OUT Reminder (Section 8)
 * 3. 08:00 PM IST - Night Shift Mark IN Reminder (Section 9)
 * 4. 06:00 AM IST - Night Shift Mark OUT Reminder (Section 10)
 */
export const evaluateShiftAttendanceReminders = (params: {
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  holidays: Holiday[];
  leaveRequests?: LeaveRequest[];
  existingNotifications: Array<{ dedupeKey?: string; employeeId?: string; message?: string; timestamp?: string; type?: string }>;
  currentISTTime?: Date;
}): ShiftReminderNotificationItem[] => {
  const {
    employees = [],
    attendanceRecords = [],
    holidays = [],
    leaveRequests = [],
    existingNotifications = [],
    currentISTTime = getISTDate(),
  } = params;

  const todayStr = format(currentISTTime, "yyyy-MM-dd");
  const yesterdayStr = format(subDays(currentISTTime, 1), "yyyy-MM-dd");
  const currentHour = currentISTTime.getHours();
  const currentMinute = currentISTTime.getMinutes();

  // Total minutes from midnight for easy comparison
  const currentTotalMinutes = currentHour * 60 + currentMinute;

  // Schedule window thresholds (in minutes from midnight IST):
  // 1. 06:00 AM to 10:00 AM (360 to 599 min) -> Night Shift Mark OUT Reminder (previous night)
  // 2. 10:00 AM to 06:00 PM (600 to 1079 min) -> Day Shift Mark IN Reminder (today)
  // 3. 06:00 PM to 08:00 PM (1080 to 1199 min) -> Day Shift Mark OUT Reminder (today)
  // 4. 08:00 PM to 06:00 AM (>= 1200 or < 360 min) -> Night Shift Mark IN Reminder (tonight)
  const isDayInWindow = currentTotalMinutes >= 10 * 60 && currentTotalMinutes < 18 * 60;
  const isDayOutWindow = currentTotalMinutes >= 18 * 60 && currentTotalMinutes < 20 * 60;
  const isNightInWindow = currentTotalMinutes >= 20 * 60 || currentTotalMinutes < 6 * 60;
  const isNightOutWindow = currentTotalMinutes >= 6 * 60 && currentTotalMinutes < 10 * 60;

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
    // 1. Inactive Employee Check
    if (emp.active === false || (emp as any).status === 'Inactive') return;

    // 1.1 Strict Role Filter: Attendance Reminders are for Employees ONLY
    // Admin, Managers, HR, Super Admins, etc. must NEVER receive Attendance Reminders
    const rawRole = String((emp as any).role || (emp as any).userRole || (emp as any).roleName || 'EMPLOYEE').trim().toUpperCase();
    if (rawRole !== 'EMPLOYEE') {
      return;
    }

    const empId = String(emp.employeeId || emp.id || (emp as any)._id || '').trim();
    if (!empId) return;

    const loginId = String((emp as any).username || (emp as any).email || (emp as any).loginId || emp.employeeId || '').trim();

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

    // 2. Determine applicable shift (from previous attendance history - Section 6)
    const shift = determineEmployeeShift(empHistory);

    // 3. Find today's and yesterday's attendance records
    const todayRecord = empHistory.find((r) => r.date === todayStr && !String(r.id || '').startsWith('missing-'));
    const yesterdayRecord = empHistory.find((r) => r.date === yesterdayStr && !String(r.id || '').startsWith('missing-'));

    const hasMarkedInToday = Boolean(todayRecord && todayRecord.inTime);
    const hasMarkedOutToday = Boolean(
      todayRecord &&
      (todayRecord.outTime || todayRecord.status === 'Closed' || todayRecord.status === 'Auto OUT')
    );

    const isTodayOnLeave = isEmployeeOnApprovedLeave(empId, todayStr, leaveRequests);
    const isYesterdayOnLeave = isEmployeeOnApprovedLeave(empId, yesterdayStr, leaveRequests);

    const nowFormatted = format(currentISTTime, "yyyy-MM-dd HH:mm:ss");

    // ==========================================
    // DAY SHIFT NOTIFICATIONS (Section 7 & 8)
    // ==========================================
    if (shift === 'DAY') {
      // PART 3: Day Shift - 10:00 AM Mark IN Reminder (Section 7)
      // Condition: Current Date AND Day Shift AND Mark IN does NOT exist for today
      if (isTodayWorkingDay && !isTodayOnLeave && isDayInWindow) {
        const dedupeKey = `${empId}_${todayStr}_DAY_MARK_IN_REMINDER_10:00`;
        const legacyDedupeKey = `${empId}_${todayStr}_DAY_IN_REMINDER`;
        if (!hasMarkedInToday && !existingDedupeKeys.has(dedupeKey) && !existingDedupeKeys.has(legacyDedupeKey)) {
          remindersToCreate.push({
            title: "Attendance Reminder",
            message: "You have not marked IN today. Please Mark IN.",
            timestamp: nowFormatted,
            read: false,
            type: 'DAY_MARK_IN_REMINDER',
            shift: 'DAY',
            reminderType: 'MARK_IN',
            employeeId: empId,
            loginId,
            employeeName: empFullName,
            dedupeKey,
            shiftDate: todayStr,
            action: 'MARK_IN',
            deepLink: '/dashboard/attendance?action=mark_in',
            source: 'SYSTEM_SCHEDULER',
          });
          existingDedupeKeys.add(dedupeKey);
        }
      }

      // PART 4: Day Shift - 06:00 PM Mark OUT Reminder (Section 8)
      // Condition: Day Shift AND Today's Mark IN exists AND Today's Mark OUT does NOT exist
      if (isTodayWorkingDay && isDayOutWindow) {
        const dedupeKey = `${empId}_${todayStr}_DAY_MARK_OUT_REMINDER_18:00`;
        const legacyDedupeKey = `${empId}_${todayStr}_DAY_OUT_REMINDER`;
        // Send only if marked IN but has not marked OUT
        if (hasMarkedInToday && !hasMarkedOutToday && !existingDedupeKeys.has(dedupeKey) && !existingDedupeKeys.has(legacyDedupeKey)) {
          remindersToCreate.push({
            title: "Mark OUT Reminder",
            message: "You have marked IN today but have not marked OUT. Please Mark OUT.",
            timestamp: nowFormatted,
            read: false,
            type: 'DAY_MARK_OUT_REMINDER',
            shift: 'DAY',
            reminderType: 'MARK_OUT',
            employeeId: empId,
            loginId,
            employeeName: empFullName,
            dedupeKey,
            shiftDate: todayStr,
            action: 'MARK_OUT',
            deepLink: '/dashboard/attendance?action=mark_out',
            source: 'SYSTEM_SCHEDULER',
          });
          existingDedupeKeys.add(dedupeKey);
        }
      }
    }

    // ==========================================
    // NIGHT SHIFT NOTIFICATIONS (Section 9 & 10)
    // ==========================================
    if (shift === 'NIGHT') {
      // PART 5: Night Shift - 08:00 PM Mark IN Reminder (Section 9)
      // Condition: Night Shift AND applicable Mark IN does NOT exist
      if (isTodayWorkingDay && !isTodayOnLeave && isNightInWindow) {
        const dedupeKey = `${empId}_${todayStr}_NIGHT_MARK_IN_REMINDER_20:00`;
        const legacyDedupeKey = `${empId}_${todayStr}_NIGHT_IN_REMINDER`;
        if (!hasMarkedInToday && !existingDedupeKeys.has(dedupeKey) && !existingDedupeKeys.has(legacyDedupeKey)) {
          remindersToCreate.push({
            title: "Attendance Reminder",
            message: "Your Night Shift is starting. Please Mark IN.",
            timestamp: nowFormatted,
            read: false,
            type: 'NIGHT_MARK_IN_REMINDER',
            shift: 'NIGHT',
            reminderType: 'MARK_IN',
            employeeId: empId,
            loginId,
            employeeName: empFullName,
            dedupeKey,
            shiftDate: todayStr,
            action: 'MARK_IN',
            deepLink: '/dashboard/attendance?action=mark_in',
            source: 'SYSTEM_SCHEDULER',
          });
          existingDedupeKeys.add(dedupeKey);
        }
      }

      // PART 6: Night Shift - 06:00 AM (Next Day) Mark OUT Reminder (Section 10)
      // Condition: Night Shift AND Applicable Night Shift Mark IN exists (started yesterday) AND Mark OUT does NOT exist.
      // An employee who did not Mark IN must NOT receive the Night Shift Mark OUT notification.
      if (isNightOutWindow) {
        const dedupeKey = `${empId}_${yesterdayStr}_NIGHT_MARK_OUT_REMINDER_06:00`;
        const legacyDedupeKey = `${empId}_${yesterdayStr}_NIGHT_OUT_REMINDER`;
        const hasYesterdayNightIn = Boolean(yesterdayRecord && yesterdayRecord.inTime);
        const hasYesterdayNightOut = Boolean(
          yesterdayRecord &&
          (yesterdayRecord.outTime || yesterdayRecord.status === 'Closed' || yesterdayRecord.status === 'Auto OUT')
        );

        if (
          hasYesterdayNightIn &&
          !hasYesterdayNightOut &&
          !existingDedupeKeys.has(dedupeKey) &&
          !existingDedupeKeys.has(legacyDedupeKey) &&
          isYesterdayWorkingDay &&
          !isYesterdayOnLeave
        ) {
          remindersToCreate.push({
            title: "Mark OUT Reminder",
            message: "Your Night Shift attendance is active. Please Mark OUT.",
            timestamp: nowFormatted,
            read: false,
            type: 'NIGHT_MARK_OUT_REMINDER',
            shift: 'NIGHT',
            reminderType: 'MARK_OUT',
            employeeId: empId,
            loginId,
            employeeName: empFullName,
            dedupeKey,
            shiftDate: yesterdayStr,
            action: 'MARK_OUT',
            deepLink: '/dashboard/attendance?action=mark_out',
            source: 'SYSTEM_SCHEDULER',
          });
          existingDedupeKeys.add(dedupeKey);
        }
      }
    }
  });

  return remindersToCreate;
};
