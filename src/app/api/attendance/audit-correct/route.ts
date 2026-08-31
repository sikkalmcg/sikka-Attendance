import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { format, parseISO, addHours, isValid } from "date-fns";
import { invalidateBootstrapCache } from "@/lib/data-cache";
import { parseDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// ATTENDANCE HISTORICAL AUDIT & CORRECTION
//
// Scans ALL attendance records and enforces the definitive calculation rules:
//
//   Session 1 Auto OUT:
//     Trigger  ? Mark IN + 16 hours elapsed
//     Stored   ? Mark IN + 8 hours          (creditedHours = 8.0)
//
//   Session 2 Auto OUT:
//     Trigger  ? Mark IN + 8 hours elapsed
//     Stored   ? Mark IN + 4 hours          (creditedHours = 4.0)
//
//   Manual OUT:
//     Stored   ? actual employee OUT timestamp
//     Hours    ? (outDT - inDT) in hours (no per-session cap)
//
// GET  ? dry-run: returns correction report without writing to DB
// POST ? apply: writes corrections to DB
//
// This endpoint is idempotent - running it multiple times is safe.
// -----------------------------------------------------------------------------

interface CorrectionEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  sessionIndex: number;
  outType: string;
  oldHours: number;
  newHours: number;
  oldOutDateTime: string;
  newOutDateTime: string;
  reason: string;
}

function resolveInDT(record: any): Date | null {
  let inDT: Date | null = null;
  if (record.inDateTime) {
    try {
      const d = parseISO(record.inDateTime);
      if (isValid(d)) inDT = d;
    } catch {}
  }
  if (!inDT && record.inDate && record.inTime) {
    inDT = parseDateTime(record.inDate, record.inTime);
  }
  if (!inDT && record.date && record.inTime) {
    inDT = parseDateTime(record.date, record.inTime);
  }
  return inDT && isValid(inDT) ? inDT : null;
}

function resolveOutDT(record: any): Date | null {
  let outDT: Date | null = null;
  if (record.outDateTime) {
    try {
      const d = parseISO(record.outDateTime);
      if (isValid(d)) outDT = d;
    } catch {}
  }
  if (!outDT && record.outDate && record.outTime) {
    outDT = parseDateTime(record.outDate, record.outTime);
  }
  return outDT && isValid(outDT) ? outDT : null;
}

export async function GET() {
  return runAuditCorrection(false);
}

export async function POST() {
  return runAuditCorrection(true);
}

