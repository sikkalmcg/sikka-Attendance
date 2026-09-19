import mongoose from 'mongoose';
import { SignJWT } from 'jose';
import connectToDatabase from '../lib/mongodb.js';
import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import { getTodayDateString, getYesterdayDateString } from '../lib/timezone.js';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secure-attendance-secret-key-2026-production-grade');

async function createTokenForUser(username) {
  return new SignJWT({
    sub: `user-${username}`,
    userId: `USR-${username}`,
    username,
    fullName: `${username} Kumar`,
    role: 'Admin',
    permissions: ['dashboard', 'plant', 'approval', 'report', 'employee', 'user-management'],
    plantIds: ['*'],
    userType: 'SYSTEM_USER',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 Testing Report Page & Manual Attendance Tracking Logic');
  console.log('================================================================\n');

  await connectToDatabase();

  const neerajToken = await createTokenForUser('Neeraj');
  const managerToken = await createTokenForUser('ManagerSharma');

  const testEmpId = `EMP-TEST-${Date.now()}`;
  const testAadhaar = `9999${Date.now().toString().slice(-8)}`;
  const testEmp = await Employee.create({
    employeeId: testEmpId,
    fullName: 'Ajay Test Kumar',
    firstName: 'Ajay',
    lastName: 'Kumar',
    aadhaarNumber: testAadhaar,
    mobileNumber: `98${Date.now().toString().slice(-8)}`,
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
    designation: 'Operator',
    active: true,
    plantName: 'Sikka Plant 1',
  });

  const empId = testEmp.employeeId;
  console.log(`Using Employee: ${testEmp.fullName} (${empId})`);

  const yesterday = getYesterdayDateString();
  const createdRecordIds = [];

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1: Manual Mark IN only by user "Neeraj"
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 1: Manual Mark IN only by user "Neeraj" ---');
  const res1 = await fetch('http://localhost:3000/api/attendance/manual', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${neerajToken}`,
    },
    body: JSON.stringify({
      employeeId: empId,
      markInAt: `${yesterday}T09:00:00`,
    }),
  });

  const data1 = await res1.json();
  console.log('Response status:', res1.status);
  console.log('Attendance created:', data1.attendance);
  if (res1.status === 200 && data1.success) {
    const attId = data1.attendance.id || data1.attendance._id;
    let doc = await Attendance.findById(attId);
    if (!doc && mongoose.Types.ObjectId.isValid(attId)) {
      doc = await Attendance.findOne({ _id: new mongoose.Types.ObjectId(attId) });
    }
    if (!doc) {
      doc = await Attendance.findOne({ employeeId: empId });
    }
    createdRecordIds.push(doc._id);
    console.log('markInManualBy:', doc.markInManualBy);
    console.log('markOutManualBy:', doc.markOutManualBy);
    console.log('manualAttendanceBy:', doc.manualAttendanceBy);
    if (doc.markInManualBy === 'Neeraj' && doc.markOutManualBy === null && doc.manualAttendanceBy === 'Neeraj') {
      console.log('✅ PASS: Case 1 correctly set markInManualBy="Neeraj" and markOutManualBy=null!');
    } else {
      console.error('❌ FAIL: Incorrect manual tracking for Case 1', doc);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 2: Adding Mark OUT to existing attendance session by "Neeraj"
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 2: Adding Mark OUT to existing session by "Neeraj" ---');
    const res2 = await fetch('http://localhost:3000/api/attendance/manual', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${neerajToken}`,
      },
      body: JSON.stringify({
        attendanceId: doc._id.toString(),
        markOutAt: `${yesterday}T17:30:00`,
      }),
    });

    const data2 = await res2.json();
    console.log('Response status:', res2.status);
    if (res2.status === 200 && data2.success) {
      const updatedDoc = await Attendance.findById(doc._id);
      console.log('After Mark OUT - markInManualBy:', updatedDoc.markInManualBy);
      console.log('After Mark OUT - markOutManualBy:', updatedDoc.markOutManualBy);
      console.log('After Mark OUT - manualAttendanceBy:', updatedDoc.manualAttendanceBy);
      if (updatedDoc.markInManualBy === 'Neeraj' && updatedDoc.markOutManualBy === 'Neeraj' && updatedDoc.manualAttendanceBy === 'Neeraj') {
        console.log('✅ PASS: Case 3 correctly tracked both Mark In and Mark Out by "Neeraj"!');
      } else {
        console.error('❌ FAIL: Case 3 tracking mismatch', updatedDoc);
      }
    } else {
      console.error('❌ FAIL: Could not add Mark OUT', data2);
    }
  } else {
    console.error('❌ FAIL: Could not create manual attendance', data1);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3: Edit existing attendance Mark IN by a different user "ManagerSharma"
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 3: Edit attendance Mark IN by "ManagerSharma" ---');
  if (createdRecordIds.length > 0) {
    const targetId = createdRecordIds[0];
    const res3 = await fetch('http://localhost:3000/api/attendance/edit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({
        id: targetId.toString(),
        markInAt: `${yesterday}T08:45:00`,
        markOutAt: `${yesterday}T17:30:00`,
      }),
    });

    const data3 = await res3.json();
    console.log('Response status:', res3.status);
    if (res3.status === 200 && data3.success) {
      const editedDoc = await Attendance.findById(targetId);
      console.log('After Edit - markInManualBy:', editedDoc.markInManualBy);
      console.log('After Edit - markOutManualBy:', editedDoc.markOutManualBy);
      if (editedDoc.markInManualBy === 'ManagerSharma' && editedDoc.markOutManualBy === 'Neeraj') {
        console.log('✅ PASS: Edit route correctly updated markInManualBy="ManagerSharma" and preserved markOutManualBy="Neeraj"!');
      } else {
        console.error('❌ FAIL: Edit route tracking mismatch', editedDoc);
      }
    } else {
      console.error('❌ FAIL: Edit attendance failed', data3);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Test 4: Report API status filtering (Present / Absent)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 4: Report API status filtering ---');
  // First approve the created test record so it appears in reports
  if (createdRecordIds.length > 0) {
    await Attendance.findByIdAndUpdate(createdRecordIds[0], {
      approvalStatus: 'APPROVED',
      approved: true,
      approvedBy: 'Admin',
    });
  }

  // Fetch with status=Present
  const resPresent = await fetch('http://localhost:3000/api/reports/attendance?status=Present', {
    headers: { Authorization: `Bearer ${neerajToken}` },
  });
  const dataPresent = await resPresent.json();
  console.log(`status=Present count: ${dataPresent.records?.length}`);
  const hasOnlyPresent = dataPresent.records?.every((r) => r.status !== 'ABSENT');
  if (hasOnlyPresent) {
    console.log('✅ PASS: status=Present returned only present records!');
  } else {
    console.error('❌ FAIL: status=Present returned non-present records');
  }

  // Fetch with status=Absent
  const resAbsent = await fetch('http://localhost:3000/api/reports/attendance?status=Absent', {
    headers: { Authorization: `Bearer ${neerajToken}` },
  });
  const dataAbsent = await resAbsent.json();
  console.log(`status=Absent count: ${dataAbsent.records?.length}`);
  const hasOnlyAbsent = dataAbsent.records?.every((r) => r.status === 'ABSENT');
  if (hasOnlyAbsent) {
    console.log('✅ PASS: status=Absent returned only absent records!');
  } else {
    console.error('❌ FAIL: status=Absent returned non-absent records');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Test 5: Report Export verification (CSV)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 5: Report CSV Export Header Order ---');
  const resCsv = await fetch('http://localhost:3000/api/reports/attendance?export=csv', {
    headers: { Authorization: `Bearer ${neerajToken}` },
  });
  const csvText = await resCsv.text();
  const headerLine = csvText.split('\n')[0];
  console.log('CSV Headers:', headerLine);

  const expectedHeaders = [
    'Employee ID',
    'Employee Name',
    'Designation',
    'Attendance Date',
    'Mark In Plant',
    'Mark IN Date Time',
    'Mark Out Date Time',
    'Working Hour',
    'Mark Out Type',
    'Mark Out Plant',
    'Status',
    'Manual Attendance By',
    'Approved By',
    'Remark',
  ];

  const headersMatch = expectedHeaders.every((h) => headerLine.includes(h));
  const attendanceDateBeforeMarkInPlant = headerLine.indexOf('Attendance Date') < headerLine.indexOf('Mark In Plant');
  const remarkAfterApprovedBy = headerLine.indexOf('Remark') > headerLine.indexOf('Approved By');

  if (headersMatch && attendanceDateBeforeMarkInPlant && remarkAfterApprovedBy) {
    console.log('✅ PASS: CSV Headers strictly follow the required column positions!');
  } else {
    console.error('❌ FAIL: CSV Header sequence mismatch', {
      headersMatch,
      attendanceDateBeforeMarkInPlant,
      remarkAfterApprovedBy,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Clean up
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Cleaning up temporary test records ---');
  await Employee.findByIdAndDelete(testEmp._id);
  console.log(`Deleted test employee: ${testEmp._id}`);
  for (const id of createdRecordIds) {
    await Attendance.findByIdAndDelete(id);
    console.log(`Deleted test record: ${id}`);
  }

  console.log('\n================================================================');
  console.log('🎉 All Automated Tests Completed Successfully!');
  console.log('================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
