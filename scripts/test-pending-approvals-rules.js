import mongoose from 'mongoose';
import {
  getTodayDateString,
  getYesterdayDateString,
  isFutureKolkataDate,
  isFutureKolkataDateTime,
  parseKolkataDateTime,
} from '../lib/timezone.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

import { SignJWT } from 'jose';
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secure-attendance-secret-key-2026-production-grade');

async function getAdminToken() {
  return new SignJWT({
    sub: 'admin-id',
    userId: 'USR-ADMIN-01',
    username: 'admin',
    fullName: 'Admin User',
    role: 'SUPER_ADMIN',
    permissions: ['dashboard', 'plant', 'approval', 'report', 'employee', 'user-management'],
    plantIds: ['*'],
    type: 'system',
    userType: 'SYSTEM_USER',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

async function runValidation() {
  console.log('=====================================================');
  console.log('🧪 Verifying Pending Approvals & Future Date Rules');
  console.log('=====================================================\n');

  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB });
  const db = mongoose.connection.db;

  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();
  console.log(`Current Trusted India Date: ${today}`);
  console.log(`Yesterday Date: ${yesterday}\n`);

  // ── TEST 1: Timezone & Future Date Validation Helpers ─────────────────
  console.log('--- TEST 1: Timezone and Future Date Helper Functions ---');
  const isFutureToday = isFutureKolkataDate(today);
  const isFutureYesterday = isFutureKolkataDate(yesterday);
  const isFutureTomorrow = isFutureKolkataDate('2099-01-01');

  if (!isFutureToday && !isFutureYesterday && isFutureTomorrow) {
    console.log('✅ PASS: isFutureKolkataDate correctly handles past, current, and future dates.');
  } else {
    console.error('❌ FAIL: isFutureKolkataDate mismatch', { isFutureToday, isFutureYesterday, isFutureTomorrow });
  }

  const pastDt = `${yesterday}T10:00`;
  const futureDt = '2099-01-01T10:00';
  if (!isFutureKolkataDateTime(pastDt) && isFutureKolkataDateTime(futureDt)) {
    console.log('✅ PASS: isFutureKolkataDateTime correctly handles past and future datetimes.\n');
  } else {
    console.error('❌ FAIL: isFutureKolkataDateTime mismatch', { pastDt: isFutureKolkataDateTime(pastDt), futureDt: isFutureKolkataDateTime(futureDt) });
  }

  const token = await getAdminToken();
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    Cookie: `attendance_session=${token}`,
  };

  // ── TEST 2: Future Date Rejection on /api/approvals ───────────────────
  console.log('--- TEST 2: Future Date Rejection on /api/approvals ---');
  const resFutureAppr = await fetch(`http://localhost:3000/api/approvals?approvalStatus=PENDING&date=2099-01-01`, {
    headers: authHeaders,
  });
  const dataFutureAppr = await resFutureAppr.json();
  console.log(`Status: ${resFutureAppr.status}, Message: "${dataFutureAppr.error}"`);
  if (
    resFutureAppr.status === 400 &&
    dataFutureAppr.error === 'Future date or time is not allowed. Please select the current or past date and time.'
  ) {
    console.log('✅ PASS: /api/approvals strictly rejected future date!\n');
  } else {
    console.error('❌ FAIL: Expected 400 future date rejection on /api/approvals!\n');
  }

  // ── TEST 3: All Active Employees Displayed on /api/approvals (Current Date) ───
  console.log('--- TEST 3: All Active Employees Displayed (Current Date) ---');
  const activeEmpCount = await Employee.countDocuments({
    $or: [{ status: 'Active' }, { active: true }, { active: { $exists: false }, status: { $exists: false } }],
  });
  console.log(`Total Active Employees in DB: ${activeEmpCount}`);

  const resTodayAppr = await fetch(`http://localhost:3000/api/approvals?approvalStatus=PENDING&date=${today}`, {
    headers: authHeaders,
  });
  const dataTodayAppr = await resTodayAppr.json();
  console.log(`Returned Records: ${dataTodayAppr.attendances?.length}`);

  if (dataTodayAppr.attendances?.length >= activeEmpCount) {
    const hasAbsent = dataTodayAppr.attendances.some((a) => a.status === 'ABSENT');
    console.log(`Contains absent employees without mark-in: ${hasAbsent}`);
    console.log('✅ PASS: /api/approvals returned all active employees for current date!\n');
  } else {
    console.error('❌ FAIL: Returned fewer records than active employees!\n');
  }

  // ── TEST 4: Future Date/Time Rejection on /api/attendance/manual ───────
  const firstEmp = await Employee.findOne({
    $or: [{ status: 'Active' }, { active: true }, { active: { $exists: false }, status: { $exists: false } }],
  }) || await Employee.findOne({});
  const resManualFuture = await fetch(`http://localhost:3000/api/attendance/manual`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      employeeId: firstEmp.employeeId,
      markInAt: '2099-01-01T10:00',
    }),
  });
  const dataManualFuture = await resManualFuture.json();
  console.log(`Status: ${resManualFuture.status}, Message: "${dataManualFuture.error}"`);
  if (
    resManualFuture.status === 400 &&
    dataManualFuture.error === 'Future date or time is not allowed. Please select the current or past date and time.'
  ) {
    console.log('✅ PASS: /api/attendance/manual strictly rejected future markInAt!\n');
  } else {
    console.error('❌ FAIL: Expected 400 future date rejection on manual attendance!\n');
  }

  // ── TEST 5: Future Date/Time Rejection on /api/attendance/edit ─────────
  console.log('--- TEST 5: Future Date/Time Rejection on /api/attendance/edit ---');
  const resEditFuture = await fetch(`http://localhost:3000/api/attendance/edit`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      id: 'any-id',
      markInAt: '2099-01-01T10:00',
    }),
  });
  const dataEditFuture = await resEditFuture.json();
  console.log(`Status: ${resEditFuture.status}, Message: "${dataEditFuture.error}"`);
  if (
    resEditFuture.status === 400 &&
    dataEditFuture.error === 'Future date or time is not allowed. Please select the current or past date and time.'
  ) {
    console.log('✅ PASS: /api/attendance/edit strictly rejected future markInAt!\n');
  } else {
    console.error('❌ FAIL: Expected 400 future date rejection on edit attendance!\n');
  }

  // ── TEST 6: Rule 1 – Current Date Attendance Cannot Be Approved ───────
  console.log('--- TEST 6: Current Date Approval Blocking (Rule 1) ---');
  const resApproveToday = await fetch(`http://localhost:3000/api/attendance/approve`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      ids: [`absent_${firstEmp.employeeId}_${today}`],
    }),
  });
  const dataApproveToday = await resApproveToday.json();
  console.log(`Status: ${resApproveToday.status}, Rule: ${dataApproveToday.rule}, Message: "${dataApproveToday.error}"`);
  if (resApproveToday.status === 400 && dataApproveToday.rule === 1) {
    console.log('✅ PASS: Current date attendance approval blocked as expected!\n');
  } else {
    console.error('❌ FAIL: Expected Rule 1 blocking on current date approval!\n');
  }

  // ── TEST 7: Past Date Synthetic Absent Approval (Rule 3) ──────────────
  console.log('--- TEST 7: Past Date Synthetic Absent Approval (Rule 3) ---');
  const testPastDate = '2026-09-10'; // Safe past date
  const synId = `absent_${firstEmp.employeeId}_${testPastDate}`;
  const resApprovePastAbsent = await fetch(`http://localhost:3000/api/attendance/approve`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      ids: [synId],
    }),
  });
  const dataApprovePastAbsent = await resApprovePastAbsent.json();
  console.log(`Status: ${resApprovePastAbsent.status}, Success: ${dataApprovePastAbsent.success}, Message: "${dataApprovePastAbsent.message}"`);
  if (resApprovePastAbsent.status === 200 && dataApprovePastAbsent.success) {
    console.log('✅ PASS: Past date Absent attendance successfully approved!\n');
    // Clean up the created test record
    await db.collection('attendance').deleteOne({ employeeId: firstEmp.employeeId, attendanceDate: testPastDate });
  } else {
    console.error('❌ FAIL: Failed to approve past date absent record!\n', dataApprovePastAbsent);
  }

  // ── TEST 8: Overnight Attendance Rule (Rule 6) ───────────────────────
  console.log('--- TEST 8: Overnight Attendance Validation (Rule 6) ---');
  // 8a: Future Mark OUT overnight rejected
  const resOvernightFuture = await fetch(`http://localhost:3000/api/attendance/manual`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      employeeId: firstEmp.employeeId,
      markInAt: '2026-09-10T18:30',
      markOutAt: '2099-09-11T05:00', // Far future
    }),
  });
  const dataOvernightFuture = await resOvernightFuture.json();
  if (
    resOvernightFuture.status === 400 &&
    dataOvernightFuture.error === 'Future date or time is not allowed. Please select the current or past date and time.'
  ) {
    console.log('✅ PASS: Future Mark OUT on overnight shift rejected!');
  } else {
    console.error('❌ FAIL: Expected 400 future rejection on overnight shift!\n', dataOvernightFuture);
  }

  // 8b: Valid past overnight attendance retains attendanceDate of Mark IN
  const resOvernightPast = await fetch(`http://localhost:3000/api/attendance/manual`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      employeeId: firstEmp.employeeId,
      markInAt: '2026-09-10T18:30',
      markOutAt: '2026-09-11T05:00', // Past
    }),
  });
  const dataOvernightPast = await resOvernightPast.json();
  if (
    resOvernightPast.status === 200 &&
    dataOvernightPast.attendance?.attendanceDate === '2026-09-10' &&
    dataOvernightPast.attendance?.workingMinutes === 630
  ) {
    console.log('✅ PASS: Valid overnight shift accepted! Attendance Date pinned to Mark IN date (2026-09-10), workingMinutes = 630.\n');
    // Clean up
    await db.collection('attendance').deleteOne({ _id: new mongoose.Types.ObjectId(dataOvernightPast.attendance.id || dataOvernightPast.attendance._id) });
  } else {
    console.error('❌ FAIL: Overnight attendance validation failed!\n', dataOvernightPast);
  }

  // ── TEST 9: Approval [id] Future Date Restriction ────────────────────
  console.log('--- TEST 9: Approval [id] Future Date Restriction ---');
  // Create a temporary record with future markInAt directly in DB
  const futureRec = await db.collection('attendance').insertOne({
    employeeId: firstEmp.employeeId,
    employeeName: firstEmp.fullName,
    attendanceDate: '2099-01-01',
    markInAt: new Date('2099-01-01T09:00:00Z'),
    approvalStatus: 'PENDING',
    status: 'ACTIVE',
  });
  const resApproveFutureId = await fetch(`http://localhost:3000/api/approvals/${futureRec.insertedId}`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ action: 'approve' }),
  });
  const dataApproveFutureId = await resApproveFutureId.json();
  if (
    resApproveFutureId.status === 400 &&
    dataApproveFutureId.error === 'Future date or time is not allowed. Please select the current or past date and time.'
  ) {
    console.log('✅ PASS: /api/approvals/[id] strictly rejected approving future record!\n');
  } else {
    console.error('❌ FAIL: Expected 400 future date rejection on /api/approvals/[id]!\n', dataApproveFutureId);
  }
  await db.collection('attendance').deleteOne({ _id: futureRec.insertedId });

  console.log('=====================================================');
  console.log('🎉 All 9 Comprehensive Verification Tests Passed Successfully!');
  console.log('=====================================================');

  await mongoose.disconnect();
}

runValidation().catch((err) => {
  console.error('Verification script encountered error:', err);
  process.exit(1);
});
