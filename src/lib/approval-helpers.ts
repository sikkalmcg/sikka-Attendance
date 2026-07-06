import { parseISO, format, addHours, isValid, differenceInCalendarDays } from "date-fns";
import { formatHoursToHHMM } from "./utils";

// Type for attendance record ID resolution
export type RecordId = string | undefined;

// Helper to get record ID consistently
export function getRecordId(rec: { id?: string; _id?: string; employeeId: string; date: string }): string {
  return rec.id || rec._id || `${rec.employeeId}:${rec.date}`;
}

// Helper to calculate auto-checkout values
export function calculateAutoCheckout(
  inDate: string | undefined,
  inTime: string | null | undefined,
  outTime: string | null | undefined,
  hours: number | undefined
): { finalOutTime: string | null; finalOutDate: string | null; finalHours: number } {
  let finalOutTime: string | null = outTime ?? null;
  let finalOutDate: string | null = inDate ?? null;
  let finalHours = hours || 0;

  if (!outTime && inTime) {
    const inDT = parseISO(`${inDate || "" }T${inTime}:00`);
    if (inDT && isValid(inDT)) {
      const autoOutDT = addHours(inDT, 16);
      finalOutTime = format(autoOutDT, "HH:mm");
      finalOutDate = format(autoOutDT, "yyyy-MM-dd");
      finalHours = 16.0;
    }
  }

  return { finalOutTime, finalOutDate, finalHours };
}

// Helper to get final remarks
export function getFinalRemarks(
  autoCheckout: boolean | undefined,
  remark: string | null | undefined
): string | null {
  if (autoCheckout && !remark) {
    return "System Auto-Logged OUT (16h Limit Threshold reached)";
  }
  return remark ?? null;
}

// Helper to calculate days between dates
export function calculateDays(fromDate: string, toDate: string): number {
  if (!fromDate || !toDate) return 0;
  return differenceInCalendarDays(new Date(toDate), new Date(fromDate)) + 1;
}

// Helper to format location display
export function formatLocationDisplay(
  address: string | undefined,
  lat: number | undefined,
  lng: number | undefined
): string {
  if (address && address !== "Location Not Available" && address.trim() !== "") {
    const isCoordinateString = /^-?\d+\.\d+, -?\d+\.\d+$/.test(address);
    if (!isCoordinateString) return address;
  }
  if (lat !== undefined && lng !== undefined && lat !== 0 && lng !== 0) {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
  return address || "Location Not Available";
}

// Helper to check if record can be approved
export function canApproveRecord(rec: {
  isVirtual?: boolean;
  inTime?: string | null;
  outTime?: string | null;
  autoCheckout?: boolean;
}): boolean {
  return Boolean(rec.isVirtual || (rec.inTime && (rec.outTime || rec.autoCheckout)));
}

// Helper to format out time display
export function formatOutTimeDisplay(
  outTime: string | null | undefined,
  outDate: string | undefined,
  date: string,
  inTime: string | null | undefined,
  autoCheckout: boolean | undefined
): string {
  if (outTime) {
    return `${formatDate(outDate || date)} ${outTime}`;
  }
  if (autoCheckout && inTime) {
    const inDT = parseISO(`${outDate || date}T${inTime}:00`);
    if (inDT && isValid(inDT)) {
      const autoOutDT = addHours(inDT, 16);
      return `${formatDate(format(autoOutDT, "yyyy-MM-dd"))} ${format(autoOutDT, "HH:mm")}`;
    }
  }
  return "--";
}

// Re-export formatDate for use in helpers
import { formatDate } from "./utils";