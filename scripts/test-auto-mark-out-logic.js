import assert from 'assert';
import connectToDatabase from '../lib/mongodb.js';
import Attendance from '../models/Attendance.js';
import { processAutoMarkOut } from '../lib/autoMarkOut.js';
import { normalizeAttendance } from '../lib/normalize.js';
import { formatKolkataDateTime, formatWorkingHours, calculateWorkingMinutes } from '../lib/timezone.js';

async function runTests() {
  await connectToDatabase();
  console.log('=== RUNNING AUTO MARK OUT LOGIC TESTS ===\n');

  const testEmpId = 'EMP-AUTO-OUT-TEST-USER';
  await Attendance.deleteMany({ employeeId: testEmpId });

  // -------------------------------------------------------------
  // Test 1: User's Example
  // Mark In: 27-Aug-2026 07:00
  // 18-hour limit: 28-Aug-2026 01:00
  // After 18 hours (e.g. simulated check when > 18h has passed):
  // Saved Mark Out Date Time = Mark In Date Time + 8 hours = 27-Aug-2026 15:00
  // Auto-Out Trigger Time = 28-Aug-2026 01:00
  // Mark Out Type = Auto-Out
  // Working Hours = 8:00 (480 minutes)
  // -------------------------------------------------------------
  console.log('--- TEST 1: User Example Verification ---');
  const markInTime = new Date('2026-08-27T07:00:00+05:30');
  const session1 = await Attendance.create({
    employeeId: testEmpId,
    employeeName: 'Ramesh Patel',
    markInAt: markInTime,
    markInPlantName: 'Main Plant',
    status: 'ACTIVE',
  });

  const autoResult = await processAutoMarkOut(true);
  assert(autoResult.affectedIds.includes(session1._id.toString()), 'Session must be auto marked out');

  const refreshed1 = await Attendance.findById(session1._id).lean();
  const norm1 = normalizeAttendance(refreshed1);

  console.log('Mark In Date Time:', formatKolkataDateTime(norm1.markInAt));
  console.log('Auto-Out Trigger Time:', formatKolkataDateTime(refreshed1.autoOutTriggerTime));
  console.log('Mark Out Date Time:', formatKolkataDateTime(norm1.markOutAt));
  console.log('Mark Out Type:', refreshed1.markOutType);
  console.log('Mark Out Plant Name:', norm1.markOutPlantName);
  console.log('Working Minutes:', norm1.workingMinutes);
  console.log('Working Hours:', formatWorkingHours(norm1.workingMinutes));
  console.log('Status:', refreshed1.status);

  // Exact asserts
  const expectedTriggerTime = new Date(markInTime.getTime() + 18 * 60 * 60 * 1000);
  const expectedMarkOutTime = new Date(markInTime.getTime() + 8 * 60 * 60 * 1000);

  assert.strictEqual(new Date(refreshed1.autoOutTriggerTime).getTime(), expectedTriggerTime.getTime(), 'Auto-Out Trigger Time must be 28-Aug-2026 01:00');
  assert.strictEqual(new Date(norm1.markOutAt).getTime(), expectedMarkOutTime.getTime(), 'Mark Out Date Time must be 27-Aug-2026 15:00');
  assert.strictEqual(refreshed1.markOutType, 'Auto-Out', 'Mark Out Type must be Auto-Out');
  assert.strictEqual(norm1.markOutPlantName, 'Auto-Out', 'Mark Out Plant must be Auto-Out');
  assert.strictEqual(norm1.workingMinutes, 480, 'Working minutes must be 480 (8 hours)');
  assert.strictEqual(formatWorkingHours(norm1.workingMinutes), '08:00 Hours', 'Working Hours must be 08:00 Hours (8:00)');
  assert.strictEqual(refreshed1.status, 'AUTO_COMPLETED', 'Status must be AUTO_COMPLETED');
  console.log('✅ PASS: Test 1 User Example successfully verified!\n');

  // -------------------------------------------------------------
  // Test 2: Active Session under 18 hours (< 18 hours elapsed)
  // Must NOT be auto marked out!
  // -------------------------------------------------------------
  console.log('--- TEST 2: Active session under 18 hours (no auto mark out) ---');
  const recentIn = new Date(Date.now() - 5 * 60 * 60 * 1000); // 5 hours ago
  const sessionRecent = await Attendance.create({
    employeeId: testEmpId,
    employeeName: 'Ramesh Patel',
    markInAt: recentIn,
    markInPlantName: 'Main Plant',
    status: 'ACTIVE',
  });

  const recentResult = await processAutoMarkOut(true);
  assert(!recentResult.affectedIds.includes(sessionRecent._id.toString()), 'Session under 18h must NOT be auto marked out');
  const refreshedRecent = await Attendance.findById(sessionRecent._id).lean();
  assert.strictEqual(refreshedRecent.status, 'ACTIVE', 'Status must still be ACTIVE');
  assert.strictEqual(refreshedRecent.markOutAt, null, 'markOutAt must still be null');
  console.log('✅ PASS: Active session under 18 hours was not touched!\n');

  // -------------------------------------------------------------
  // Test 3: Important Edge Case - Manual Mark Out before 18 hours
  // Employee manually marks out at 28-Aug-2026 00:59 (17h 59m).
  // Mark Out Date Time = 28-Aug-2026 00:59
  // Mark Out Type = Self
  // No Auto-Out
  // Do not overwrite employee's manual Mark Out!
  // -------------------------------------------------------------
  console.log('--- TEST 3: Edge Case - Manual Mark Out at 28-Aug-2026 00:59 ---');
  const manualMarkIn = new Date('2026-08-27T07:00:00+05:30');
  const manualMarkOut = new Date('2026-08-28T00:59:00+05:30');
  const manualWorkingMinutes = calculateWorkingMinutes(manualMarkIn, manualMarkOut);

  const manualSession = await Attendance.create({
    employeeId: testEmpId,
    employeeName: 'Ramesh Patel',
    markInAt: manualMarkIn,
    markOutAt: manualMarkOut,
    markOutType: 'Self',
    status: 'COMPLETED',
    workingMinutes: manualWorkingMinutes,
  });

  // Run auto mark-out processor
  const edgeResult = await processAutoMarkOut(true);
  assert(!edgeResult.affectedIds.includes(manualSession._id.toString()), 'Manual session must NOT be processed by auto mark out');

  const refreshedManual = await Attendance.findById(manualSession._id).lean();
  const normManual = normalizeAttendance(refreshedManual);

  console.log('Manual Mark In:', formatKolkataDateTime(normManual.markInAt));
  console.log('Manual Mark Out:', formatKolkataDateTime(normManual.markOutAt));
  console.log('Manual Mark Out Type:', refreshedManual.markOutType);
  console.log('Working Minutes:', normManual.workingMinutes);
  console.log('Working Hours:', formatWorkingHours(normManual.workingMinutes));

  assert.strictEqual(new Date(refreshedManual.markOutAt).getTime(), manualMarkOut.getTime(), 'Manual Mark Out time preserved');
  assert.strictEqual(refreshedManual.markOutType, 'Self', 'Mark Out Type remains Self');
  assert.strictEqual(refreshedManual.status, 'COMPLETED', 'Status remains COMPLETED');
  assert.strictEqual(refreshedManual.autoMarkOut, false, 'autoMarkOut remains false');
  console.log('✅ PASS: Edge Case preserved manual mark-out exactly!\n');

  // Cleanup test records
  await Attendance.deleteMany({ employeeId: testEmpId });

  console.log('========================================================');
  console.log('🎉 ALL AUTO MARK OUT TESTS PASSED WITH 100% SUCCESS!');
  console.log('========================================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
