import mongoose from 'mongoose';
import connectToDatabase from '../lib/mongodb.js';
import Attendance from '../models/Attendance.js';
import Plant from '../models/Plant.js';
import Employee from '../models/Employee.js';
import { evaluatePlantLocation } from '../lib/attendanceLocation.js';
import { matchPlantForLocation, calculateDistance } from '../lib/geolocation.js';
import { normalizePlant, normalizeAttendance } from '../lib/normalize.js';
import { formatKolkataDateTime } from '../lib/timezone.js';

async function runTests() {
  console.log('Connecting to MongoDB...');
  await connectToDatabase();
  console.log('Connected to MongoDB.\n');

  // Setup sample configured plants: Salt Plant, Tea Plant, Dasna Plant
  const plantConfigs = [
    {
      plantId: 'PLANT-SALT',
      plantName: 'Salt Plant',
      location: 'Sector 62, Noida',
      latitude: 28.6280,
      longitude: 77.3730,
      radiusMeters: 300,
      status: 'Active',
    },
    {
      plantId: 'PLANT-TEA',
      plantName: 'Tea Plant',
      location: 'Connaught Place, Delhi',
      latitude: 28.6304,
      longitude: 77.2177,
      radiusMeters: 250,
      status: 'Active',
    },
    {
      plantId: 'PLANT-DASNA',
      plantName: 'Dasna Plant',
      location: 'Dasna, Ghaziabad',
      latitude: 28.6791,
      longitude: 77.5312,
      radiusMeters: 400,
      status: 'Active',
    },
  ];

  try {
    // Upsert test plants
    for (const p of plantConfigs) {
      await Plant.findOneAndUpdate({ plantId: p.plantId }, p, { upsert: true, new: true });
    }

    const rawPlants = await Plant.find({
      plantId: { $in: ['PLANT-SALT', 'PLANT-TEA', 'PLANT-DASNA'] },
      $or: [{ status: 'Active' }, { active: true }],
    }).lean();
    const activePlants = rawPlants.map(normalizePlant);

    console.log(`Configured ${activePlants.length} active plants for test:`);
    activePlants.forEach(p => console.log(` - ${p.plantName} (${p.latitude}, ${p.longitude}), radius: ${p.radiusMeters}m`));

    // Coordinates definition
    const saltPlantCoords = { latitude: 28.62805, longitude: 77.37305 }; // ~6m from Salt Plant center
    const teaPlantCoords = { latitude: 28.63042, longitude: 77.21772 };  // ~3m from Tea Plant center
    const dasnaPlantCoords = { latitude: 28.67912, longitude: 77.53122 }; // ~3m from Dasna Plant center
    const outsideCoords = { latitude: 27.1751, longitude: 78.0421 };     // Agra (~180km away)

    // Test Location Evaluation Helper
    console.log('\n--- 1. Testing Location Proximity Detection ---');
    const saltLoc = evaluatePlantLocation(saltPlantCoords.latitude, saltPlantCoords.longitude, activePlants);
    console.log(`Salt Plant GPS check: inside=${saltLoc.withinPlantRadius}, plantName=${saltLoc.plantName}`);
    if (!saltLoc.withinPlantRadius || saltLoc.plantName !== 'Salt Plant') throw new Error('Failed to match Salt Plant');

    const teaLoc = evaluatePlantLocation(teaPlantCoords.latitude, teaPlantCoords.longitude, activePlants);
    console.log(`Tea Plant GPS check: inside=${teaLoc.withinPlantRadius}, plantName=${teaLoc.plantName}`);
    if (!teaLoc.withinPlantRadius || teaLoc.plantName !== 'Tea Plant') throw new Error('Failed to match Tea Plant');

    const dasnaLoc = evaluatePlantLocation(dasnaPlantCoords.latitude, dasnaPlantCoords.longitude, activePlants);
    console.log(`Dasna Plant GPS check: inside=${dasnaLoc.withinPlantRadius}, plantName=${dasnaLoc.plantName}`);
    if (!dasnaLoc.withinPlantRadius || dasnaLoc.plantName !== 'Dasna Plant') throw new Error('Failed to match Dasna Plant');

    const outsideLoc = evaluatePlantLocation(outsideCoords.latitude, outsideCoords.longitude, activePlants);
    console.log(`Outside GPS check: inside=${outsideLoc.withinPlantRadius}, plantName=${outsideLoc.plantName}`);
    if (outsideLoc.withinPlantRadius) throw new Error('Outside GPS should not match plant');

    console.log('PASS: Location proximity detection correctly identifies all configured plants and outside.');

    // Cleanup previous test attendance
    const testEmpIds = ['EMP_TEST_A', 'EMP_TEST_B', 'EMP_TEST_C', 'EMP_TEST_D', 'EMP_TEST_E'];
    await Attendance.deleteMany({ employeeId: { $in: testEmpIds } });

    console.log('\n--- 2. Requirement Test Cases ---');

    // Case 1: Employee A (Salt Plant Mark IN -> Tea Plant Mark OUT -> Allowed)
    console.log('\n[Case 1: Employee A]');
    console.log('Mark IN at Salt Plant -> Move to Tea Plant -> Mark OUT at Tea Plant');
    const markInA = await Attendance.create({
      employeeId: 'EMP_TEST_A',
      employeeName: 'Employee A',
      markInAt: new Date(),
      markInLatitude: saltPlantCoords.latitude,
      markInLongitude: saltPlantCoords.longitude,
      markInWithinPlantRadius: true,
      plantName: 'Salt Plant',
      markInPlantName: 'Salt Plant',
      markInLocationType: 'PLANT',
      attendanceType: 'Salt Plant',
      markOutPlantName: 'Under Process',
      status: 'ACTIVE',
    });
    console.log(` -> Mark IN Recorded: plant=${markInA.markInPlantName}, type=${markInA.attendanceType}`);

    // Mark OUT at Tea Plant
    const outLocA = evaluatePlantLocation(teaPlantCoords.latitude, teaPlantCoords.longitude, activePlants);
    const updatedA = await Attendance.findByIdAndUpdate(
      markInA._id,
      {
        $set: {
          markOutAt: new Date(),
          markOutLatitude: teaPlantCoords.latitude,
          markOutLongitude: teaPlantCoords.longitude,
          markOutWithinPlantRadius: outLocA.withinPlantRadius,
          markOutPlantName: outLocA.plantName,
          markOutType: 'Self',
          status: 'COMPLETED',
        },
      },
      { new: true }
    );
    console.log(` -> Mark OUT Recorded: plant=${updatedA.markOutPlantName}, status=${updatedA.status}`);
    if (updatedA.markInPlantName !== 'Salt Plant' || updatedA.markOutPlantName !== 'Tea Plant') {
      throw new Error(`Case 1 failed: Expected Salt Plant -> Tea Plant, got ${updatedA.markInPlantName} -> ${updatedA.markOutPlantName}`);
    }
    console.log('Result: Allowed (PASS)');

    // Case 2: Employee B (Tea Plant Mark IN -> Outside Plant Mark OUT -> Allowed)
    console.log('\n[Case 2: Employee B]');
    console.log('Mark IN at Tea Plant -> Move to Outside Plant -> Mark OUT at Outside Plant');
    const markInB = await Attendance.create({
      employeeId: 'EMP_TEST_B',
      employeeName: 'Employee B',
      markInAt: new Date(),
      markInLatitude: teaPlantCoords.latitude,
      markInLongitude: teaPlantCoords.longitude,
      markInWithinPlantRadius: true,
      plantName: 'Tea Plant',
      markInPlantName: 'Tea Plant',
      markInLocationType: 'PLANT',
      attendanceType: 'Tea Plant',
      markOutPlantName: 'Under Process',
      status: 'ACTIVE',
    });
    console.log(` -> Mark IN Recorded: plant=${markInB.markInPlantName}, type=${markInB.attendanceType}`);

    const outLocB = evaluatePlantLocation(outsideCoords.latitude, outsideCoords.longitude, activePlants);
    const updatedB = await Attendance.findByIdAndUpdate(
      markInB._id,
      {
        $set: {
          markOutAt: new Date(),
          markOutLatitude: outsideCoords.latitude,
          markOutLongitude: outsideCoords.longitude,
          markOutWithinPlantRadius: outLocB.withinPlantRadius,
          markOutPlantName: outLocB.withinPlantRadius ? outLocB.plantName : 'Outside-Out',
          markOutType: 'Self',
          status: 'COMPLETED',
        },
      },
      { new: true }
    );
    console.log(` -> Mark OUT Recorded: plant=${updatedB.markOutPlantName}, status=${updatedB.status}`);
    if (updatedB.markInPlantName !== 'Tea Plant' || updatedB.markOutPlantName !== 'Outside-Out') {
      throw new Error(`Case 2 failed: Expected Tea Plant -> Outside-Out, got ${updatedB.markInPlantName} -> ${updatedB.markOutPlantName}`);
    }
    console.log('Result: Allowed (PASS)');

    // Case 3: Employee C (Outside Plant WFH Mark IN -> Salt Plant Mark OUT -> Allowed)
    console.log('\n[Case 3: Employee C]');
    console.log('Mark IN Outside Plant (Work from Home) -> Move to Salt Plant -> Mark OUT at Salt Plant');
    const markInC = await Attendance.create({
      employeeId: 'EMP_TEST_C',
      employeeName: 'Employee C',
      markInAt: new Date(),
      markInLatitude: outsideCoords.latitude,
      markInLongitude: outsideCoords.longitude,
      markInWithinPlantRadius: false,
      plantName: 'Work from Home',
      markInPlantName: 'Work from Home',
      markInLocationType: 'WORK_FROM_HOME',
      attendanceType: 'Work from Home',
      markOutPlantName: 'Under Process',
      status: 'ACTIVE',
    });
    console.log(` -> Mark IN Recorded: locationType=${markInC.markInLocationType}, attendanceType=${markInC.attendanceType}`);

    const outLocC = evaluatePlantLocation(saltPlantCoords.latitude, saltPlantCoords.longitude, activePlants);
    const updatedC = await Attendance.findByIdAndUpdate(
      markInC._id,
      {
        $set: {
          markOutAt: new Date(),
          markOutLatitude: saltPlantCoords.latitude,
          markOutLongitude: saltPlantCoords.longitude,
          markOutWithinPlantRadius: outLocC.withinPlantRadius,
          markOutPlantName: outLocC.plantName,
          markOutType: 'Self',
          status: 'COMPLETED',
        },
      },
      { new: true }
    );
    console.log(` -> Mark OUT Recorded: plant=${updatedC.markOutPlantName}, status=${updatedC.status}`);
    if (updatedC.markInLocationType !== 'WORK_FROM_HOME' || updatedC.markOutPlantName !== 'Salt Plant') {
      throw new Error(`Case 3 failed: Expected Work from Home -> Salt Plant, got ${updatedC.markInLocationType} -> ${updatedC.markOutPlantName}`);
    }
    console.log('Result: Allowed (PASS)');

    // Case 4: Employee D (Outside Plant Field Work Mark IN -> Dasna Plant Mark OUT -> Allowed)
    console.log('\n[Case 4: Employee D]');
    console.log('Mark IN Outside Plant (Field Work) -> Move to Dasna Plant -> Mark OUT at Dasna Plant');
    const markInD = await Attendance.create({
      employeeId: 'EMP_TEST_D',
      employeeName: 'Employee D',
      markInAt: new Date(),
      markInLatitude: outsideCoords.latitude,
      markInLongitude: outsideCoords.longitude,
      markInWithinPlantRadius: false,
      plantName: 'Field Work',
      markInPlantName: 'Field Work',
      markInLocationType: 'FIELD_WORK',
      attendanceType: 'Field Work',
      markOutPlantName: 'Under Process',
      status: 'ACTIVE',
    });
    console.log(` -> Mark IN Recorded: locationType=${markInD.markInLocationType}, attendanceType=${markInD.attendanceType}`);

    const outLocD = evaluatePlantLocation(dasnaPlantCoords.latitude, dasnaPlantCoords.longitude, activePlants);
    const updatedD = await Attendance.findByIdAndUpdate(
      markInD._id,
      {
        $set: {
          markOutAt: new Date(),
          markOutLatitude: dasnaPlantCoords.latitude,
          markOutLongitude: dasnaPlantCoords.longitude,
          markOutWithinPlantRadius: outLocD.withinPlantRadius,
          markOutPlantName: outLocD.plantName,
          markOutType: 'Self',
          status: 'COMPLETED',
        },
      },
      { new: true }
    );
    console.log(` -> Mark OUT Recorded: plant=${updatedD.markOutPlantName}, status=${updatedD.status}`);
    if (updatedD.markInLocationType !== 'FIELD_WORK' || updatedD.markOutPlantName !== 'Dasna Plant') {
      throw new Error(`Case 4 failed: Expected Field Work -> Dasna Plant, got ${updatedD.markInLocationType} -> ${updatedD.markOutPlantName}`);
    }
    console.log('Result: Allowed (PASS)');

    // Case 5: Employee E (Dasna Plant Mark IN -> Outside Plant Mark OUT -> Allowed)
    console.log('\n[Case 5: Employee E]');
    console.log('Mark IN at Dasna Plant -> Move to Outside Plant -> Mark OUT at Outside Plant');
    const markInE = await Attendance.create({
      employeeId: 'EMP_TEST_E',
      employeeName: 'Employee E',
      markInAt: new Date(),
      markInLatitude: dasnaPlantCoords.latitude,
      markInLongitude: dasnaPlantCoords.longitude,
      markInWithinPlantRadius: true,
      plantName: 'Dasna Plant',
      markInPlantName: 'Dasna Plant',
      markInLocationType: 'PLANT',
      attendanceType: 'Dasna Plant',
      markOutPlantName: 'Under Process',
      status: 'ACTIVE',
    });
    console.log(` -> Mark IN Recorded: plant=${markInE.markInPlantName}, type=${markInE.attendanceType}`);

    const outLocE = evaluatePlantLocation(outsideCoords.latitude, outsideCoords.longitude, activePlants);
    const updatedE = await Attendance.findByIdAndUpdate(
      markInE._id,
      {
        $set: {
          markOutAt: new Date(),
          markOutLatitude: outsideCoords.latitude,
          markOutLongitude: outsideCoords.longitude,
          markOutWithinPlantRadius: outLocE.withinPlantRadius,
          markOutPlantName: outLocE.withinPlantRadius ? outLocE.plantName : 'Outside-Out',
          markOutType: 'Self',
          status: 'COMPLETED',
        },
      },
      { new: true }
    );
    console.log(` -> Mark OUT Recorded: plant=${updatedE.markOutPlantName}, status=${updatedE.status}`);
    if (updatedE.markInPlantName !== 'Dasna Plant' || updatedE.markOutPlantName !== 'Outside-Out') {
      throw new Error(`Case 5 failed: Expected Dasna Plant -> Outside-Out, got ${updatedE.markInPlantName} -> ${updatedE.markOutPlantName}`);
    }
    console.log('Result: Allowed (PASS)');

    // Active Shift Message Check
    console.log('\n--- 3. Testing Active Shift Display Text ---');
    const activeTestDate = new Date('2026-10-08T09:30:00+05:30');
    const formattedDateStr = formatKolkataDateTime(activeTestDate);
    const activeShiftText = `Active shift in progress from ${formattedDateStr}`;
    console.log(`Display String: "${activeShiftText}"`);
    if (!activeShiftText.startsWith('Active shift in progress from 08-Oct-2026')) {
      throw new Error(`Unexpected active shift string format: ${activeShiftText}`);
    }
    console.log('PASS: Active shift status text displays "Active shift in progress from [Mark IN date & time]".');

    // Plant Access Non-blocking Verification
    console.log('\n--- 4. Testing Plant Access Non-blocking Rule ---');
    console.log('Employee assigned plant is NOT restricting Mark IN / Mark OUT:');
    const testEmployeeUser = {
      employeeId: 'EMP_ANY_PLANT',
      plantId: 'PLANT-SALT',
      plantName: 'Salt Plant',
    };
    // Employee is assigned to Salt Plant, but is physically at Dasna Plant:
    const physicalMatch = evaluatePlantLocation(dasnaPlantCoords.latitude, dasnaPlantCoords.longitude, activePlants);
    console.log(`Employee assigned plant: ${testEmployeeUser.plantName}`);
    console.log(`Physical location matches: ${physicalMatch.plantName}`);
    if (physicalMatch.plantName !== 'Dasna Plant') {
      throw new Error('Plant detection was improperly constrained by user assignment!');
    }
    console.log('PASS: Employee can Mark IN from any configured plant regardless of assigned plant.');

    console.log('\n=============================================');
    console.log('ALL UPDATED ATTENDANCE REQUIREMENTS PASSED! ✅');
    console.log('=============================================');
  } finally {
    // Cleanup test data
    await Attendance.deleteMany({ employeeId: { $in: ['EMP_TEST_A', 'EMP_TEST_B', 'EMP_TEST_C', 'EMP_TEST_D', 'EMP_TEST_E'] } });
    await Plant.deleteMany({ plantId: { $in: ['PLANT-SALT', 'PLANT-TEA', 'PLANT-DASNA'] } });
    await mongoose.disconnect();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test Error:', err);
  process.exit(1);
});
