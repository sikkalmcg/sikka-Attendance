import connectToDatabase from './mongodb.js';
import Attendance from '../models/Attendance.js';
import { getRecordMarkInDateTime } from './timezone.js';

/**
 * Executes 18-hour auto-mark-out process.
 * Finds all attendance sessions where status is ACTIVE
 * and 18 hours have elapsed from Mark In.
 *
 * Rules:
 * 1. Checks whether 18 hours have elapsed from Mark In.
 * 2. If the employee has already manually Marked Out before 18 hours,
 *    keep the actual manual Mark Out date/time. No Auto Mark Out happens.
 * 3. If the employee has not Marked Out manually when 18 hours are completed,
 *    the system performs Auto Mark Out.
 * 4. Auto-Out Trigger Time = Mark In Date Time + 18 hours (when 18-hour limit is reached).
 * 5. Saved Mark Out Date Time = Mark In Date Time + 8 hours.
 * 6. Working Hours = 8:00 (workingMinutes = 480).
 * 7. Mark Out Type = 'Auto-Out'.
 * 8. Mark Out Plant = 'Auto-Out'.
 *
 * Conflict Protection: Uses atomic findOneAndUpdate requiring markOutAt to be null
 * and status to be active, preventing overwriting if a manual mark-out occurred.
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
  const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
  const cutoffTime = new Date(Date.now() - EIGHTEEN_HOURS_MS);

  // Find active records where markInAt <= cutoffTime or inDateTime <= cutoffTime or createdAt <= cutoffTime
  const expiredSessions = await Attendance.find({
    status: { $in: ['ACTIVE', 'Active', 'Open', 'OPEN'] },
    markOutAt: null,
    $or: [
      { markInAt: { $lte: cutoffTime } },
      { inDateTime: { $lte: cutoffTime } },
      { createdAt: { $lte: cutoffTime } },
    ],
  });

  if (expiredSessions.length === 0) {
    return { processedCount: 0, affectedIds: [] };
  }

  const affectedIds = [];

  for (const session of expiredSessions) {
    const markInDate = getRecordMarkInDateTime(session) || (session.markInAt ? new Date(session.markInAt) : null);
    if (!markInDate) continue;

    const triggerTimeMs = markInDate.getTime() + EIGHTEEN_HOURS_MS;
    // Ensure 18 hours have actually elapsed
    if (triggerTimeMs > Date.now()) {
      continue;
    }

    const autoOutTriggerTime = new Date(triggerTimeMs);
    // Saved Mark Out Date Time must be Mark In Date Time + 8 hours
    const autoOutTime = new Date(markInDate.getTime() + EIGHT_HOURS_MS);

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
          autoOutTriggerTime: autoOutTriggerTime,
          workingMinutes: 8 * 60, // Exactly 480 minutes (8:00 Hours)
          markOutType: 'Auto-Out',
          markOutPlantName: 'Auto-Out',
          markOutPlantId: null,
          autoMarkOut: true,
          status: 'AUTO_COMPLETED',
          remarks: session.remarks || 'Auto marked out by system after 18 hours (8:00 Hours recorded)',
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
