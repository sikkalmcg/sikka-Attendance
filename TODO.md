- [x] Update `src/app/dashboard/attendance/page.tsx` Mark OUT auto trigger from 20h stale to 16h.
- [x] Update manual Mark OUT flow to set `nextInEnableTime` = manual `outDateTime` + 8h.
- [x] Update Mark IN eligibility/disabled logic to respect `nextInEnableTime` (next allowed time).
- [x] Ensure stored Auto Mark OUT time remains `inDateTime + 8h` and sets `autoOut` flags.
- [x] Run TypeScript checks / build and do manual validation of flows.




