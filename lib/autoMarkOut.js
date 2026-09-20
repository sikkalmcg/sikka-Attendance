import connectToDatabase from './mongodb.js';
import Attendance from '../models/Attendance.js';
import { getRecordMarkInDateTime } from './timezone.js';

/**
 * Executes 18-hour auto-mark-out process.
 * Finds all attendance sessions where status is ACTIVE
 * and the Mark IN time was more than 18 hours ago.
 * Sets:
 *  - markOutAt = markInAt + 18 hours
 *  - workingMinutes = 18 * 60 = 1080 (18:00 Hours)
 *  - markOutType = 'Auto-Out'
 *  - markOutPlantName = 'Auto-Out'
 *  - autoMarkOut = true
 *  - status = 'AUTO_COMPLETED'
 *
 * Conflict Protection: Uses atomic findOneAndUpdate requiring markOutAt to be null
 * and status to be active, preventing overwriting if a manual mark-out occurs concurrently.
 *
 * @returns {Promise<{ processedCount: number, affectedIds: string[] }>}
 */
let lastRunTimestamp = 0;
const THROTTLE_MS = 60 * 1000; // 1 minute throttle for repeated API calls

export async function processAutoMarkOut(force = false) {
  const now = Date.now();
  if (!force && now - lastRunTimestamp < THROTTLE_MS) {
    return { processedCount: 0, affectedIds: [] };
  }
  lastRunTimestamp = now;

  await connectToDatabase();

  const EIGHTEEN_HOURS_MS = 18 * 60 * 60 * 1000;
  const cutoffTime = new Date(Date.now() - EIGHTEEN_HOURS_MS);

  // Find active records where markInAt <= cutoffTime or inDateTime <= cutoffTime
  const expiredSessions = await Attendance.find({
    status: { $in: ['ACTIVE', 'Active', 'Open', 'OPEN'] },
    markOutAt: null,
    $or: [
      { markInAt: { $lte: cutoffTime } },
      { inDateTime: { $lte: cutoffTime } },
    ],
  });

  if (expiredSessions.length === 0) {
    return { processedCount: 0, affectedIds: [] };
  }

  const affectedIds = [];

  for (const session of expiredSessions) {
    const markInDate = getRecordMarkInDateTime(session) || (session.markInAt ? new Date(session.markInAt) : new Date());
    // Auto Mark OUT Date Time = Mark IN Date Time + 18 Hours
    const autoOutTime = new Date(markInDate.getTime() + EIGHTEEN_HOURS_MS);

    // Atomic / database-safe update: ensures manual Mark OUT has not already been completed
    const updated = await Attendance.findOneAndUpdate(
      {
        _id: session._id,
        status: { $in: ['ACTIVE', 'Active', 'Open', 'OPEN'] },
        markOutAt: null,
      },
      {
        $set: {
          markInAt: session.markInAt || markInDate,
          markOutAt: autoOutTime,
          workingMinutes: 18 * 60, // Exactly 1080 minutes (18:00 Hours)
          markOutType: 'Auto-Out',
          markOutPlantName: 'Auto-Out',
          markOutPlantId: null,
          autoMarkOut: true,
          status: 'AUTO_COMPLETED',
          remarks: session.remarks || 'Auto marked out by system after 18 hours (18:00 Hours recorded)',
        },
      },
      { new: true }
    );

    if (updated) {
      affectedIds.push(session._id ? session._id.toString() : session.id);
    }
  }

  return {
    processedCount: affectedIds.length,
    affectedIds,
  };
}
