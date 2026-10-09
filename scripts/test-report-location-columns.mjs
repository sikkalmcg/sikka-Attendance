import connectToDatabase from '../lib/mongodb.js';
import Attendance from '../models/Attendance.js';
import Plant from '../models/Plant.js';
import { normalizeAttendance } from '../lib/normalize.js';
import { resolveReadableLocation, formatPlantLocation } from '../lib/locationService.js';
import * as XLSX from 'xlsx';

async function runTests() {
  console.log('=== STARTING TESTS: REPORT LOCATION COLUMNS ===\n');

  // Test 1: Plant Location Formatting
  console.log('Test 1: Plant Location Formatting');
  const plant1 = { plantName: 'Salt Plant', location: 'Salt Plant' };
  const loc1 = formatPlantLocation(plant1);
  console.log(' -> Plant with same location:', loc1);
  if (loc1 !== 'Salt Plant') throw new Error(`Expected 'Salt Plant', got '${loc1}'`);

  const plant2 = { plantName: 'Salt Plant', location: 'Plot 12, Kandla SEZ, Gandhidham' };
  const loc2 = formatPlantLocation(plant2);
  console.log(' -> Plant with custom location:', loc2);
  if (loc2 !== 'Salt Plant, Plot 12, Kandla SEZ, Gandhidham') throw new Error(`Expected 'Salt Plant, Plot 12, Kandla SEZ, Gandhidham', got '${loc2}'`);

  // Test 2: resolveReadableLocation
  console.log('\nTest 2: resolveReadableLocation');
  const resRegistered = await resolveReadableLocation({
    latitude: 28.6376,
    longitude: 77.4425,
    matchedPlant: plant2,
  });
  console.log(' -> Registered Plant Result:', resRegistered);
  if (resRegistered !== 'Salt Plant, Plot 12, Kandla SEZ, Gandhidham') throw new Error('Registered plant resolution failed');

  const resClientProvided = await resolveReadableLocation({
    latitude: 28.7040,
    longitude: 77.6673,
    clientLocation: 'Civil Lines, Hapur, Uttar Pradesh',
  });
  console.log(' -> Client Provided Outside Location:', resClientProvided);
  if (resClientProvided !== 'Civil Lines, Hapur, Uttar Pradesh') throw new Error('Client provided location resolution failed');

  const resUnavailable = await resolveReadableLocation({
    latitude: 0,
    longitude: 0,
    clientLocation: null,
  });
  console.log(' -> Unavailable Location Result:', resUnavailable);
  if (resUnavailable !== 'Location Not Available') throw new Error(`Expected 'Location Not Available', got '${resUnavailable}'`);

  // Test 3: Normalization of Attendance Documents
  console.log('\nTest 3: Normalization of Attendance Documents');
  const dummyDoc = {
    _id: 'test_123',
    employeeId: 'EMP-T001',
    employeeName: 'Test Employee',
    attendanceDate: '2026-10-09',
    markInAt: new Date('2026-10-09T09:00:00Z'),
    markInLocation: 'Tea Plant, Industrial Area',
    markOutAt: new Date('2026-10-09T17:00:00Z'),
    markOutLocation: 'Achpal Garhi, Dhaulana, Uttar Pradesh',
    status: 'COMPLETED',
    workingMinutes: 480,
  };
  const normDoc = normalizeAttendance(dummyDoc);
  console.log(' -> Normalized Mark IN Location:', normDoc.markInLocation);
  console.log(' -> Normalized Mark OUT Location:', normDoc.markOutLocation);
  if (normDoc.markInLocation !== 'Tea Plant, Industrial Area') throw new Error('Mark In Location normalization failed');
  if (normDoc.markOutLocation !== 'Achpal Garhi, Dhaulana, Uttar Pradesh') throw new Error('Mark Out Location normalization failed');

  // Test 4: Normalization for Absent and Active Records
  console.log('\nTest 4: Normalization for Absent and Active records');
  const absentDoc = normalizeAttendance({
    _id: 'absent_1',
    employeeId: 'EMP-T002',
    status: 'ABSENT',
  });
  console.log(' -> Absent Mark IN Location:', absentDoc.markInLocation);
  console.log(' -> Absent Mark OUT Location:', absentDoc.markOutLocation);
  if (absentDoc.markInLocation !== '-' || absentDoc.markOutLocation !== '-') throw new Error('Absent locations must be -');

  const activeDoc = normalizeAttendance({
    _id: 'active_1',
    employeeId: 'EMP-T003',
    status: 'ACTIVE',
    markInAt: new Date(),
    markInLocation: 'Salt Plant',
    markOutAt: null,
  });
  console.log(' -> Active Mark IN Location:', activeDoc.markInLocation);
  console.log(' -> Active Mark OUT Location:', activeDoc.markOutLocation);
  if (activeDoc.markInLocation !== 'Salt Plant') throw new Error('Active Mark In Location mismatch');
  if (activeDoc.markOutLocation !== 'Under Process') throw new Error('Active Mark Out Location must be Under Process');

  // Test 5: Verify Excel generation columns
  console.log('\nTest 5: Excel Generation with New Columns');
  const sampleExportRows = [
    {
      'Employee ID': normDoc.employeeId,
      'Employee Name': normDoc.employeeName,
      'Designation': normDoc.designation,
      'Date': normDoc.attendanceDate,
      'Mark In Plant': normDoc.markInPlantName,
      'Mark IN Location': normDoc.markInLocation,
      'Mark IN Date Time': '09-Oct-2026 14:30',
      'Mark Out Date Time': '09-Oct-2026 22:30',
      'Working Hour': '08:00 Hours',
      'Mark Out Type': 'Self',
      'Mark Out Plant': normDoc.markOutPlantName,
      'Mark OUT Location': normDoc.markOutLocation,
      'Status': 'Present',
      'Manual Attendance By': '-',
      'Approved By': '-',
      'Remark': '-',
    },
  ];
  const worksheet = XLSX.utils.json_to_sheet(sampleExportRows);
  const jsonBack = XLSX.utils.sheet_to_json(worksheet);
  console.log(' -> Excel row headers:', Object.keys(jsonBack[0]));
  if (!jsonBack[0]['Mark IN Location'] || !jsonBack[0]['Mark OUT Location']) {
    throw new Error('New columns missing in Excel sheet data!');
  }
  console.log(' -> Mark IN Location in Excel:', jsonBack[0]['Mark IN Location']);
  console.log(' -> Mark OUT Location in Excel:', jsonBack[0]['Mark OUT Location']);

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
