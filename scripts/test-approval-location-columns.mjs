import assert from 'node:assert';

// Implementation identical to app/approval/page.jsx
const getApprovalMarkInLocation = (record) => {
  const isAbsent = record.status === 'ABSENT' || (!record.markInAt && !record.markOutAt);
  if (isAbsent || !record.markInAt) {
    return '-';
  }

  const isManualIn =
    Boolean(record.markInManualBy) ||
    (Boolean(record.manualAttendanceBy) &&
      !record.markOutManualBy &&
      (record.markOutType === 'Self' || record.markOutType === 'SELF' || !record.markInLatitude || record.markInLatitude === 0));

  if (isManualIn) {
    return 'Manual';
  }

  if (record.markInLocation && record.markInLocation !== 'Location Not Available' && record.markInLocation !== '-') {
    return record.markInLocation;
  }

  if (record.street && typeof record.street === 'string' && record.street.trim() && !/^[-+]?\d*\.?\d+,\s*[-+]?\d*\.?\d+$/.test(record.street.trim())) {
    return record.street.trim();
  }

  if (
    record.markInWithinPlantRadius === true ||
    (record.markInPlantName &&
      record.markInPlantName !== '-' &&
      !record.markInPlantName.toLowerCase().includes('outside'))
  ) {
    return record.markInPlantName;
  }

  if (record.plantName && record.plantName !== '-' && !record.plantName.toLowerCase().includes('outside')) {
    return record.plantName;
  }

  if (record.markInLocation === 'Location Not Available') {
    return 'Location Not Available';
  }

  return 'Location Not Available';
};

const getApprovalMarkOutLocation = (record) => {
  const isAbsent = record.status === 'ABSENT' || (!record.markInAt && !record.markOutAt);
  if (isAbsent) {
    return '-';
  }

  if (!record.markOutAt) {
    return record.status === 'ACTIVE' ? 'Under Process' : '-';
  }

  const rawOutType = String(record.markOutType || '').toUpperCase().trim();
  const isManualOut =
    Boolean(record.markOutManualBy) ||
    rawOutType === 'MANUAL' ||
    Boolean(record.markOutByUserName) ||
    (Boolean(record.manualAttendanceBy) && !record.markInManualBy && (!record.markOutLatitude || record.markOutLatitude === 0));

  if (isManualOut) {
    return 'Manual';
  }

  if (record.markOutLocation && record.markOutLocation !== 'Location Not Available' && record.markOutLocation !== '-') {
    return record.markOutLocation;
  }

  if (
    record.markOutWithinPlantRadius === true ||
    (record.markOutPlantName &&
      record.markOutPlantName !== '-' &&
      !record.markOutPlantName.toLowerCase().includes('outside') &&
      record.markOutPlantName !== 'Auto-Out')
  ) {
    return record.markOutPlantName;
  }

  if (record.markOutLocation === 'Location Not Available' || record.markOutPlantName === 'Auto-Out' || record.autoMarkOut) {
    return 'Location Not Available';
  }

  return 'Location Not Available';
};

console.log('--- Testing Approval Page Location Logic ---');

// Test Case 1: Scenario 1 - Employee Self-Marks IN and OUT
const s1 = {
  status: 'COMPLETED',
  markInAt: '2026-10-09T09:00:00.000Z',
  markOutAt: '2026-10-09T18:00:00.000Z',
  markInLocation: '17, Hapur Bypass Road, Ghaziabad, 201009',
  markOutLocation: '17, Hapur Bypass Road, Ghaziabad, 201009',
  markInLatitude: 28.67,
  markOutLatitude: 28.67,
  markOutType: 'Self',
  markInManualBy: null,
  markOutManualBy: null,
};
assert.strictEqual(getApprovalMarkInLocation(s1), '17, Hapur Bypass Road, Ghaziabad, 201009');
assert.strictEqual(getApprovalMarkOutLocation(s1), '17, Hapur Bypass Road, Ghaziabad, 201009');
console.log('✓ Scenario 1: Self IN & Self OUT passed');

// Test Case 2: Scenario 2 - Admin/User Manually Marks IN and Employee Self-Marks OUT
const s2 = {
  status: 'COMPLETED',
  markInAt: '2026-10-09T09:00:00.000Z',
  markOutAt: '2026-10-09T18:00:00.000Z',
  markInLocation: 'Hapur Plant',
  markOutLocation: '17, Hapur Bypass Road, Ghaziabad, 201009',
  markInLatitude: 0,
  markOutLatitude: 28.67,
  markOutType: 'Self',
  markInManualBy: 'HR Admin',
  markOutManualBy: null,
};
assert.strictEqual(getApprovalMarkInLocation(s2), 'Manual');
assert.strictEqual(getApprovalMarkOutLocation(s2), '17, Hapur Bypass Road, Ghaziabad, 201009');
console.log('✓ Scenario 2: Manual IN & Self OUT passed');