async function runAuditCorrection(applyFixes: boolean) {
  try {
    const db = await getDb();
    if (!db) {
      return NextResponse.json(
        { success: false, message: "Database connection failed" },
        { status: 500 }
      );
    }

    const attendanceCol = db.collection("attendance");

    // Fetch all closed / auto-out records (Open records are handled by live auto-out processor)
    const closedRecords = await attendanceCol
      .find({ status: { $in: ["Closed", "Auto OUT"] } })
      .toArray();

    const corrections: CorrectionEntry[] = [];
    let appliedCount = 0;

    for (const record of closedRecords) {
      const inDT = resolveInDT(record);
      if (!inDT) continue; // Cannot audit without valid Mark IN time

      const sessionIdx: number =
        record.sessionIndex || record.sessionNumber || 1;
      const isAutoOut =
        record.autoOut === true ||
        record.autoCheckout === true ||
        record.outType === "Auto" ||
        record.status === "Auto OUT";

      const storedHours: number = parseFloat(record.hours) || 0;

      // -- Case 1: Auto OUT records -----------------------------------------
      if (isAutoOut) {
        const creditedHours = sessionIdx === 2 ? 4.0 : 8.0;
        const correctOutDT = addHours(inDT, creditedHours);
        const storedOutDT = resolveOutDT(record);

        // Detect wrong OUT time or wrong hours (1-minute + 0.01h tolerance)
        const outDTCorrect = storedOutDT
          ? Math.abs(storedOutDT.getTime() - correctOutDT.getTime()) < 60_000
          : false;
        const hoursCorrect = Math.abs(storedHours - creditedHours) < 0.01;

        if (!outDTCorrect || !hoursCorrect) {
          const entry: CorrectionEntry = {
            id: String(record._id),
            employeeId: record.employeeId,
            employeeName: record.employeeName || "Unknown",
            sessionIndex: sessionIdx,
            outType: "Auto",
            oldHours: storedHours,
            newHours: creditedHours,
            oldOutDateTime:
              record.outDateTime ||
              `${record.outDate} ${record.outTime}` ||
              "unknown",
            newOutDateTime: correctOutDT.toISOString(),
            reason: `Auto OUT S${sessionIdx}: corrected to IN+${creditedHours}h rule (stored ${storedHours}h, required ${creditedHours}h)`,
          };
          corrections.push(entry);

          if (applyFixes) {
            await attendanceCol.updateOne(
              { _id: record._id },
              {
                $set: {
                  outDate: format(correctOutDT, "yyyy-MM-dd"),
                  outTime: format(correctOutDT, "HH:mm"),
                  outDateTime: correctOutDT.toISOString(),
                  hours: creditedHours,
                  remark: `[AUDITED] Auto OUT Session ${sessionIdx} corrected: IN+${creditedHours}h rule. ${record.remark || ""}`.trim(),
                  auditCorrectedAt: new Date().toISOString(),
                  auditCorrectionReason: entry.reason,
                },
              }
            );
            appliedCount++;
          }
        }
        continue; // do not fall through to manual OUT logic
      }

      // -- Case 2: Manual OUT records ---------------------------------------
      const outDT = resolveOutDT(record);
      if (!outDT) continue;

      const diffMs = outDT.getTime() - inDT.getTime();

      if (diffMs < 0) {
        // Impossible: OUT is before IN - apply session fallback
        const creditedHours = sessionIdx === 2 ? 4.0 : 8.0;
        const correctedOutDT = addHours(inDT, creditedHours);

        const entry: CorrectionEntry = {
          id: String(record._id),
          employeeId: record.employeeId,
          employeeName: record.employeeName || "Unknown",
          sessionIndex: sessionIdx,
          outType: record.outType || "Manual",
          oldHours: storedHours,
          newHours: creditedHours,
          oldOutDateTime: record.outDateTime || "unknown",
          newOutDateTime: correctedOutDT.toISOString(),
          reason: `Impossible OUT (OUT < IN): corrected to IN+${creditedHours}h fallback`,
        };
        corrections.push(entry);

        if (applyFixes) {
          await attendanceCol.updateOne(
            { _id: record._id },
            {
              $set: {
                outDate: format(correctedOutDT, "yyyy-MM-dd"),
                outTime: format(correctedOutDT, "HH:mm"),
                outDateTime: correctedOutDT.toISOString(),
                hours: creditedHours,
                auditCorrectedAt: new Date().toISOString(),
                auditCorrectionReason: entry.reason,
              },
            }
          );
          appliedCount++;
        }
        continue;
      }

      // Recalculate actual hours from precise timestamps
      const actualHours = parseFloat(
        (diffMs / (1000 * 60 * 60)).toFixed(2)
      );

      // Flag if stored hours differ from recalculated by more than 0.02h (~1.2 min)
      if (Math.abs(storedHours - actualHours) > 0.02) {
        const entry: CorrectionEntry = {
          id: String(record._id),
          employeeId: record.employeeId,
          employeeName: record.employeeName || "Unknown",
          sessionIndex: sessionIdx,
          outType: record.outType || "Manual",
          oldHours: storedHours,
          newHours: actualHours,
          oldOutDateTime: record.outDateTime || "unknown",
          newOutDateTime: outDT.toISOString(), // OUT timestamp itself is correct; only hours updated
          reason: `Manual OUT S${sessionIdx}: recalculated ${storedHours}h ? ${actualHours}h from actual IN/OUT timestamps`,
        };
        corrections.push(entry);

        if (applyFixes) {
          await attendanceCol.updateOne(
            { _id: record._id },
            {
              $set: {
                hours: actualHours,
                auditCorrectedAt: new Date().toISOString(),
                auditCorrectionReason: entry.reason,
              },
            }
          );
          appliedCount++;
        }
      }
    }

    if (applyFixes && appliedCount > 0) {
      invalidateBootstrapCache();
    }

    return NextResponse.json({
      success: true,
      mode: applyFixes ? "APPLY" : "DRY_RUN",
      scannedCount: closedRecords.length,
      correctionsFound: corrections.length,
      correctionsApplied: applyFixes ? appliedCount : 0,
      corrections,
      executedAt: new Date().toISOString(),
      message: applyFixes
        ? `Audit complete. ${appliedCount} record(s) corrected out of ${closedRecords.length} scanned.`
        : `Dry-run audit complete. ${corrections.length} correction(s) needed out of ${closedRecords.length} scanned. POST to apply.`,
    });
  } catch (error: any) {
    console.error("Attendance audit-correct error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
