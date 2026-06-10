import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DATABASE_NAME = process.env.MONGODB_DB || "sikka_hrms";

// Serverless environments mein connection cache karne ke liye global variable use karte hain
let cachedClient: MongoClient | null = null;
let cachedDb: any = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // Agar naya client banana pad raha hai toh pooling options set karein
  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10, // Max connections in pool
    minPoolSize: 2,  // Keep at least 2 connections alive
    connectTimeoutMS: 5000, // 5 seconds timeout max
  });

  await client.connect();
  const db = client.db(DATABASE_NAME);
  
  cachedClient = client;
  cachedDb = db;
  
  return { client, db };
}

export interface ApprovalPayload {
  recordId?: string;
  firmId: string;
  employeeId: string;
  attendanceDate: string;
  approvedBy: string;
  status: 'APPROVED' | 'REJECTED' | 'Approved' | 'Rejected' | 'RESTORE' | 'EDIT';
  remarks?: string;
  isVirtual?: boolean;
  virtualData?: any;
  updateData?: any;
}

export async function processAttendanceApproval(payload: ApprovalPayload): Promise<boolean> {
  const normalizedStatus = String(payload.status || '').toUpperCase();
  
  // Instant cached connection pooling wrapper call
  const { db } = await connectToDatabase();

  const attendanceCollection = db.collection('attendance');
  const ledgerCollection = db.collection('historyLedger');

  const nowIso = new Date().toISOString();
  const commonFields = {
    status: normalizedStatus === 'APPROVED' ? 'Closed' : (normalizedStatus === 'RESTORE' || normalizedStatus === 'EDIT' ? 'PENDING' : 'ABSENT'),
    approved: normalizedStatus === 'APPROVED',
    approvedBy: (normalizedStatus === 'RESTORE' || normalizedStatus === 'EDIT') ? null : payload.approvedBy,
    approvalActionDate: (normalizedStatus === 'RESTORE' || normalizedStatus === 'EDIT') ? null : nowIso,
    updatedAt: new Date(),
    remarks: normalizedStatus === 'RESTORE' ? null : (payload.remarks || payload.virtualData?.remark || null),
    isLocked: normalizedStatus === 'APPROVED',
  };

  // Advanced exact matching using document _id or composite key fallback
  const filterQuery = payload.recordId && !payload.recordId.startsWith('v-')
    ? { _id: payload.recordId }
    : { employeeId: payload.employeeId, date: payload.attendanceDate };

  // Background execution operations query
  if (payload.isVirtual) {
    await attendanceCollection.updateOne(
      { employeeId: payload.employeeId, date: payload.attendanceDate },
      {
        $set: {
          firmId: payload.firmId,
          employeeId: payload.employeeId,
          employeeName: payload.virtualData?.employeeName || 'Employee',
          date: payload.attendanceDate,
          inDate: payload.attendanceDate,
          attendanceType: payload.virtualData?.attendanceType || 'ABSENT',
          hours: 0,
          unapprovedOutDuration: 0,
          inTime: null,
          outTime: null,
          address: 'System Virtual Absent Log',
          ...commonFields,
          ...(payload.updateData || {})
        }
      },
      { upsert: true }
    );
  } else {
    const res = await attendanceCollection.updateOne(
      filterQuery,
      { $set: { ...(payload.updateData || {}), ...commonFields } }
    );
    console.log(`DB Sync -> Employee: ${payload.employeeId} | Matched: ${res.matchedCount} | Modified: ${res.modifiedCount}`);
  }

  // Log in ledger
  await ledgerCollection.insertOne({
    firmId: payload.firmId,
    action: `ATTENDANCE_${normalizedStatus}`,
    employeeId: payload.employeeId,
    performedBy: payload.approvedBy,
    timestamp: new Date(),
    details: normalizedStatus === 'RESTORE' 
      ? `Attendance log for ${payload.attendanceDate} restored to pending by ${payload.approvedBy}.`
      : normalizedStatus === 'EDIT'
        ? `Attendance log for ${payload.attendanceDate} was manually modified by ${payload.approvedBy}.`
        : `Attendance log for ${payload.attendanceDate} processed.`,
  });

  return true;
}