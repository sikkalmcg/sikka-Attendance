# TODO

- [ ] Update Attendance page monthly summary to show **Worked Hours (HH:MM)** for employee self view.
  - [ ] Modify `monthlySummaries` in `src/app/dashboard/attendance/page.tsx` to compute total working minutes from `hours`.
  - [ ] Update Monthly Summary UI cards to display total worked hours.
- [x] Verify UI changes (code): Attendance page monthly summary now includes Worked Hours (HH:MM).
- [ ] Verify UI manually:
  - [ ] Log in as employee, open Attendance page.
  - [ ] Confirm each month card shows Present, Absent, and Worked Hours.
  - [ ] Mark IN/OUT and ensure totals update after refresh.

- [x] Implement 2-hour gating for Mark OUT on Attendance page
  - [x] Update `src/app/dashboard/attendance/page.tsx` to compute `canMarkOut` = now >= inDateTime + 2 hours
  - [x] Disable Mark OUT button when locked, and show message in bottom banner
  - [x] Ensure “Active Shift since …” section still displays for the open session
  - [ ] Verify no session-history duplicates for Mark IN (already handled by attendance upsert)



