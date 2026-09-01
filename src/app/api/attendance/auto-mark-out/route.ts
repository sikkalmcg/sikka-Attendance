import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { format, parseISO, addHours, isValid } from 'date-fns';
import { invalidateBootstrapCache } from '@/lib/data-cache';
import { parseDateTime } from '@/lib/utils';
import { realtimeBroadcaster } from '@/lib/realtime-events';

export const dynamic = 'force-dynamic';

const getISTTime = () => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};

export async function GET() {
  return processAutoMarkOut();
}

export async function POST() {
  return processAutoMarkOut();
}

async function processAutoMarkOut() {
  try {
    const db = await getDb().catch((err) => {
      console.warn("[Auto-Out] MongoDB connection deferred:", err?.message || err);
      return null;
    });
    if (!db) {
      return NextResponse.json({ success: false, message: "Database unavailable", processedCount: 0 }, { status: 503 });
    }

    const attendanceCol = db.collection('attendance');
    const plantExitsCol = db.collection('plantExits');
    const notificationsCol = db.collection('notifications');

    // Find all active Open attendance records
    const openRecords = await attendanceCol.find({ status: 'Open' }).toArray();
    const now = getISTTime();
    const nowDT = parseDateTime(format(now, "yyyy-MM-dd"), format(now, "HH:mm")) || now;
    const processedRecords = [];

    for (const record of openRecords) {
      let inDT: Date | null = null;
      if (record.inDate && record.inTime) {
        inDT = parseDateTime(record.inDate, record.inTime);
      } else if (record.date && record.inTime) {
        inDT = parseDateTime(record.date, record.inTime);
      } else if (record.inDateTime) {
        try { inDT = parseISO(record.inDateTime); } catch {}
      }

      if (!inDT || !isValid(inDT)) continue;

      const elapsedHours = (nowDT.getTime() - inDT.getTime()) / (1000 * 60 * 60);
      const sessionIdx = record.sessionIndex || 1;

      // Threshold rules:
      // Session 1: 16 hours max duration -> Auto Mark OUT with 8.00 hours fixed
      // Session 2: 8 hours max duration -> Auto Mark OUT with 4.00 hours fixed
      const thresholdHours = sessionIdx === 2 ? 8 : 16;
      const creditedHours = sessionIdx === 2 ? 4.0 : 8.0;

      if (elapsedHours >= thresholdHours) {
        const creditOutDT = addHours(inDT, creditedHours);
        const finalOutDate = format(creditOutDT, "yyyy-MM-dd");
        const finalOutTime = format(creditOutDT, "HH:mm");
        const nextInEnableDT = addHours(now, 1);

        const updatePayload: any = {
          outTime: finalOutTime,
          outDate: finalOutDate,
          outDateTime: creditOutDT.toISOString(),
          hours: creditedHours,
          status: 'Auto OUT',
          outType: 'Auto',
          autoOut: true,
          autoCheckout: true,
          autoTriggerTime: now.toISOString(),
          nextInEnableTime: nextInEnableDT.toISOString(),
          currentGeofenceStatus: "Shift Closed",
          remark: `System Auto-Logged OUT (${thresholdHours}h Limit reached for Session ${sessionIdx}); Credited ${creditedHours}h fixed working time.`,
          updatedAt: now.toISOString(),
        };

        // Close uncompleted exit events
        if (Array.isArray(record.exitEvents)) {
          updatePayload.exitEvents = record.exitEvents.map((evt: any) => {
            if (!evt.inPlantTime && evt.trackingStatus === "Outside Plant") {
              return {
                ...evt,
                inPlantTime: format(now, "yyyy-MM-dd HH:mm"),
                trackingStatus: "Shift Closed",
              };
            }
            return evt;
          });
        }

        // Close open plantExits
        await plantExitsCol.updateMany(
          {
            $or: [
              { attendanceId: String(record._id) },
              { employeeCode: record.employeeId, inPlantTime: null }
            ]
          },
          {
            $set: {
              inPlantTime: format(now, "yyyy-MM-dd HH:mm"),
              trackingStatus: "Shift Closed",
              updatedAt: now.toISOString(),
            }
          }
        ).catch(() => {});

        await attendanceCol.updateOne(
          { _id: record._id },
          { $set: updatePayload }
        );

        // Broadcast real-time event AFTER confirmed MongoDB save
        //    Each auto-out record gets its own push so clients refresh immediately
        realtimeBroadcaster.broadcast('attendance_updated', {
          collection: 'attendance',
          action: 'auto_out',
          data: { ...record, ...updatePayload, id: String(record._id) },
        });

        // Record notification in MongoDB
        const notifMsg = `${record.employeeName || 'Employee'} – AUTO OUT Processed (Session ${sessionIdx}) | Recorded: ${creditedHours} hrs worked.`;
        await notificationsCol.insertOne({
          employeeId: record.employeeId,
          message: notifMsg,
          timestamp: format(now, "yyyy-MM-dd HH:mm:ss"),
          read: false,
          type: 'AUTO_OUT',
          createdAt: now.toISOString(),
        }).catch(() => {});

        processedRecords.push({
          id: String(record._id),
          employeeId: record.employeeId,
          employeeName: record.employeeName,
          sessionIndex: sessionIdx,
          creditedHours,
        });
      }
    }

    if (processedRecords.length > 0) {
      invalidateBootstrapCache();
    }

    return NextResponse.json({
      success: true,
      processedCount: processedRecords.length,
      processedRecords,
      executedAt: now.toISOString(),
    });
  } catch (error: any) {
    console.error("Auto Mark OUT processor error:", error?.message || error);
    return NextResponse.json({ success: false, error: error?.message || "Internal server error" }, { status: 500 });
  }
}
