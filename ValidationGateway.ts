import { MongoClient, ObjectId, Db } from 'mongodb';
import { DecodedIdToken } from 'firebase-admin/auth';

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://sikkapanindia_db_user:Sikkalmc2105@ac-ngps0di-shard-00-00.hfmiky2.mongodb.net:27017,ac-ngps0di-shard-00-01.hfmiky2.mongodb.net:27017,ac-ngps0di-shard-00-02.hfmiky2.mongodb.net:27017/sikka_database?ssl=true&authSource=admin";
const DATABASE_NAME = process.env.MONGODB_DB || "sikka_database";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

async function connectToDatabase(): Promise<Db> {
  if (cachedDb) {
    return cachedDb;
  }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DATABASE_NAME);
  cachedClient = client;
  cachedDb = db;
  return db;
}

export interface AttendanceRequestPayload {
  currentLatitude: number;
  currentLongitude: number;
  action: 'IN' | 'OUT';
  deviceId?: string; 
}

/**
 * Represents the data structure for an Employee document in Firestore.
 */
interface Employee {
  _id: ObjectId;
  isActive: boolean;
  firmId: string;
  plantId: string;
}

interface Plant {
  latitude?: number;
  longitude?: number;
  allowedRadius?: number;
  // Add other employee properties as needed for type safety
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
export async function validationGateway(req: AttendanceRequestPayload, authToken: DecodedIdToken): Promise<boolean> {
  // 1. Extract user info from the authenticated token
  const { firmId, plantId, employeeId, role } = authToken;

  if (role !== 'employee') {
    throw new Error('Validation Failed: Only users with the "employee" role can mark attendance.');
  }

  if (!firmId || !plantId || !employeeId) {
    throw new Error('Validation Failed: Authentication token is missing required claims (firmId, plantId, employeeId).');
  }

  const db = await connectToDatabase();

  // 2. Fetch Employee Record using secure data from the token
  const employee = await db.collection<Employee>('employees').findOne({ 
    _id: new ObjectId(employeeId) 
  });

  if (!employee) {
    throw new Error('Validation Failed: Employee not found.');
  }

  if (!employee.isActive) {
    throw new Error('Validation Failed: Employee account is currently deactivated.');
  }

  // 3. Fetch Plant Record for Location & Radius Validation
  const plant = await db.collection<Plant>('plants').findOne({ 
    _id: new ObjectId(plantId) 
  });

  if (!plant) {
    throw new Error('Validation Failed: Assigned plant not found.');
  }

  if (!plant?.latitude || !plant?.longitude || !plant?.allowedRadius) {
    throw new Error('Validation Failed: Plant location data is incomplete.');
  }

  // 4. GPS Location & Plant Radius Validation
  const distance = getDistanceInMeters(
    req.currentLatitude,
    req.currentLongitude,
    plant.latitude,
    plant.longitude
  );

  if (distance > plant.allowedRadius) {
    throw new Error(`Location Validation Failed: You are ${Math.round(distance)}m away from the plant, which exceeds the allowed radius of ${plant?.allowedRadius}m.`);
  }

  // 5. Attendance Mark IN / Mark OUT validation
  const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
  const todayAttendance = await db.collection('attendance').findOne({
    employeeId: employeeId,
    date: today
  });

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