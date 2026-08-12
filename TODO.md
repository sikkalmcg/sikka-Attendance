# TODO: Multi-Session Attendance Report (Mark IN / Mark OUT multiple times per day)

## Goal
Support displaying and exporting **multiple Mark IN / Mark OUT sessions** for the same employee on the same date in the Attendance History Ledger report, with Day Total working hours.

## Steps
- [x] Explore codebase (reports UI, API route, data model)
- [x] Confirm plan with user
- [x] API route: replace merged punch logic with per-session logic (preserve all sessions)
- [x] API route: compute per-session working hours + Day Total row
- [x] API route: update CSV export to include Session column + Day Total
- [ ] UI page: add `session`/`isDayTotal` to LedgerRow type
- [ ] UI page: add Session column header + render Day Total row
- [ ] UI page: update exportReport columnOrder to include session
- [ ] UI page: update Print report to include Session column
- [ ] UI page: fix colSpan counts (loading/empty states)
- [ ] Update module README.md note
- [ ] Type-check / build the project to verify no errors
