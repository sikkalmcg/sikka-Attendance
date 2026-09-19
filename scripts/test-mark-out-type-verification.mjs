import mongoose from 'mongoose';
import connectToDatabase from '../lib/mongodb.js';
import Attendance from '../models/Attendance.js';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import { normalizeAttendance } from '../lib/normalize.js';
import { getAuthoritativeUser } from '../lib/auth.js';

async function runTests() {
  console.log('=== STARTING MARK OUT TYPE VERIFICATION TESTS ===\n');
  await connectToDatabase();

  let testPassed = 0;
  let testFailed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      testPassed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      testFailed++;
    }
  }

  // Helper matching the Approval page formatting function
  const getMarkOutTypeDisplay = (record) => {
    const isAbsent = record.status === 'ABSENT' || (!record.markInAt && !record.markOutAt);
    if (isAbsent || !record.markOutAt) {
      return '-';
    }

    const rawType = String(record.markOutType || '').toUpperCase().trim();
    const isAuto =
      rawType === 'AUTO_OUT' ||
      rawType === 'AUTO' ||
      Boolean(record.autoMarkOut) ||
      record.status === 'AUTO_COMPLETED';

    if (isAuto) {
      return 'Auto-Out';
    }

    const isManual =
      rawType === 'MANUAL' ||
      Boolean(record.markOutByUserName) ||
      Boolean(record.markOutManualBy);

    if (isManual) {
      const userFullName =
        record.markOutByUserName ||
        record.markOutManualBy ||
        record.manualAttendanceBy ||
        record.editedBy ||
        'Admin';
      return `Manual - ${userFullName}`;
    }

    return 'Self';
  };

  // --- Test 1: Authoritative User Resolution ---
  console.log('\n--- 1. Testing getAuthoritativeUser ---');
  // Find or create test user
  let testUser = await User.findOne({ username: 'test_markout_admin' });
  if (!testUser) {
    testUser = await User.create({
      userId: 'USR_TEST_001',
      fullName: 'Rahul Sharma',
      username: 'test_markout_admin',
      passwordHash: 'dummyhash',
      role: 'Admin',
      permissions: ['approval', 'dashboard'],
      status: 'Active',
    });
  }

  const sessionMock = {
    sub: testUser._id.toString(),
    userId: testUser.userId,
    username: testUser.username,
    fullName: 'Rahul Sharma',
    role: 'Admin',
    userType: 'SYSTEM_USER',
  };

  const resolved = await getAuthoritativeUser(sessionMock);
  assert(resolved.userFullName === 'Rahul Sharma', `getAuthoritativeUser returns full name: ${resolved.userFullName}`);
  assert(resolved.authUserId === 'USR_TEST_001', `getAuthoritativeUser returns authUserId: ${resolved.authUserId}`);

  // Test session with only username but matching User in DB
  const sessionWithoutFullName = {
    sub: testUser._id.toString(),
    username: 'test_markout_admin',
  };
  const resolved2 = await getAuthoritativeUser(sessionWithoutFullName);
  assert(resolved2.userFullName === 'Rahul Sharma', `Authoritative DB lookup finds full name even when session lacks it: ${resolved2.userFullName}`);

  // --- Test 2: Self Mark Out ---
  console.log('\n--- 2. Testing Self Mark Out ---');
  const selfRecord = {
    employeeId: 'EMP_SELF_01',
    employeeName: 'Ajay Kumar',
    markInAt: new Date('2026-09-19T10:00:00Z'),
    markOutAt: new Date('2026-09-19T18:32:00Z'),
    markOutType: 'SELF',
    markOutByUserId: null,
    markOutByUserName: null,
    status: 'COMPLETED',
    workingMinutes: 512,
  };
  const normSelf = normalizeAttendance(selfRecord);
  assert(normSelf.markOutType === 'SELF', `Normalized markOutType is SELF`);
  const selfDisplay = getMarkOutTypeDisplay(normSelf);
  assert(selfDisplay === 'Self', `Display value is exactly 'Self' (got: '${selfDisplay}')`);

  // --- Test 3: System Auto Mark Out ---
  console.log('\n--- 3. Testing System Auto Mark Out ---');
  const autoRecord = {
    employeeId: 'EMP_AUTO_01',
    employeeName: 'Ajay Kumar',
    markInAt: new Date('2026-09-19T08:00:00Z'),
    markOutAt: new Date('2026-09-20T02:15:00Z'),
    markOutType: 'AUTO_OUT',
    autoMarkOut: true,
    status: 'AUTO_COMPLETED',
    workingMinutes: 480,
    markOutByUserId: null,
    markOutByUserName: null,
  };
  const normAuto = normalizeAttendance(autoRecord);
  assert(normAuto.markOutType === 'AUTO_OUT', `Normalized markOutType is AUTO_OUT`);
  const autoDisplay = getMarkOutTypeDisplay(normAuto);
  assert(autoDisplay === 'Auto-Out', `Display value is exactly 'Auto-Out' (got: '${autoDisplay}')`);

  // Legacy auto mark out document test (with outType: 'auto' or autoCheckout: true)
  const legacyAutoRecord = {
    employeeId: 'EMP_LEGACY_01',
    employeeName: 'Ajay Kumar',
    markInAt: new Date('2026-09-19T08:00:00Z'),
    markOutAt: new Date('2026-09-20T02:15:00Z'),
    autoMarkOut: true,
    status: 'AUTO_COMPLETED',
  };
  const normLegacyAuto = normalizeAttendance(legacyAutoRecord);
  assert(normLegacyAuto.markOutType === 'AUTO_OUT', `Legacy auto normalized to AUTO_OUT`);
  assert(getMarkOutTypeDisplay(normLegacyAuto) === 'Auto-Out', `Legacy auto displays 'Auto-Out'`);

  // --- Test 4: Manual Mark Out ---
  console.log('\n--- 4. Testing Manual Mark Out ---');
  const manualRecord = {
    employeeId: 'EMP_MANUAL_01',
    employeeName: 'Ajay Kumar',
    markInAt: new Date('2026-09-19T10:00:00Z'),
    markOutAt: new Date('2026-09-19T19:05:00Z'),
    markOutType: 'MANUAL',
    markOutByUserId: 'USR_TEST_001',
    markOutByUserName: 'Rahul Sharma',
    status: 'COMPLETED',
    workingMinutes: 545,
  };
  const normManual = normalizeAttendance(manualRecord);
  assert(normManual.markOutType === 'MANUAL', `Normalized markOutType is MANUAL`);
  assert(normManual.markOutByUserName === 'Rahul Sharma', `markOutByUserName preserved: ${normManual.markOutByUserName}`);
  const manualDisplay = getMarkOutTypeDisplay(normManual);
  assert(manualDisplay === 'Manual - Rahul Sharma', `Display value is exactly 'Manual - Rahul Sharma' (got: '${manualDisplay}')`);

  // Legacy manual record without markOutByUserName but with markOutManualBy
  const legacyManualRecord = {
    employeeId: 'EMP_LEGACY_MAN_01',
    employeeName: 'Ajay Kumar',
    markInAt: new Date('2026-09-19T10:00:00Z'),
    markOutAt: new Date('2026-09-19T19:05:00Z'),
    markOutType: 'MANUAL',
    markOutManualBy: 'Priya Patel',
    status: 'COMPLETED',
  };
  const normLegacyManual = normalizeAttendance(legacyManualRecord);
  assert(normLegacyManual.markOutType === 'MANUAL', `Legacy manual normalized to MANUAL`);
  assert(normLegacyManual.markOutByUserName === 'Priya Patel', `Resolved markOutByUserName from markOutManualBy: ${normLegacyManual.markOutByUserName}`);
  assert(getMarkOutTypeDisplay(normLegacyManual) === 'Manual - Priya Patel', `Legacy manual displays 'Manual - Priya Patel'`);

  // --- Test 5: Absent / Running Sessions ---
  console.log('\n--- 5. Testing Absent and Running (No Mark Out) ---');
  const absentRecord = {
    employeeId: 'EMP_ABS_01',
    employeeName: 'Absent Employee',
    status: 'ABSENT',
    markInAt: null,
    markOutAt: null,
  };
  assert(getMarkOutTypeDisplay(normalizeAttendance(absentRecord)) === '-', `Absent record displays '-'`);

  const runningRecord = {
    employeeId: 'EMP_RUN_01',
    employeeName: 'Running Employee',
    status: 'ACTIVE',
    markInAt: new Date(),
    markOutAt: null,
  };
  assert(getMarkOutTypeDisplay(normalizeAttendance(runningRecord)) === '-', `Running record with no mark out displays '-'`);

  // --- Test 6: Database Insertion & Retrieval for Attendance Collection ---
  console.log('\n--- 6. Testing Real MongoDB Attendance Document ---');
  const testDoc = await Attendance.create({
    employeeId: 'TEST_EMP_DOC_01',
    employeeName: 'Test Employee Document',
    markInAt: new Date('2026-09-18T09:00:00Z'),
    markOutAt: new Date('2026-09-18T18:00:00Z'),
    markOutType: 'MANUAL',
    markOutByUserId: 'USR_TEST_001',
    markOutByUserName: 'Rahul Sharma',
    attendanceDate: '2026-09-18',
    status: 'COMPLETED',
    approvalStatus: 'APPROVED',
    approved: true,
    approvedBy: 'Admin',
  });

  const retrieved = await Attendance.findById(testDoc._id).lean();
  assert(retrieved.markOutType === 'MANUAL', `Stored markOutType in MongoDB is 'MANUAL'`);
  assert(retrieved.markOutByUserId === 'USR_TEST_001', `Stored markOutByUserId is 'USR_TEST_001'`);
  assert(retrieved.markOutByUserName === 'Rahul Sharma', `Stored markOutByUserName is 'Rahul Sharma'`);

  const normRetrieved = normalizeAttendance(retrieved);
  assert(getMarkOutTypeDisplay(normRetrieved) === 'Manual - Rahul Sharma', `Retrieved MongoDB record displays: 'Manual - Rahul Sharma'`);

  // Clean up test document and test user
  await Attendance.deleteOne({ _id: testDoc._id });
  await User.deleteOne({ _id: testUser._id });

  console.log(`\n=== TEST SUMMARY: ${testPassed} Passed, ${testFailed} Failed ===`);
  if (testFailed === 0) {
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  } else {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
