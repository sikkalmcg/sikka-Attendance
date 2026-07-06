// Application constants
export const ITEMS_PER_PAGE = 15;
export const PROJECT_START_DATE_STR = "2026-04-01";

// Status constants
export const STATUS_FILTER_OPTIONS = [
  "ALL",
  "Present",
  "Absent on Leave",
  "Absent",
  "Weekly Off",
  "Holiday",
] as const;

export const LEAVE_STATUS_FILTER_OPTIONS = [
  "PENDING",
  "UNDER_PROCESS",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
] as const;

// Month names for parsing
export const MONTH_NAMES = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec"
] as const;

// Default approver name
export const DEFAULT_APPROVER_NAME = "HR_ADMIN";