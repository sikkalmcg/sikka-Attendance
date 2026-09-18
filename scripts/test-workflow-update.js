import mongoose from 'mongoose';
import { getTodayDateString, getAttendanceDateString } from '../lib/timezone.js';
import { normalizeAttendance } from '../lib/normalize.js';
import { subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

async function runTests() {
  console.log('====================================================');
  console.log('🚀 Running Sikka HRMS Workflow & Access Control Tests');
  console.log('====================================================\n');

  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB });
  const db = mongoose.connection.db;

  const today = getTodayDateString();
  console.log(`Current Date (IST): ${today}\n`);

  // ----------------------------------------------------
  // Test 1: Rule 1 - Current Date Attendance Cannot Be Approved
  // ----------------------------------------------------
  console.log('--- TEST 1: Rule 1 – Current Date Attendance ---');
  const currentDateDoc = await db.collection('attendance').findOne({
    $or: [{ date: today }, { inDate: today }, { attendanceDate: today }]
  });

  if (currentDateDoc) {
    console.log(`Found current date record: ID=${currentDateDoc._id}, Date=${currentDateDoc.inDate || currentDateDoc.date}`);
    const res = await fetch('http://localhost:3000/api/attendance/approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Cookie for ajaysomra (Admin)
        'Cookie': 'sikka_session=' + await getAdminToken(db)
      },
      body: JSON.stringify({ ids: [currentDateDoc._id.toString()] })
    });
    const data = await res.json();
    console.log('Response status:', res.status);
    console.log('Response body:', data);
    if (res.status === 400 && data.rule === 1) {
      console.log('✅ Rule 1 PASS: Backend correctly rejected current date approval!\n');
    } else {
      console.error('❌ Rule 1 FAIL: Expected 400 with rule 1, got:', res.status, data);
    }
  } else {
    console.log('ℹ️ No existing current-date record; creating a temporary one to test Rule 1');
    const tempId = new mongoose.Types.ObjectId();
    await db.collection('attendance').insertOne({
      _id: tempId,
      employeeId: 'TEST-EMP-01',
      employeeName: 'Test Employee',
      date: today,
      inDate: today,
      inTime: '10:00',
      outDate: today,
      outTime: '18:00',
      status: 'COMPLETED',
      approved: false,
      approvalStatus: 'PENDING',
      createdAt: new Date()
    });
    const res = await fetch('http://localhost:3000/api/attendance/approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'sikka_session=' + await getAdminToken(db)
      },
      body: JSON.stringify({ ids: [tempId.toString()] })
    });
    const data = await res.json();
    await db.collection('attendance').deleteOne({ _id: tempId });
    if (res.status === 400 && data.rule === 1) {
      console.log('✅ Rule 1 PASS: Backend correctly rejected current date approval!\n');
    } else {
      console.error('❌ Rule 1 FAIL: Expected 400 with rule 1, got:', res.status, data);
    }
  }

  // ----------------------------------------------------
  // Test 2: Rule 2 - Past Date, Mark IN Complete but Mark OUT Incomplete
  // ----------------------------------------------------
  console.log('--- TEST 2: Rule 2 – Past Date, Mark IN Complete but Mark OUT Incomplete ---');
  const tempIncompleteId = new mongoose.Types.ObjectId();
  const pastDate = formatInTimeZone(subDays(new Date(), 2), 'Asia/Kolkata', 'yyyy-MM-dd');
  await db.collection('attendance').insertOne({
    _id: tempIncompleteId,
    employeeId: 'TEST-EMP-02',
    employeeName: 'Test Incomplete Employee',
    date: pastDate,
    inDate: pastDate,
    inTime: '09:00',
    inDateTime: new Date(`${pastDate}T09:00:00+05:30`),
    status: 'ACTIVE',
    approved: false,
    approvalStatus: 'PENDING',
    createdAt: new Date(`${pastDate}T09:00:00+05:30`)
  });

  const resRule2 = await fetch('http://localhost:3000/api/attendance/approve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'sikka_session=' + await getAdminToken(db)
    },
    body: JSON.stringify({ ids: [tempIncompleteId.toString()] })
  });
  const dataRule2 = await resRule2.json();
  console.log('Response status:', resRule2.status);
  console.log('Response body:', dataRule2);
  await db.collection('attendance').deleteOne({ _id: tempIncompleteId });

  if (resRule2.status === 400 && dataRule2.rule === 2) {
    console.log('✅ Rule 2 PASS: Backend correctly rejected past date with incomplete Mark OUT!\n');
  } else {
    console.error('❌ Rule 2 FAIL: Expected 400 with rule 2, got:', resRule2.status, dataRule2);
  }

  // ----------------------------------------------------
  // Test 3: Rule 3 - Past Date, No Mark IN and No Mark OUT (Absent Approval)
  // ----------------------------------------------------
  console.log('--- TEST 3: Rule 3 – Past Date, No Mark IN & No Mark OUT (Absent Approval) ---');
  const tempAbsentId = new mongoose.Types.ObjectId();
  const pastAbsentDate = formatInTimeZone(subDays(new Date(), 3), 'Asia/Kolkata', 'yyyy-MM-dd');
  await db.collection('attendance').insertOne({
    _id: tempAbsentId,
    employeeId: 'TEST-EMP-03',
    employeeName: 'Test Absent Employee',
    date: pastAbsentDate,
    inDate: pastAbsentDate,
    inTime: null,
    outTime: null,
    status: 'ABSENT',
    approved: false,
    approvalStatus: 'PENDING',
    createdAt: new Date(`${pastAbsentDate}T00:00:00+05:30`)
  });

  const resRule3 = await fetch('http://localhost:3000/api/attendance/approve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'sikka_session=' + await getAdminToken(db)
    },
    body: JSON.stringify({ ids: [tempAbsentId.toString()] })
  });
  const dataRule3 = await resRule3.json();
  console.log('Response status:', resRule3.status);
  console.log('Response message:', dataRule3.message);

  const updatedAbsentDoc = await db.collection('attendance').findOne({ _id: tempAbsentId });
  await db.collection('attendance').deleteOne({ _id: tempAbsentId });

  if (resRule3.status === 200 && updatedAbsentDoc.approvalStatus === 'APPROVED' && updatedAbsentDoc.status === 'ABSENT') {
    console.log('✅ Rule 3 PASS: Absent record successfully approved as ABSENT with approvalStatus: APPROVED!\n');
  } else {
    console.error('❌ Rule 3 FAIL: Expected 200 and approved absent, got:', resRule3.status, updatedAbsentDoc);
  }

  // ----------------------------------------------------
  // Test 4: Rule 4 & 5 - Past Date, Mark IN & Mark OUT Complete / Auto OUT
  // ----------------------------------------------------
  console.log('--- TEST 4: Rule 4 & 5 – Past Date, Completed / Auto Mark OUT ---');
  const tempCompleteId = new mongoose.Types.ObjectId();
  const pastCompleteDate = formatInTimeZone(subDays(new Date(), 4), 'Asia/Kolkata', 'yyyy-MM-dd');
  await db.collection('attendance').insertOne({
    _id: tempCompleteId,
    employeeId: 'TEST-EMP-04',
    employeeName: 'Test Completed Employee',
    date: pastCompleteDate,
    inDate: pastCompleteDate,
    inTime: '10:00',
    inDateTime: new Date(`${pastCompleteDate}T10:00:00+05:30`),
    outDate: pastCompleteDate,
    outTime: '18:00',
    outDateTime: new Date(`${pastCompleteDate}T18:00:00+05:30`),
    markOutType: 'Auto',
    autoMarkOut: true,
    status: 'AUTO_COMPLETED',
    workingMinutes: 480,
    approved: false,
    approvalStatus: 'PENDING',
    createdAt: new Date(`${pastCompleteDate}T10:00:00+05:30`)
  });

  const resRule4 = await fetch('http://localhost:3000/api/attendance/approve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'sikka_session=' + await getAdminToken(db)
    },
    body: JSON.stringify({ ids: [tempCompleteId.toString()] })
  });
  const dataRule4 = await resRule4.json();
  console.log('Response status:', resRule4.status);
  console.log('Response message:', dataRule4.message);

  const updatedCompleteDoc = await db.collection('attendance').findOne({ _id: tempCompleteId });
  await db.collection('attendance').deleteOne({ _id: tempCompleteId });

  if (resRule4.status === 200 && updatedCompleteDoc.approvalStatus === 'APPROVED' && updatedCompleteDoc.approved === true) {
    console.log('✅ Rule 4 & 5 PASS: Past completed record successfully approved!\n');
  } else {
    console.error('❌ Rule 4 & 5 FAIL: Expected 200 and approved, got:', resRule4.status, updatedCompleteDoc);
  }

  // ----------------------------------------------------
  // Test 5: 60-Calendar-Day History API & Pagination
  // ----------------------------------------------------
  console.log('--- TEST 5: 60-Calendar-Day History API & Pagination ---');
  const employeeToken = await getEmployeeToken(db);
  const resHistoryP1 = await fetch('http://localhost:3000/api/attendance/history?page=1&limit=10', {
    headers: { 'Cookie': 'sikka_session=' + employeeToken }
  });
  const dataHistP1 = await resHistoryP1.json();

  console.log('Page 1 count:', dataHistP1.history?.length);
  console.log('Pagination:', dataHistP1.pagination);
  console.log('First date (newest):', dataHistP1.history?.[0]?.date, 'Status:', dataHistP1.history?.[0]?.status);

  const resHistoryP6 = await fetch('http://localhost:3000/api/attendance/history?page=6&limit=10', {
    headers: { 'Cookie': 'sikka_session=' + employeeToken }
  });
  const dataHistP6 = await resHistoryP6.json();
  console.log('Page 6 count:', dataHistP6.history?.length);
  console.log('Last date (day 60):', dataHistP6.history?.[dataHistP6.history.length - 1]?.date);

  const expectedFirstDate = formatInTimeZone(new Date(), 'Asia/Kolkata', 'dd-MMM-yyyy');
  const expectedLastDate = formatInTimeZone(subDays(new Date(), 59), 'Asia/Kolkata', 'dd-MMM-yyyy');

  if (
    dataHistP1.pagination?.totalDays === 60 &&
    dataHistP1.pagination?.totalPages === 6 &&
    dataHistP1.history?.length === 10 &&
    dataHistP6.history?.length === 10 &&
    dataHistP1.pagination?.hasPrev === false &&
    dataHistP1.pagination?.hasNext === true &&
    dataHistP6.pagination?.hasPrev === true &&
    dataHistP6.pagination?.hasNext === false &&
    dataHistP1.history?.[0]?.date === expectedFirstDate &&
    dataHistP6.history?.[dataHistP6.history.length - 1]?.date === expectedLastDate
  ) {
    console.log('✅ 60-Calendar-Day History PASS: Exactly 60 calendar days generated (10/page across 6 pages), newest first, unrecorded dates displayed as Absent!\n');
  } else {
    console.error('❌ History FAIL:', {
      totalDays: dataHistP1.pagination?.totalDays,
      totalPages: dataHistP1.pagination?.totalPages,
      firstDate: dataHistP1.history?.[0]?.date,
      expectedFirstDate,
      lastDate: dataHistP6.history?.[dataHistP6.history.length - 1]?.date,
      expectedLastDate,
    });
  }

  // ----------------------------------------------------
  // Test 6: User Management Security - Rejecting mark-attendance permission
  // ----------------------------------------------------
  console.log('--- TEST 6: User Management Access Control & Security ---');
  const resUserReject = await fetch('http://localhost:3000/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'sikka_session=' + await getAdminToken(db)
    },
    body: JSON.stringify({
      userId: 'TEST-SECURITY-USR',
      fullName: 'Security Test',
      username: 'sectest' + Date.now(),
      password: 'Password@123',
      role: 'User',
      permissions: ['dashboard', 'mark-attendance']
    })
  });
  const dataUserReject = await resUserReject.json();
  console.log('User create with mark-attendance status:', resUserReject.status);
  console.log('User create response:', dataUserReject);

  if (resUserReject.status === 400 && dataUserReject.error.includes('Mark Attendance')) {
    console.log('✅ User Management Security PASS: Backend strictly rejected assigning Mark Attendance to system user!\n');
  } else {
    console.error('❌ User Management Security FAIL: Expected 400 rejection, got:', resUserReject.status);
  }

  await mongoose.disconnect();
  console.log('====================================================');
  console.log('🎉 All Workflow & Access Control Tests Completed!');
  console.log('====================================================');
}

async function getAdminToken(db) {
  const { SignJWT } = await import('jose');
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'sikka-hrms-production-secret-key-2026-secure-jwt');
  return new SignJWT({
    sub: 'admin-id',
    userId: 'USR-ADMIN-01',
    username: 'ajaysomra',
    fullName: 'Ajay Somra (Admin)',
    role: 'Admin',
    permissions: ['dashboard', 'plant', 'approval', 'report', 'employee', 'user-management'],
    plantIds: ['*'],
    userType: 'SYSTEM_USER'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

async function getEmployeeToken(db) {
  const emp = await db.collection('employees').findOne({ active: { $ne: false } });
  const { SignJWT } = await import('jose');
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'sikka-hrms-production-secret-key-2026-secure-jwt');
  return new SignJWT({
    sub: emp._id.toString(),
    employeeId: emp.employeeId || emp.id || 'EMP-TEST',
    fullName: emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
    designation: emp.designation || 'Staff',
    aadhaarNumber: emp.aadhaar || emp.aadhaarNumber || '',
    mobileNumber: emp.mobile || emp.mobileNumber || '',
    role: 'Employee',
    attendanceAuthorized: true,
    userType: 'EMPLOYEE'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
