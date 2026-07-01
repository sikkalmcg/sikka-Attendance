import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://sikkapanindia_db_user:Sikkalmc2105@ac-ngps0di-shard-00-00.hfmiky2.mongodb.net:27017,ac-ngps0di-shard-00-01.hfmiky2.mongodb.net:27017,ac-ngps0di-shard-00-02.hfmiky2.mongodb.net:27017/sikka_database?ssl=true&authSource=admin";
const DATABASE_NAME = process.env.MONGODB_DB || "sikka_database";

let cachedDb: any = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DATABASE_NAME);
  cachedDb = db;
  return db;
}

export async function GET(req: NextRequest) {
  if (req.method !== 'GET') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  try {
    const db = await connectToDatabase();
    const attendanceId = req.nextUrl.searchParams.get('attendanceId');

    // If a specific attendanceId is provided, return the detailed location history for that session.
    if (attendanceId && typeof attendanceId === 'string') {
      const locationRecords = await db.collection('locationHistory')
        .find({ attendanceId: attendanceId })
        .sort({ timestamp: 1 })
        .toArray();

      // The reverse geocoding for the address is done when the record is created
      // or can be done here if not stored. For now, we'll create a placeholder.
      const details = locationRecords.map(async (record) => {
        let address = record.address;
        if (!address && record.latitude && record.longitude) {
           // In a real scenario, you would call a reverse geocoding API here.
           // const geoResponse = await fetch(`https://api.example.com/reverse?lat=${record.latitude}&lon=${record.longitude}`);
           // const geoData = await geoResponse.json();
           // address = geoData.display_name;
           address = `[Address for ${record.latitude.toFixed(4)}, ${record.longitude.toFixed(4)}]`;
        }
        return {
          timestamp: record.timestamp,
          fullAddress: address || 'Address not recorded',
          latitude: record.latitude,
          longitude: record.longitude,
          distanceFromPlant: record.distanceFromPlant,
        };
      });

      return NextResponse.json(await Promise.all(details));
    }

    // If no attendanceId, return the summary of all exit events.
    const pipeline = [
      // 1. Filter for records that mark the start of an exit event.
      { $match: { status: 'Outside Plant' } },
      // 2. Sort by employee, attendance session, and time.
      { $sort: { employeeId: 1, attendanceId: 1, sessionId: 1, timestamp: 1 } },
      // 3. Group by the unique exit session (sessionId) to get event details.
      {
        $group: {
          _id: "$sessionId",
          attendanceId: { $first: "$attendanceId" },
          employeeId: { $first: "$employeeId" },
          exitTime: { $first: "$timestamp" },
          returnTime: { $first: "$returnTimestamp" },
          totalOutsideDuration: { $first: "$totalOutsideDuration" }
        }
      },
      {
        $lookup: {
          from: "attendance",
          localField: "attendanceId",
          foreignField: "id", // Match locationHistory.attendanceId with attendance.id
          as: "attendanceInfo"
        }
      },
      { $unwind: "$attendanceInfo" },
      // 5. Project the final formatted output.
      {
        $project: {
          _id: 0,
          attendanceId: "$attendanceId",
          employee: "$attendanceInfo.employeeName",
          attendanceDate: "$attendanceInfo.date",
          plant: "$attendanceInfo.inPlant",
          markIn: "$attendanceInfo.inTime",
          markOut: "$attendanceInfo.outTime",
          exitTime: "$exitTime",
          returnTime: "$returnTime",
          outsideDuration: "$totalOutsideDuration",
          sessionId: "$_id" // Pass sessionId to the frontend
        }
      },
      { $sort: { attendanceDate: -1, exitTime: -1 } }
    ];

    const exitEvents = await db.collection('locationHistory').aggregate(pipeline).toArray();

    return NextResponse.json(exitEvents);

  } catch (error) {
    console.error("Failed to fetch plant exit history:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}