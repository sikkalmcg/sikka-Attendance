import mongoose from 'mongoose';
import connectToDatabase from '../lib/mongodb.js';
import { formatEmployeeId, getHighestEmployeeIdSerial } from '../lib/employeeIds.js';

if (process.env.RUN_EMPLOYEE_ID_MIGRATION !== '1') {
  throw new Error('Set RUN_EMPLOYEE_ID_MIGRATION=1 after taking the application offline for maintenance.');
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const idFilter = (employeeId) => ({
  employeeId: { $regex: `^${escapeRegex(employeeId)}$`, $options: 'i' },
});

async function createBackup(db, sourceName, backupName, expectedCount) {
  const exists = await db.listCollections({ name: backupName }).hasNext();
  if (exists) throw new Error(`Backup collection already exists: ${backupName}`);

  const sourceExists = await db.listCollections({ name: sourceName }).hasNext();
  if (sourceExists) {
    await db.collection(sourceName).aggregate([{ $match: {} }, { $out: backupName }]).toArray();
  } else {
    await db.createCollection(backupName);
  }
  const backupCount = await db.collection(backupName).countDocuments();
  if (backupCount !== expectedCount) {
    throw new Error(`Backup verification failed for ${sourceName}: expected ${expectedCount}, found ${backupCount}.`);
  }
}

async function ensureUniqueEmployeeIdIndex(collection) {
  const indexes = await collection.listIndexes().toArray();
  const employeeIdIndex = indexes.find((index) => index.key?.employeeId === 1);
  if (employeeIdIndex?.unique) return;
  if (employeeIdIndex) await collection.dropIndex(employeeIdIndex.name);
  await collection.createIndex({ employeeId: 1 }, { unique: true, name: 'employeeId_unique' });
}

async function migrate() {
  await connectToDatabase();
  const db = mongoose.connection.db;
  const employeeCollection = db.collection('employees');
  const attendanceCollection = db.collection('attendance');
  const counterCollection = db.collection('counters');
  const employees = await employeeCollection.find({}, { projection: { _id: 1, employeeId: 1, createdAt: 1 } })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();
  const attendanceCountBefore = await attendanceCollection.countDocuments();
  const previousCounter = await counterCollection.findOne({ _id: 'employee-id' });
  const previousHighestSerial = getHighestEmployeeIdSerial(employees.map((employee) => employee.employeeId));
  const nextSerialFloor = Math.max(
    employees.length,
    previousHighestSerial,
    Number(previousCounter?.sequence) || 0
  );

  const seenIds = new Set();
  for (const employee of employees) {
    const employeeId = String(employee.employeeId || '').trim();
    const normalized = employeeId.toUpperCase();
    if (!employeeId) throw new Error(`Employee ${String(employee._id)} has no Employee ID; migration stopped.`);
    if (seenIds.has(normalized)) throw new Error(`Duplicate Employee ID "${employeeId}" found; migration stopped.`);
    seenIds.add(normalized);
  }

  const mapping = employees.map((employee, index) => ({
    employee,
    oldId: String(employee.employeeId).trim(),
    newId: formatEmployeeId(index + 1),
    temporaryId: `__EMPLOYEE_ID_MIGRATION_${new mongoose.Types.ObjectId()}_${index + 1}`,
  }));
  const targetIds = new Set(mapping.map((item) => item.newId.toUpperCase()));
  const attendanceEmployeeIds = await attendanceCollection.distinct('employeeId');
  for (const attendanceEmployeeId of attendanceEmployeeIds) {
    const normalized = String(attendanceEmployeeId || '').trim().toUpperCase();
    if (targetIds.has(normalized) && !seenIds.has(normalized)) {
      throw new Error(
        `Attendance references unused target ID "${attendanceEmployeeId}"; migration stopped to avoid reassigning orphaned history.`
      );
    }
  }

  const migrationId = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const employeeBackupName = `employee_ids_${migrationId}_employees`;
  const attendanceBackupName = `employee_ids_${migrationId}_attendance`;
  const counterBackupName = `employee_ids_${migrationId}_counters`;

  await createBackup(db, 'employees', employeeBackupName, employees.length);
  await createBackup(db, 'attendance', attendanceBackupName, attendanceCountBefore);
  await createBackup(db, 'counters', counterBackupName, await counterCollection.countDocuments());
  if (!(await db.listCollections({ name: 'counters' }).hasNext())) {
    await db.createCollection('counters');
  }
  await ensureUniqueEmployeeIdIndex(employeeCollection);

  const attendanceCounts = new Map();
  for (const item of mapping) {
    attendanceCounts.set(item.oldId, await attendanceCollection.countDocuments(idFilter(item.oldId)));
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      readPreference: 'primary',
    });

    if (mapping.length) {
      await employeeCollection.bulkWrite(
        mapping.map((item) => ({
          updateOne: {
            filter: { _id: item.employee._id },
            update: { $set: { employeeId: item.temporaryId } },
          },
        })),
        { session }
      );
      await employeeCollection.bulkWrite(
        mapping.map((item) => ({
          updateOne: {
            filter: { _id: item.employee._id },
            update: { $set: { employeeId: item.newId } },
          },
        })),
        { session }
      );
      await attendanceCollection.bulkWrite(
        mapping.map((item) => ({
          updateMany: {
            filter: idFilter(item.oldId),
            update: { $set: { employeeId: item.temporaryId } },
          },
        })),
        { session }
      );
      await attendanceCollection.bulkWrite(
        mapping.map((item) => ({
          updateMany: {
            filter: { employeeId: item.temporaryId },
            update: { $set: { employeeId: item.newId } },
          },
        })),
        { session }
      );
    }

    await counterCollection.updateOne(
      { _id: 'employee-id' },
      { $set: { sequence: nextSerialFloor } },
      { upsert: true, session }
    );

    const employeeCountAfter = await employeeCollection.countDocuments({}, { session });
    const attendanceCountAfter = await attendanceCollection.countDocuments({}, { session });
    if (employeeCountAfter !== employees.length || attendanceCountAfter !== attendanceCountBefore) {
      throw new Error('Post-migration record counts did not match their original values.');
    }

    for (const item of mapping) {
      const employeeCount = await employeeCollection.countDocuments({ employeeId: item.newId }, { session });
      const attendanceCount = await attendanceCollection.countDocuments(
        { employeeId: item.newId },
        { session }
      );
      if (employeeCount !== 1 || attendanceCount !== attendanceCounts.get(item.oldId)) {
        throw new Error(`Relationship verification failed for ${item.oldId} -> ${item.newId}.`);
      }
    }

    await session.commitTransaction();
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }

  console.log(JSON.stringify({
    success: true,
    employeeCount: employees.length,
    attendanceCount: attendanceCountBefore,
    backupCollections: [employeeBackupName, attendanceBackupName, counterBackupName],
    mapping: mapping.map(({ oldId, newId }) => ({ oldId, newId })),
  }, null, 2));
}

migrate()
  .catch((error) => {
    console.error('Employee ID migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
