import connectToDatabase from '../lib/mongodb.js';
import Employee from '../models/Employee.js';
import mongoose from 'mongoose';

async function testLookup() {
  await connectToDatabase();

  // Get first few employees to test
  const allEmps = await Employee.find({}).limit(5).lean();

  console.log('Testing findEmployeeById with actual _id strings from DB:\n');

  for (const emp of allEmps) {
    const rawId = String(emp._id);

    // Simulate the new findEmployeeById logic
    const conditions = [
      { _id: rawId },
      { id: rawId },
      { employeeId: rawId },
    ];

    if (mongoose.Types.ObjectId.isValid(rawId) && String(new mongoose.Types.ObjectId(rawId)) === rawId) {
      conditions.unshift({ _id: new mongoose.Types.ObjectId(rawId) });
      console.log(`${rawId} — valid ObjectId, added ObjectId cast`);
    }

    const found = await Employee.findOne({ $or: conditions });
    const status = found ? '✅ FOUND' : '❌ NOT FOUND';
    console.log(`  _id="${rawId}", employeeId="${emp.employeeId}" → ${status} (matched: ${found?.employeeId})`);
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

testLookup().catch(err => { console.error(err); process.exit(1); });
