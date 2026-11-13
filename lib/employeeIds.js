import Counter from '../models/Counter.js';
import Employee from '../models/Employee.js';

const COUNTER_ID = 'employee-id';
const EMPLOYEE_ID_PATTERN = /^EMP-S(\d+)$/i;

export function getHighestEmployeeIdSerial(employeeIds) {
  return employeeIds.reduce((highest, employeeId) => {
    const match = EMPLOYEE_ID_PATTERN.exec(String(employeeId || '').trim());
    if (!match) return highest;
    const serial = Number(match[1]);
    if (!Number.isSafeInteger(serial)) {
      throw new Error(`Employee ID serial "${match[1]}" exceeds the supported safe integer range.`);
    }
    return Math.max(highest, serial);
  }, 0);
}

export function formatEmployeeId(serial) {
  if (!Number.isSafeInteger(serial) || serial < 1) {
    throw new Error('Employee ID serial must be a positive safe integer.');
  }
  return `EMP-S${String(serial).padStart(4, '0')}`;
}

async function getHighestAllocatedSerial() {
  const existingEmployees = await Employee.find({}, { employeeId: 1, _id: 0 }).lean();
  const highestEmployeeSerial = getHighestEmployeeIdSerial(
    existingEmployees.map((employee) => employee.employeeId)
  );
  const counter = await Counter.findById(COUNTER_ID).select('sequence').lean();
  return Math.max(highestEmployeeSerial, Number(counter?.sequence) || 0);
}

export async function getNextEmployeeIdPreview() {
  return formatEmployeeId((await getHighestAllocatedSerial()) + 1);
}

export async function allocateEmployeeId() {
  const highestSerial = await getHighestAllocatedSerial();
  try {
    await Counter.updateOne(
      { _id: COUNTER_ID },
      { $max: { sequence: highestSerial } },
      { upsert: true, setDefaultsOnInsert: false }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    await Counter.updateOne({ _id: COUNTER_ID }, { $max: { sequence: highestSerial } });
  }

  const counter = await Counter.findOneAndUpdate(
    { _id: COUNTER_ID },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: false }
  );
  return formatEmployeeId(counter.sequence);
}
