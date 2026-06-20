import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DATABASE_NAME = process.env.MONGODB_DB || "sikka_hrms";

let cachedClient: MongoClient | null = null;
let cachedDb: any = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10,
    minPoolSize: 2,
    connectTimeoutMS: 5000,
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
  const { db } = await connectToDatabase();

  const attendanceCollection = db.collection('attendance');
  const ledgerCollection = db.collection('historyLedger');

  // FIXED PARAMETER CHECKER: Ensures recordId matches true string lengths layout rules without throwing exceptions
  let parsedRecordId: any = payload.recordId;
  if (payload.recordId && typeof payload.recordId === 'string' && ObjectId.isValid(payload.recordId) && payload.recordId.length === 24) {
    parsedRecordId = new ObjectId(payload.recordId);
  }

  const nowIso = new Date().toISOString();
  const commonFields = {
    status: normalizedStatus === 'APPROVED' ? 'Closed' : (normalizedStatus === 'RESTORE' || normalizedStatus === 'EDIT' ? 'PENDING' : 'ABSENT'),
    approved: normalizedStatus === 'APPROVED' || normalizedStatus === 'REJECTED',
    approvedBy: (normalizedStatus === 'RESTORE' || normalizedStatus === 'EDIT') ? null : payload.approvedBy,
    approvalActionDate: (normalizedStatus === 'RESTORE' || normalizedStatus === 'EDIT') ? null : nowIso,
    updatedAt: new Date(),
    remarks: normalizedStatus === 'RESTORE' ? null : (payload.remarks || payload.virtualData?.remark || null),
    isLocked: normalizedStatus === 'APPROVED' || normalizedStatus === 'REJECTED',
  };

  // FIXED QUERY MAPPER: Resolves conditional fallbacks to select correct mapping query index nodes
  const filterQuery = payload.recordId && typeof payload.recordId === 'string' && !payload.recordId.startsWith('v-') && ObjectId.isValid(payload.recordId)
    ? { _id: parsedRecordId }
    : { employeeId: payload.employeeId, date: payload.attendanceDate };

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
    await attendanceCollection.updateOne(
      filterQuery,
      { $set: { ...(payload.updateData || {}), ...commonFields } }
    );
  }

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