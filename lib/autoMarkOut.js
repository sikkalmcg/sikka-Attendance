import connectToDatabase from './mongodb.js';
import Attendance from '../models/Attendance.js';

/**
 * Executes 18-hour auto-mark-out process.
 * Finds all attendance sessions where status is 'ACTIVE'
 * and the markInAt was more than 18 hours ago.
 * Sets:
 *  - markOutAt = markInAt + 18 hours
 *  - autoMarkOut = true
 *  - status = 'AUTO_COMPLETED'
 *  - workingMinutes = 18 * 60 = 1080
 *
 * Idempotent: Can be run multiple times safely without overwriting or double processing.
 *
 * @returns {Promise<{ processedCount: number, affectedIds: string[] }>}
 */
export async function processAutoMarkOut() {
  await connectToDatabase();

  const EIGHTEEN_HOURS_MS = 18 * 60 * 60 * 1000;
  const cutoffTime = new Date(Date.now() - EIGHTEEN_HOURS_MS);

  // Find active records where markInAt <= cutoffTime
  const expiredSessions = await Attendance.find({
    status: 'ACTIVE',
    markInAt: { $lte: cutoffTime },
  });

  if (expiredSessions.length === 0) {
    return { processedCount: 0, affectedIds: [] };
  }

  const affectedIds = [];

  const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

  for (const session of expiredSessions) {
    // Section 8 Rule: Recorded Mark Out Date/Time = Mark IN Date/Time + 8 Hours
    const markInDate = session.markInAt ? new Date(session.markInAt) : new Date();
    const autoOutTime = new Date(markInDate.getTime() + EIGHT_HOURS_MS);

    session.markOutAt = autoOutTime;
    session.workingMinutes = 8 * 60; // Exactly 480 minutes (8:00 hours)
    session.markOutType = 'Auto';
    session.markOutPlantName = 'Auto Mark Out';
    session.autoMarkOut = true;
    session.status = 'AUTO_COMPLETED';
    if (!session.approvalStatus) session.approvalStatus = 'PENDING';
    session.remarks = 'Auto marked out by system after 18 hours (8:00 hours recorded)';

    await session.save();
    affectedIds.push(session._id ? session._id.toString() : session.id);
  }

  return {
    processedCount: affectedIds.length,
    affectedIds,
  };
}
