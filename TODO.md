# TODO

## Phase 1: Remove UI module: Leave Approvals
- [x] Identify Leave Approvals page: `src/app/dashboard/leave-approvals/page.tsx`
- [x] Remove “Leave Approvals” from dashboard sidebar navigation + permissions gating in `src/app/dashboard/layout.tsx`
- [ ] Remove route/page entry so direct access `/dashboard/leave-approvals` is blocked (rewrite to Access Denied or 404)
- [ ] Remove any remaining “leave approvals” references across the app (links/buttons/guards)

## Phase 2: Remove top bar activity notifications
- [x] Locate notification dropdown in `src/app/dashboard/layout.tsx` HeaderActions
- [x] Remove icon + dropdown/panel UI markup
- [ ] Remove unused notification state/logic + imports (optional cleanup)

## Phase 3: MongoDB connectivity investigation (separate)
- [x] Confirm DNS/SRV lookup fails from Node (`querySrv ECONNREFUSED`)
- [ ] Apply a code-side mitigation/logging (optional) OR wait for network/DNS fix from user

