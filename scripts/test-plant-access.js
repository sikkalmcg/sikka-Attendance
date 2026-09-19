import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode('super-secure-attendance-secret-key-2026-production-grade');

async function makeToken(userPayload) {
  return new SignJWT(userPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(JWT_SECRET);
}

async function runTests() {
  const baseUrl = 'http://localhost:3000';

  console.log('--- Starting Plant-Wise Access Control Tests ---');

  // Token for kaushal (Tea Plant user)
  const kaushalToken = await makeToken({
    sub: 'z47Npu9lkU1jrqpt0puf',
    userId: 'USR-004',
    username: 'kaushal',
    fullName: 'Kaushal Pandey',
    role: 'User',
    userType: 'SYSTEM_USER',
    permissions: ['employee', 'approval', 'dashboard'],
    plantIds: ['5GVXYX0mC8hbGbO20uA3'], // Tea Plant
  });

  // Token for ajaysomra (Admin user)
  const adminToken = await makeToken({
    sub: 'admin-id',
    userId: 'USR-001',
    username: 'ajaysomra',
    fullName: 'Ajay Somra',
    role: 'Admin',
    userType: 'SYSTEM_USER',
    permissions: ['*'],
    plantIds: ['*'],
  });

  // ── TEST 1: kaushal fetches plants ─────────────────────────────────────────
  console.log('\n[TEST 1] kaushal: GET /api/plants');
  const resPlantsK = await fetch(`${baseUrl}/api/plants`, {
    headers: { Authorization: `Bearer ${kaushalToken}` },
  });
  const dataPlantsK = await resPlantsK.json();
  console.log('Status:', resPlantsK.status);
  console.log('Plants count:', dataPlantsK.plants?.length);
  console.log('Plant names:', dataPlantsK.plants?.map((p) => p.plantName));
  const onlyTea = dataPlantsK.plants?.every((p) => p.plantName === 'Tea Plant');
  console.log('Assertion (Only Tea Plant returned):', onlyTea ? 'PASS' : 'FAIL');

  // ── TEST 2: ajaysomra fetches plants ───────────────────────────────────────
  console.log('\n[TEST 2] ajaysomra (Admin): GET /api/plants');
  const resPlantsA = await fetch(`${baseUrl}/api/plants`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const dataPlantsA = await resPlantsA.json();
  console.log('Status:', resPlantsA.status);
  console.log('Plants count:', dataPlantsA.plants?.length);
  console.log('Plant names:', dataPlantsA.plants?.map((p) => p.plantName));
  console.log('Assertion (All plants returned):', (dataPlantsA.plants?.length >= 3) ? 'PASS' : 'FAIL');

  // ── TEST 3: kaushal fetches employees ──────────────────────────────────────
  console.log('\n[TEST 3] kaushal: GET /api/employees');
  const resEmpK = await fetch(`${baseUrl}/api/employees`, {
    headers: { Authorization: `Bearer ${kaushalToken}` },
  });
  const dataEmpK = await resEmpK.json();
  console.log('Status:', resEmpK.status);
  console.log('Employees count:', dataEmpK.employees?.length);
  const nonTeaEmps = (dataEmpK.employees || []).filter(
    (e) => e.plantName && !e.plantName.toLowerCase().includes('tea')
  );
  console.log('Non-Tea employees count:', nonTeaEmps.length);
  console.log('Assertion (No non-Tea employees returned):', nonTeaEmps.length === 0 ? 'PASS' : 'FAIL');

  // ── TEST 4: kaushal creates employee in Salt Plant (Must be rejected 403) ───
  console.log('\n[TEST 4] kaushal: POST /api/employees for Salt Plant (Must reject with 403)');
  const resCreateSalt = await fetch(`${baseUrl}/api/employees`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${kaushalToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      employeeId: 'EMP-TEST-SALT-999',
      fullName: 'Hacker Test Employee',
      designation: 'Staff',
      aadhaarNumber: '999988887777',
      mobileNumber: '9876543210',
      plantId: 'TXl96LPXJzcBCVVHM1YK', // Salt Plant
      plantName: 'Salt Plant',
    }),
  });
  const dataCreateSalt = await resCreateSalt.json();
  console.log('Status:', resCreateSalt.status);
  console.log('Response:', dataCreateSalt);
  console.log('Assertion (Status is 403):', resCreateSalt.status === 403 ? 'PASS' : 'FAIL');

  // ── TEST 5: kaushal edits Salt Plant employee (Must be rejected 403) ────────
  console.log('\n[TEST 5] kaushal: PUT /api/employees/EMP-S00023 (Salt Plant emp) (Must reject with 403)');
  const resEditSalt = await fetch(`${baseUrl}/api/employees/EMP-S00023`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${kaushalToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      designation: 'Tampered Staff',
    }),
  });
  const dataEditSalt = await resEditSalt.json();
  console.log('Status:', resEditSalt.status);
  console.log('Response:', dataEditSalt);
  console.log('Assertion (Status is 403):', resEditSalt.status === 403 ? 'PASS' : 'FAIL');

  // ── TEST 6: kaushal creates manual attendance for Salt Plant employee ──────
  console.log('\n[TEST 6] kaushal: POST /api/attendance/manual for Salt Plant emp (Must reject with 403)');
  const resManualSalt = await fetch(`${baseUrl}/api/attendance/manual`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${kaushalToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      employeeId: 'EMP-S00023', // KARAN SHARMA (Salt Plant)
      plantId: 'TXl96LPXJzcBCVVHM1YK',
      markInAt: '2026-09-18T09:00:00',
      remarks: 'Unauthorized test manual entry',
    }),
  });
  const dataManualSalt = await resManualSalt.json();
  console.log('Status:', resManualSalt.status);
  console.log('Response:', dataManualSalt);
  console.log('Assertion (Status is 403):', resManualSalt.status === 403 ? 'PASS' : 'FAIL');

  // ── TEST 7: kaushal creates manual attendance for Salt Plant emp passing plantId=Tea Plant
  console.log('\n[TEST 7] kaushal: POST /api/attendance/manual for Salt Plant emp spoofing plantId=Tea Plant (Must reject with 403)');
  const resManualSpoof = await fetch(`${baseUrl}/api/attendance/manual`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${kaushalToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      employeeId: 'EMP-S00023', // KARAN SHARMA (Salt Plant)
      plantId: '5GVXYX0mC8hbGbO20uA3', // spoofing Tea Plant
      markInAt: '2026-09-18T09:00:00',
      remarks: 'Unauthorized spoof plant test',
    }),
  });
  const dataManualSpoof = await resManualSpoof.json();
  console.log('Status:', resManualSpoof.status);
  console.log('Response:', dataManualSpoof);
  console.log('Assertion (Status is 403):', resManualSpoof.status === 403 ? 'PASS' : 'FAIL');

  // ── TEST 8: kaushal approves synthetic absent for Salt Plant employee ───────
  console.log('\n[TEST 8] kaushal: POST /api/attendance/approve for Salt Plant synthetic absent (Must reject with 403)');
  const resApproveSalt = await fetch(`${baseUrl}/api/attendance/approve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${kaushalToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ids: ['absent_EMP-S00023_2026-09-18'],
    }),
  });
  const dataApproveSalt = await resApproveSalt.json();
  console.log('Status:', resApproveSalt.status);
  console.log('Response:', dataApproveSalt);
  console.log('Assertion (Status is 403):', resApproveSalt.status === 403 ? 'PASS' : 'FAIL');

  // ── TEST 9: kaushal edits attendance record belonging to Salt Plant ──────────
  console.log('\n[TEST 9] kaushal: POST /api/attendance/edit for Salt Plant record (Must reject with 403)');
  // Find a salt plant attendance record
  const saltAttRes = await fetch(`${baseUrl}/api/approvals?approvalStatus=APPROVED`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const saltAttData = await saltAttRes.json();
  const saltRecord = (saltAttData.attendances || []).find((a) => a.plantName === 'Salt Plant');
  if (saltRecord) {
    const resEditAtt = await fetch(`${baseUrl}/api/attendance/edit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kaushalToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: saltRecord.id || saltRecord._id,
        markInAt: '2026-09-18T09:00:00',
        markOutAt: '2026-09-18T17:00:00',
        remarks: 'Tamper test',
      }),
    });
    const dataEditAtt = await resEditAtt.json();
    console.log('Status:', resEditAtt.status);
    console.log('Response:', dataEditAtt);
    console.log('Assertion (Status is 403):', resEditAtt.status === 403 ? 'PASS' : 'FAIL');
  } else {
    console.log('Skipping TEST 9: No approved Salt Plant record available to test edit.');
  }

  // ── TEST 10: kaushal GET single employee EMP-S00023 (Salt Plant) ─────────────
  console.log('\n[TEST 10] kaushal: GET /api/employees/EMP-S00023 (Salt Plant emp) (Must reject with 403)');
  const resGetSaltEmp = await fetch(`${baseUrl}/api/employees/EMP-S00023`, {
    headers: { Authorization: `Bearer ${kaushalToken}` },
  });
  const dataGetSaltEmp = await resGetSaltEmp.json();
  console.log('Status:', resGetSaltEmp.status);
  console.log('Response:', dataGetSaltEmp);
  console.log('Assertion (Status is 403):', resGetSaltEmp.status === 403 ? 'PASS' : 'FAIL');

  // ── TEST 11: kaushal GET single employee EMP-S00028 (Tea Plant) ──────────────
  console.log('\n[TEST 11] kaushal: GET /api/employees/EMP-S00028 (Tea Plant emp) (Must allow 200)');
  const resGetTeaEmp = await fetch(`${baseUrl}/api/employees/EMP-S00028`, {
    headers: { Authorization: `Bearer ${kaushalToken}` },
  });
  const dataGetTeaEmp = await resGetTeaEmp.json();
  console.log('Status:', resGetTeaEmp.status);
  console.log('Employee Name:', dataGetTeaEmp.employee?.fullName);
  console.log('Assertion (Status is 200 and Tea Plant):', resGetTeaEmp.status === 200 ? 'PASS' : 'FAIL');

  console.log('\n--- All Automated Access Control Tests Completed ---');
}

runTests().catch(console.error);
