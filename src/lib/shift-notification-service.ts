import { format, isSunday, subDays, parseISO, isValid } from "date-fns";
import type { AttendanceRecord, Employee, Holiday, LeaveRequest } from "@/lib/types";
import { getTranslation, Language } from "@/lib/translations";

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
  workingDate: string;
  language: 'en' | 'hi';
  action: 'MARK_IN' | 'MARK_OUT';
  deepLink: string;
  source: 'SYSTEM_SCHEDULER';
}

/**
 * Evaluates shift reminder notifications for active employees.
 * (Attendance reminder notifications disabled per configuration)
 */
export const evaluateShiftAttendanceReminders = (_params?: {
  employees?: Employee[];
  attendanceRecords?: AttendanceRecord[];
  holidays?: Holiday[];
  leaveRequests?: LeaveRequest[];
  existingNotifications?: Array<{ dedupeKey?: string; employeeId?: string; message?: string; timestamp?: string; type?: string }>;
  currentISTTime?: Date;
}): ShiftReminderNotificationItem[] => {
  return [];
};
