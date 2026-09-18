import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

export function getServerNow() {
  return new Date();
}

/**
 * Format date to standard string in Asia/Kolkata timezone
 * e.g. "18-Sep-2026"
 */
export function formatKolkataDate(date) {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return formatInTimeZone(d, APP_TIMEZONE, 'dd-MMM-yyyy');
  } catch {
    return '-';
  }
}

/**
 * Format time to 24h string in Asia/Kolkata timezone
 * e.g. "18:30"
 */
export function formatKolkataTime(date) {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return formatInTimeZone(d, APP_TIMEZONE, 'HH:mm');
  } catch {
    return '-';
  }
}

/**
 * Format full datetime in Asia/Kolkata timezone — 24h format
 * e.g. "18-Sep-2026, 18:30"
 */
export function formatKolkataDateTime(date) {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return formatInTimeZone(d, APP_TIMEZONE, 'dd-MMM-yyyy, HH:mm');
  } catch {
    return '-';
  }
}

/**
 * Returns formatted working hours string from minutes
 * e.g., 480 -> "08:00"
 */
export function formatHoursHHMM(minutes) {
  if (!minutes || minutes <= 0) return '00:00';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Returns formatted working hours string from minutes
 * e.g., 615 -> "10:15 Hours" or "10 hrs 15 mins"
 */
export function formatWorkingHours(minutes) {
  if (!minutes || minutes <= 0) return '0:00 Hours';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  const padMins = mins < 10 ? `0${mins}` : mins;
  return `${hrs}:${padMins} Hours`;
}

/**
 * Today's date string in Asia/Kolkata (yyyy-MM-dd)
 */
export function getTodayDateString() {
  return formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Returns the UTC Date object representing IST midnight (00:00:00 IST)
 * of the calendar day AFTER the given IST date string (yyyy-MM-dd).
 * Used for next-Mark-IN eligibility: after a same-day session completes,
 * the employee can only Mark IN again on the next IST calendar day.
 *
 * Example: getISTMidnightAfterDate('2026-09-18')
 *   → 2026-09-18T18:30:00.000Z  (= 2026-09-19 00:00:00 IST)
 */
export function getISTMidnightAfterDate(istDateStr) {
  // Parse date parts
  const [year, month, day] = istDateStr.split('-').map(Number);
  // Next day midnight IST = yyyy-mm-(dd+1) 00:00:00 IST = subtract 5:30 for UTC
  // IST is UTC+5:30 = 330 minutes ahead
  const nextDayMidnightIST = new Date(
    Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0) - 330 * 60 * 1000
  );
  return nextDayMidnightIST;
}

/**
 * Extracts normalized yyyy-MM-dd date string in Asia/Kolkata timezone from an attendance record
 */
export function getAttendanceDateString(record) {
  if (!record) return '';
  if (record.attendanceDate && /^\d{4}-\d{2}-\d{2}$/.test(record.attendanceDate)) {
    return record.attendanceDate;
  }
  if (record.inDate && /^\d{4}-\d{2}-\d{2}$/.test(record.inDate)) {
    return record.inDate;
  }
  if (record.date && /^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
    return record.date;
  }
  const d = record.markInAt || record.inDateTime || record.createdAt;
  if (d) {
    try {
      return formatInTimeZone(new Date(d), APP_TIMEZONE, 'yyyy-MM-dd');
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * Masks Aadhaar number for security and privacy: "XXXX XXXX 1234"
 */
export function maskAadhaar(aadhaar) {
  if (!aadhaar || typeof aadhaar !== 'string') return '-';
  const clean = aadhaar.replace(/\s+/g, '');
  if (clean.length < 4) return 'XXXX XXXX XXXX';
  const last4 = clean.slice(-4);
  return `XXXX XXXX ${last4}`;
}

/**
 * Yesterday's date string in Asia/Kolkata (yyyy-MM-dd)
 */
export function getYesterdayDateString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatInTimeZone(d, APP_TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Parse a datetime string entered in Asia/Kolkata timezone to a Date object.
 * Strictly binds times without timezone offsets to Asia/Kolkata (+05:30).
 */
export function parseKolkataDateTime(input) {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  let str = String(input).trim();
  if (!str) return null;

  // If format is bare YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    str = `${str}T00:00:00+05:30`;
  }
  // If format is YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm without offset
  else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(str)) {
    str = str.replace(' ', 'T');
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str)) {
      str = `${str}:00`;
    }
    str = `${str}+05:30`;
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Returns formatted string for datetime-local inputs in Asia/Kolkata timezone
 * e.g. "2026-09-18T13:30"
 */
export function toKolkataDateTimeLocal(date = new Date()) {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? parseKolkataDateTime(date) : date;
    if (!d || isNaN(d.getTime())) return '';
    return formatInTimeZone(d, APP_TIMEZONE, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return '';
  }
}

/**
 * Checks if a date or datetime string is in the future according to trusted India server time.
 * A 30-second grace buffer is allowed for submission latency.
 */
export function isFutureKolkataDateTime(input) {
  if (!input) return false;
  const d = parseKolkataDateTime(input);
  if (!d) return false;
  const now = new Date();
  return d.getTime() > now.getTime() + 30000;
}

/**
 * Checks if a date string (YYYY-MM-DD), datetime string, or Date object
 * is strictly in the future in Asia/Kolkata timezone.
 */
export function isFutureKolkataDate(input) {
  if (!input) return false;
  let dateStr = '';
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return false;
    dateStr = formatInTimeZone(input, APP_TIMEZONE, 'yyyy-MM-dd');
  } else if (typeof input === 'string') {
    const trimmed = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      dateStr = trimmed;
    } else {
      const parsed = parseKolkataDateTime(trimmed);
      if (parsed) {
        dateStr = formatInTimeZone(parsed, APP_TIMEZONE, 'yyyy-MM-dd');
      }
    }
  }
  if (!dateStr) return false;
  const today = getTodayDateString();
  return dateStr > today;
}

