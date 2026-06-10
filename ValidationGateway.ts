import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

export interface AttendanceRequestPayload {
  firmId: string;
  plantId: string;
  employeeId: string;
  aadhaarNumber: string;
  mobileNumber: string;
  currentLatitude: number;
  currentLongitude: number;
  action: 'IN' | 'OUT';
  deviceId?: string; 
}

/**
 * Uses the Haversine formula to calculate the distance between two GPS coordinates in meters.
 */
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Employee Validation Gateway 
 * Executes all rules prior to allowing an Attendance Mark IN/OUT
 */
export async function validationGateway(req: AttendanceRequestPayload): Promise<boolean> {
  // 1. Fetch Employee Record
  const employeeRef = db.collection('firms').doc(req.firmId).collection('employees').doc(req.employeeId);
  const employeeSnap = await employeeRef.get();

  if (!employeeSnap.exists) {
    throw new Error('Validation Failed: Employee not found.');
  }

  const employee = employeeSnap.data();

  if (!employee?.isActive) {
    throw new Error('Validation Failed: Employee account is currently deactivated.');
  }

  // 2. Aadhaar & Mobile Number Validation
  if (employee.aadhaarNumber !== req.aadhaarNumber) {
    throw new Error('Validation Failed: Aadhaar Number does not match our records.');
  }
  if (employee.mobileNumber !== req.mobileNumber) {
    throw new Error('Validation Failed: Mobile Number does not match our records.');
  }

  // 3. Fetch Plant Record for Location & Radius Validation
  const plantRef = db.collection('firms').doc(req.firmId).collection('plants').doc(req.plantId);
  const plantSnap = await plantRef.get();

  if (!plantSnap.exists) {
    throw new Error('Validation Failed: Assigned plant not found.');
  }

  const plant = plantSnap.data();

  // 4. GPS Location & Plant Radius Validation
  const distance = getDistanceInMeters(
    req.currentLatitude,
    req.currentLongitude,
    plant?.latitude,
    plant?.longitude
  );

  if (distance > plant?.allowedRadius) {
    throw new Error(`Location Validation Failed: You are ${Math.round(distance)}m away from the plant, which exceeds the allowed radius of ${plant?.allowedRadius}m.`);
  }

  // 5. Attendance Mark IN / Mark OUT validation
  const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
  const attendanceQuery = await employeeRef.collection('attendance').where('date', '==', today).get();
  
  const todayAttendance = attendanceQuery.docs.length > 0 ? attendanceQuery.docs[0].data() : null;

  if (req.action === 'IN') {
    if (todayAttendance && todayAttendance.inTime) {
      throw new Error('Validation Failed: You have already marked IN for today.');
    }
  } else if (req.action === 'OUT') {
    if (!todayAttendance || !todayAttendance.inTime) {
      throw new Error('Validation Failed: Cannot mark OUT without marking IN first.');
    }
    if (todayAttendance.outTime) {
      throw new Error('Validation Failed: You have already marked OUT for today.');
    }
  }

  // Note: 6. Device Validation can be implemented here if you choose to bind Device UUIDs to the Employee Schema in the future.

  return true; // All Gateway Rules Passed
}