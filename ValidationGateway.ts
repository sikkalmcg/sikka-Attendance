import { MongoClient, ObjectId, Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export interface AttendanceRequestPayload {
  employeeId: string;
  currentLatitude?: number;
  currentLongitude?: number;
  action: 'IN' | 'OUT';
  deviceId?: string;
  plantId?: string;
  role?: string;
}

export interface GatewayValidationResult {
  valid: boolean;
  message?: string;
  employee?: any;
}

/**
 * Employee Validation Gateway (100% MongoDB Native)
 * Validates attendance requests and ensures background shift reminders
 * and notifications flow smoothly without external Firebase dependencies.
 */
export async function validationGateway(req: AttendanceRequestPayload): Promise<GatewayValidationResult> {
  const { employeeId, action } = req;

  if (!employeeId) {
    return { valid: false, message: 'Validation Failed: Missing employeeId.' };
  }

  const db = await getDb();
  if (!db) {
    return { valid: false, message: 'Validation Failed: Database unavailable.' };
  }

  // 1. Fetch Employee Record
  const employee = await db.collection('employees').findOne({
    $or: [
      { employeeId },
      { id: employeeId },
      { username: employeeId },
      { mobile: employeeId },
      { aadhaar: employeeId },
    ],
  });

  if (!employee) {
    return { valid: false, message: 'Validation Failed: Employee record not found in system.' };
  }

  if (employee.active === false || employee.isActive === false) {
    return { valid: false, message: 'Validation Failed: Employee account is currently deactivated.' };
  }

  // 2. Attendance Mark IN / Mark OUT Validation
  const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
  const resolvedEmpId = employee.employeeId || employeeId;

  const todayAttendance = await db.collection('attendance').findOne({
    employeeId: resolvedEmpId,
    date: today,
  });

  if (action === 'IN') {
    if (todayAttendance && todayAttendance.inTime) {
      return { valid: false, message: 'Validation Failed: You have already marked IN for today.' };
    }
  } else if (action === 'OUT') {
    if (!todayAttendance || !todayAttendance.inTime) {
      return { valid: false, message: 'Validation Failed: Cannot mark OUT without marking IN first.' };
    }
    if (todayAttendance.outTime) {
      return { valid: false, message: 'Validation Failed: You have already marked OUT for today.' };
    }
  }

  return { valid: true, employee };
}