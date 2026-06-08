# TODO

- [x] Update `src/app/dashboard/attendance/page.tsx` to fix Mark OUT UI not disappearing after successful markout.
  - [x] Add `isMutatingAttendance` guard state.
  - [x] In `handleConfirmCheckOut`, `await updateRecord(...)` and force `refreshData()` before clearing dialogs.
  - [x] In `performAutoCheckOut` / auto-out effect, ensure guard prevents re-trigger loops.
  - [x] Disable Mark IN/Mark OUT buttons while mutation is in progress.

- [x] Run dev/build checks (manual): ensure Mark OUT disappears immediately after success; Mark IN appears as per 8-hour credit.


