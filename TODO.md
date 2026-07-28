# Attendance History Ledger - Enhancement Plan

## Backend API Route (`src/app/api/reports/attendance-history-ledger/route.ts`)
- [x] **Step 1:** Load leaveRequests collection for the date range
- [x] **Step 2:** Build leave lookup map (employeeId:date → leave type/status)
- [x] **Step 3:** Extract outPlant from attendance punches
- [x] **Step 4:** Determine approvalStatus (Approved/Pending/Rejected)
- [x] **Step 5:** Determine approvedBy (username)
- [x] **Step 6:** Implement remarks logic (Leave Type, System Auto Out, Manual Entry, Out Not from Plant, Not In from Plant, blank)
- [x] **Step 7:** Add "Leave" attendance status logic
- [x] **Step 8:** Update CSV/Excel export headers and data

## Frontend Page (`src/app/dashboard/reports/attendance-history-ledger/page.tsx`)
- [x] **Step 9:** Update LedgerRow type with new fields
- [x] **Step 10:** Fix From Date default to 1st of previous month
- [x] **Step 11:** Update attendanceStatusOptions to include "Leave"
- [x] **Step 12:** Update table headers (remove Date, Shift Type, Processed By; add Out Plant, Approval Status, Approved By, Remarks)
- [x] **Step 13:** Update cell rendering with proper badges
- [x] **Step 14:** Update exportReport function
- [x] **Step 15:** Update print template
- [x] **Step 16:** Simplify export buttons (Download icon at top-right)

