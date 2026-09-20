import assert from 'assert';
import mongoose from 'mongoose';
import connectToDatabase from '../lib/mongodb.js';
import Attendance from '../models/Attendance.js';
import {
  calculateWorkingMinutes,
  formatWorkingHours,
  formatKolkataDateTime,
  parseKolkataDateTime,
  getRecordMarkInDateTime,
  getRecordMarkOutDateTime,
} from '../lib/timezone.js';
import { normalizeAttendance } from '../lib/normalize.js';
import { processAutoMarkOut } from '../lib/autoMarkOut.js';

async function runTests() {
  await connectToDatabase();
  console.log('=== RUNNING COMPREHENSIVE ATTENDANCE & WORKING HOURS VERIFICATION ===\n');

  // TEST 1: EMP-S00015 Verification
  console.log('--- TEST 1: EMP-S00015 Verification ---');
  const emp15 = await Attendance.findOne({
    employeeId: 'EMP-S00015',
    inDate: '2026-09-18',
  }).lean();
  assert(emp15, 'EMP-S00015 record found');
  const norm15 = normalizeAttendance(emp15);
  console.log('Employee ID:', norm15.employeeId);
  console.log('Mark In:', formatKolkataDateTime(norm15.markInAt));
  console.log('Mark Out:', formatKolkataDateTime(norm15.markOutAt));
  console.log('Working Minutes:', norm15.workingMinutes);
  console.log('Working Hours Display:', formatWorkingHours(norm15.workingMinutes));
  assert.strictEqual(formatWorkingHours(norm15.workingMinutes), '24:08 Hours', 'EMP-S00015 must be 24:08 Hours');
  console.log('✅ PASS: EMP-S00015 displays exactly 24:08 Hours!\n');

  // TEST 2: Duration calculation cross-midnight, same day, multi-day
  console.log('--- TEST 2: Working Hours Duration Logic ---');
  // Same day: 18-Sep 10:03 -> 18-Sep 18:03 = 08:00 Hours
  const sameDayIn = parseKolkataDateTime('2026-09-18T10:03:00');
  const sameDayOut = parseKolkataDateTime('2026-09-18T18:03:00');
  const sameDayMins = calculateWorkingMinutes(sameDayIn, sameDayOut);
  console.log(`Same day: ${formatWorkingHours(sameDayMins)} (Expected: 08:00 Hours)`);
  assert.strictEqual(formatWorkingHours(sameDayMins), '08:00 Hours');

  // Next day: 18-Sep 10:03 -> 19-Sep 10:11 = 24:08 Hours
  const nextDayIn = parseKolkataDateTime('2026-09-18T10:03:00');
  const nextDayOut = parseKolkataDateTime('2026-09-19T10:11:00');
  const nextDayMins = calculateWorkingMinutes(nextDayIn, nextDayOut);
  console.log(`Next day: ${formatWorkingHours(nextDayMins)} (Expected: 24:08 Hours)`);
  assert.strictEqual(formatWorkingHours(nextDayMins), '24:08 Hours');

  // Multi day: 18-Sep 10:03 -> 20-Sep 10:03 = 48:00 Hours
  const multiDayIn = parseKolkataDateTime('2026-09-18T10:03:00');
  const multiDayOut = parseKolkataDateTime('2026-09-20T10:03:00');
  const multiDayMins = calculateWorkingMinutes(multiDayIn, multiDayOut);
  console.log(`Multi day: ${formatWorkingHours(multiDayMins)} (Expected: 48:00 Hours)`);
  assert.strictEqual(formatWorkingHours(multiDayMins), '48:00 Hours');

  // Night shift: 18-Sep 22:00 -> 19-Sep 06:30 = 08:30 Hours
  const nightIn = parseKolkataDateTime('2026-09-18T22:00:00');
  const nightOut = parseKolkataDateTime('2026-09-19T06:30:00');
  const nightMins = calculateWorkingMinutes(nightIn, nightOut);
  console.log(`Night shift: ${formatWorkingHours(nightMins)} (Expected: 08:30 Hours)`);
  assert.strictEqual(formatWorkingHours(nightMins), '08:30 Hours');
  console.log('✅ PASS: Working hours calculation across all spans verified!\n');

  // TEST 3: Rule 1 & Rule 9 - 18-Hour Auto Mark-Out
  console.log('--- TEST 3: Rule 1 & 9 - 18-Hour Auto Mark-Out ---');
  const testEmpId = 'EMP-TEST-AUTO18';
  await Attendance.deleteMany({ employeeId: testEmpId });

  // Create an active session from 19 hours ago
  const inTime19hAgo = new Date(Date.now() - 19 * 60 * 60 * 1000);
  const testActive = await Attendance.create({
    employeeId: testEmpId,
    employeeName: 'Auto Out Test User',
    markInAt: inTime19hAgo,
    markInPlantName: 'Tea Plant',
    status: 'ACTIVE',
  });

  // Run auto mark-out processor
  const autoResult = await processAutoMarkOut(true);
  console.log(`Auto mark out processed count: ${autoResult.processedCount}`);
  assert(autoResult.affectedIds.includes(testActive._id.toString()), 'Test session must be auto marked out');

  const refreshed = await Attendance.findById(testActive._id).lean();
  const normAuto = normalizeAttendance(refreshed);

  console.log('Auto Mark Out Date Time:', formatKolkataDateTime(normAuto.markOutAt));
  console.log('Auto Mark Out Plant:', normAuto.markOutPlantName);
  console.log('Auto Mark Out Type in DB:', refreshed.markOutType);
  console.log('Auto Working Hours:', formatWorkingHours(normAuto.workingMinutes));

  assert.strictEqual(normAuto.markOutPlantName, 'Auto-Out', 'Mark OUT Plant must be Auto-Out');
  assert.strictEqual(refreshed.markOutType, 'Auto-Out', 'Stored Mark OUT Type in DB must be Auto-Out');
  assert.strictEqual(normAuto.workingMinutes, 18 * 60, 'Working minutes must be 1080 (18 hours)');
  assert.strictEqual(formatWorkingHours(normAuto.workingMinutes), '18:00 Hours', 'Working Hours must be 18:00 Hours');
  console.log('✅ PASS: 18-Hour Auto Mark-Out verified!\n');

  // TEST 4: Rule 4 - Mark IN Plant Display (Inside vs Outside WFM / Field Work)
  console.log('--- TEST 4: Rule 4 - Mark IN Plant Display ---');
  const normInside = normalizeAttendance({
    markInLocationType: 'PLANT',
    markInPlantName: 'Tea Plant',
    markInAt: new Date(),
    status: 'ACTIVE',
  });
  console.log('Inside Plant Mark IN:', normInside.markInPlantName);
  assert.strictEqual(normInside.markInPlantName, 'Tea Plant');

  const normWFM = normalizeAttendance({
    markInLocationType: 'WORK_FROM_HOME',
    markInAt: new Date(),
    status: 'ACTIVE',
  });
  console.log('WFM Mark IN:', normWFM.markInPlantName);
  assert.strictEqual(normWFM.markInPlantName, 'Outside Plant - WFM');

  const normField = normalizeAttendance({
    markInLocationType: 'FIELD_WORK',
    markInAt: new Date(),
    status: 'ACTIVE',
  });
  console.log('Field Work Mark IN:', normField.markInPlantName);
  assert.strictEqual(normField.markInPlantName, 'Outside Plant - Field Work');
  console.log('✅ PASS: Mark IN Plant detection and display verified!\n');

  // TEST 5: Rule 5 - Active Session Displays 'Under Process' and 'Pending'
  console.log('--- TEST 5: Rule 5 - Active Session Display ---');
  const normActive = normalizeAttendance({
    markInLocationType: 'PLANT',
    markInPlantName: 'Tea Plant',
    markInAt: new Date(),
    status: 'ACTIVE',
  });
  console.log('Active Mark OUT Plant:', normActive.markOutPlantName);
  console.log('Active Mark OUT Type:', normActive.markOutType);
  assert.strictEqual(normActive.markOutPlantName, 'Under Process');
  assert.strictEqual(normActive.markOutType, '-');
  console.log('✅ PASS: Active session shows Under Process!\n');

  // TEST 6: Rule 6 - Manual Mark OUT Outside Plant
  console.log('--- TEST 6: Rule 6 - Manual Mark OUT Outside Plant ---');
  const normOutsideOut = normalizeAttendance({
    markInAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    markOutAt: new Date(),
    markOutWithinPlantRadius: false,
    markOutPlantName: 'Outside-Out',
    markOutType: 'Manual Mark-Out',
    status: 'COMPLETED',
  });
  console.log('Manual OUT outside plant name:', normOutsideOut.markOutPlantName);
  console.log('Manual OUT outside type:', normOutsideOut.markOutType);
  assert.strictEqual(normOutsideOut.markOutPlantName, 'Outside-Out');
  assert(['MANUAL', 'Manual Mark-Out'].includes(normOutsideOut.markOutType), 'Mark OUT Type must be MANUAL or Manual Mark-Out');
  console.log('✅ PASS: Manual OUT outside plant displays Outside-Out!\n');

  // Cleanup test record
  await Attendance.deleteMany({ employeeId: testEmpId });

  console.log('===========================================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  console.log('===========================================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
