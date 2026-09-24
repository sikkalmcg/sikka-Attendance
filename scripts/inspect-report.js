import connectToDatabase from '../lib/mongodb.js';
import Employee from '../models/Employee.js';

async function main() {
  await connectToDatabase();
  const emps = await Employee.find({
    employeeId: { $in: ['EMP-S00014', 'EMP-S00015', 'EMP-S00016', 'EMP-S00017', 'EMP-S00034'] }
  }).lean();
  console.log('Employees found:');
  for (const e of emps) {
    console.log({
      id: e._id,
      employeeId: e.employeeId,
      name: e.name,
      fullName: e.fullName,
      firstName: e.firstName,
      lastName: e.lastName,
      designation: e.designation,
    });
  }
  process.exit(0);
}

main().catch(console.error);
