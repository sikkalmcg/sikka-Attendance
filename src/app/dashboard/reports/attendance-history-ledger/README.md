Attendance History Ledger module

- API: /api/reports/attendance-history-ledger
- UI page: /dashboard/reports/attendance-history-ledger

Multiple Mark IN / Mark OUT Sessions:
- Every attendance punch document represents one Mark IN / Mark OUT session.
- All sessions for the same employee on the same date are preserved and displayed
  separately (NOT merged, overwritten, or hidden).
- Each session shows its own Mark IN Date & Time, Mark OUT Date & Time, and
  Session Working Hours.
- When a day has 2+ completed sessions, a "Day Total" row is appended showing the
  sum of all completed session working hours for that employee/date.
- If an employee has only one session, the report continues to display it in the
  existing format (no Day Total row is added).
- Incomplete sessions follow the existing attendance rules for status and
  working-hour calculation.

Export:
- CSV supported via export=true&format=csv (same multi-session logic applies).
- Exports all Mark IN/OUT sessions for an employee/date, including per-session
  working hours and the "Day Total Working Hours" row.

Print:
- print=true returns { meta, rows }
- UI renders print-friendly HTML including the Session column and Day Total rows.

Note: Excel/PDF export formats are pending refinement.