// Test Case 3: Scenario 3 - Employee Self-Marks IN and Admin/User Manually Marks OUT
const s3 = {
  status: 'COMPLETED',
  markInAt: '2026-10-09T09:00:00.000Z',
  markOutAt: '2026-10-09T18:00:00.000Z',
  markInLocation: '17, Hapur Bypass Road, Ghaziabad, 201009',
  markOutLocation: 'Hapur Plant',
  markInLatitude: 28.67,
  markOutLatitude: 0,
  markOutType: 'MANUAL',
  markInManualBy: null,
  markOutManualBy: 'Plant Supervisor',
  manualAttendanceBy: 'Plant Supervisor',
};
assert.strictEqual(getApprovalMarkInLocation(s3), '17, Hapur Bypass Road, Ghaziabad, 201009');
assert.strictEqual(getApprovalMarkOutLocation(s3), 'Manual');
console.log('✓ Scenario 3: Self IN & Manual OUT passed');

// Test Case 4: Scenario 4 - Admin/User Manually Updates Both IN and OUT
const s4 = {
  status: 'COMPLETED',
  markInAt: '2026-10-09T09:00:00.000Z',
  markOutAt: '2026-10-09T18:00:00.000Z',
  markInLocation: 'Hapur Plant',
  markOutLocation: 'Hapur Plant',
  markInLatitude: 0,
  markOutLatitude: 0,
  markOutType: 'MANUAL',
  markInManualBy: 'Admin User',
  markOutManualBy: 'Admin User',
  manualAttendanceBy: 'Admin User',
};
assert.strictEqual(getApprovalMarkInLocation(s4), 'Manual');
assert.strictEqual(getApprovalMarkOutLocation(s4), 'Manual');
console.log('✓ Scenario 4: Manual IN & Manual OUT passed');

// Test Case 5: Scenario 4 (Legacy format) - Admin/User Manually updates both without separate tracking fields
const s4Legacy = {
  status: 'COMPLETED',
  markInAt: '2026-10-09T09:00:00.000Z',
  markOutAt: '2026-10-09T18:00:00.000Z',
  markInLocation: 'Hapur Plant',
  markOutLocation: 'Hapur Plant',
  markInLatitude: 0,
  markOutLatitude: 0,
  markOutType: 'MANUAL',
  manualAttendanceBy: 'Admin User',
};
assert.strictEqual(getApprovalMarkInLocation(s4Legacy), 'Manual');
assert.strictEqual(getApprovalMarkOutLocation(s4Legacy), 'Manual');
console.log('✓ Scenario 4 (Legacy): Manual IN & Manual OUT passed');

// Test Case 6: Absent Record
const sAbsent = {
  status: 'ABSENT',
  markInAt: null,
  markOutAt: null,
  markInLocation: '-',
  markOutLocation: '-',
};
assert.strictEqual(getApprovalMarkInLocation(sAbsent), '-');
assert.strictEqual(getApprovalMarkOutLocation(sAbsent), '-');
console.log('✓ Absent Record passed');

// Test Case 7: Active Session (No Mark Out Yet)
const sActive = {
  status: 'ACTIVE',
  markInAt: '2026-10-09T09:00:00.000Z',
  markOutAt: null,
  markInLocation: 'Main Factory Gate 1',
  markInLatitude: 28.5,
  markOutType: 'Self',
};
assert.strictEqual(getApprovalMarkInLocation(sActive), 'Main Factory Gate 1');
assert.strictEqual(getApprovalMarkOutLocation(sActive), 'Under Process');
console.log('✓ Active Session passed');

// Test Case 8: Self-marked with missing location
const sNoLoc = {
  status: 'COMPLETED',
  markInAt: '2026-10-09T09:00:00.000Z',
  markOutAt: '2026-10-09T18:00:00.000Z',
  markInLocation: 'Location Not Available',
  markOutLocation: 'Location Not Available',
  markInLatitude: 28.5,
  markOutLatitude: 28.5,
  markOutType: 'Self',
};
assert.strictEqual(getApprovalMarkInLocation(sNoLoc), 'Location Not Available');
assert.strictEqual(getApprovalMarkOutLocation(sNoLoc), 'Location Not Available');
console.log('✓ Location Not Available passed (does not display Manual)');

console.log('\nAll 8 test cases passed successfully!');
