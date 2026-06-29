# TODO - Attendance Ledger search dropdown

- [ ] Update Attendance History Ledger UI to provide employee dropdown (scrollable list) similar to Reports screen.
  - Selected behavior: dropdown shows Employee Name and sets `search` to employee `name` (as user requested).

  - [ ] Create memo list of employees allowed to user (allowedEmployees).
  - [ ] Replace/free-text search with searchable Select/Combobox OR add Select dropdown below search.
  - [ ] On select, set `search` value to chosen employeeId (or name) so backend returns correct rows.
  - [ ] Keep existing `employeeId exact` filter as-is (optional).
- [ ] Test: open Attendance History Ledger page.
  - [ ] Dropdown me employee select -> data loads.
  - [ ] Department/designation filters + dropdown together still work.

