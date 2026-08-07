# Facility Exits Tracking Enhancement - Implementation Plan

## Backend & Data Layer
- [x] **Step 1:** Add `ExitEvent`/`FacilityExitRecord` interface and `exitEvents`/`currentGeofenceStatus` to `types.ts`
- [x] **Step 2:** Rewrite `/api/exit-tracking/route.ts` to use MongoDB `getDb()` and store facility exit records per spec (POST + GET)
- [x] **Step 3:** Rewrite `/api/approvals/plant-exits/route.ts` to fetch from MongoDB `plantExits` collection

## Frontend - Attendance Page
- [x] **Step 4:** Enhance geofence tracker to store employee code, name, designation, plant, distance, tracking status
- [x] **Step 5:** Compute total out duration in HH:MM format and set trackingStatus (Outside Plant / Returned)
- [x] **Step 6:** Add periodic 15-30 min polling fallback and GPS-unavailable fallback

## Frontend - Approvals Page
- [x] **Step 7:** Update Facility Exits tab headers (Employee Name, Code, Designation, Plant, Date, Out Plant Time, In Plant Time, Out Duration, Distance KM, Out Location, Status, Action)
- [x] **Step 8:** Update View Location popup with all required fields
- [x] **Step 9:** Add View History action

## Verification
- [x] **Step 10:** Run typecheck/build to verify no errors (only pre-existing errors remain in unrelated files)
