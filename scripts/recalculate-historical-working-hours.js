import connectToDatabase from '../lib/mongodb.js';
import Attendance from '../models/Attendance.js';
import {
  getRecordMarkInDateTime,
  getRecordMarkOutDateTime,
  calculateWorkingMinutes,
  formatWorkingHours,
  formatKolkataDateTime,
} from '../lib/timezone.js';

async function main() {
  await connectToDatabase();
  console.log('Connected to MongoDB. Starting historical working hours audit and recalculation...');

  const allRecords = await Attendance.find({}).lean();
  console.log(`Found total ${allRecords.length} records.`);

  let updatedCount = 0;
  let emp15Result = null;

  for (const r of allRecords) {
    const isAbsent = r.status === 'ABSENT' || String(r.status).toLowerCase() === 'absent';
    if (isAbsent) continue;

    const inDate = getRecordMarkInDateTime(r);
    const outDate = getRecordMarkOutDateTime(r);

    if (inDate && outDate) {
      const calcMinutes = calculateWorkingMinutes(inDate, outDate);
      const isMismatch = r.workingMinutes !== calcMinutes;
      const needsMarkInAt = !r.markInAt;
      const needsMarkOutAt = !r.markOutAt;

      if (isMismatch || needsMarkInAt || needsMarkOutAt) {
        const updateFields = {
          workingMinutes: calcMinutes,
        };
        if (needsMarkInAt) updateFields.markInAt = inDate;
        if (needsMarkOutAt) updateFields.markOutAt = outDate;

        await Attendance.updateOne({ _id: r._id }, { $set: updateFields });
        updatedCount++;

        if (r.employeeId === 'EMP-S00015' && (r.date === '2026-09-18' || r.inDate === '2026-09-18')) {
          emp15Result = {
            id: r._id,
            employeeId: r.employeeId,
            date: r.date || r.inDate,
            in: inDate.toISOString(),
            inFormatted: formatKolkataDateTime(inDate),
            out: outDate.toISOString(),
            outFormatted: formatKolkataDateTime(outDate),
            previousMinutes: r.workingMinutes,
            updatedMinutes: calcMinutes,
            formattedWorkingHours: formatWorkingHours(calcMinutes),
          };
        }
      }
    }
  }

  console.log(`Recalculation complete. Updated ${updatedCount} records.`);

  if (emp15Result) {
    console.log('\n--- EMP-S00015 Verification ---');
    console.log(JSON.stringify(emp15Result, null, 2));
  } else {
    // Lookup EMP-S00015 to verify directly
    const emp15 = await Attendance.findOne({ employeeId: 'EMP-S00015', inDate: '2026-09-18' }).lean();
    if (emp15) {
      console.log('\n--- EMP-S00015 Current DB State ---');
      console.log({
        id: emp15._id,
        employeeId: emp15.employeeId,
        inDate: emp15.inDate,
        inTime: emp15.inTime,
        markInAt: emp15.markInAt,
        markOutAt: emp15.markOutAt,
        workingMinutes: emp15.workingMinutes,
        display: formatWorkingHours(emp15.workingMinutes),
      });
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Audit and repair failed:', err);
  process.exit(1);
});
