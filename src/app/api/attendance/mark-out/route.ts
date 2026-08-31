import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/auth/session';
import { format, parseISO, addHours, isValid } from 'date-fns';
import { ObjectId } from 'mongodb';
import { invalidateBootstrapCache } from '@/lib/data-cache';
import { parseDateTime } from '@/lib/utils';
import { realtimeBroadcaster } from '@/lib/realtime-events';

export const dynamic = 'force-dynamic';

const getISTTime = () => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};

export async function POST(req: Request) {
  try {
    const sessionUser = getSessionUser(req);
    const body = await req.json().catch(() => ({}));

    // Resolve user session from request or body if provided
    const userRole = String(sessionUser?.role || body?.userRole || body?.role || '').trim().toUpperCase();

    // 1. Mandatory Role-Based Security: Only EMPLOYEE can Mark OUT
    if (!userRole || userRole !== 'EMPLOYEE') {
      return NextResponse.json(
        {
          success: false,
          message: "Only employees are allowed to Mark IN and Mark OUT."
        },
        { status: 403 }
      );
    }

    const db = await getDb();
    const employeesCol = db.collection('employees');
    const attendanceCol = db.collection('attendance');

    // 2. Identify and verify authenticated Employee
    const sessionEmpId = String(sessionUser?.employeeId || sessionUser?.username || sessionUser?.id || body?.employeeId || '').trim();
    if (!sessionEmpId) {
      return NextResponse.json(
        { success: false, message: "Missing employee identification." },
        { status: 400 }
      );
    }

    const allEmployees = await employeesCol.find({}).toArray();
    const cleanSessionEmpId = sessionEmpId.replace(/\s/g, '').toUpperCase();

    const matchedEmp = allEmployees.find((e: any) => {
      const empId = String(e.employeeId || '').replace(/\s/g, '').toUpperCase();
      const id = String(e.id || e._id || '').replace(/\s/g, '').toUpperCase();
      const aadhaar = String(e.aadhaarNumber || e.aadhaar || '').replace(/\s/g, '').toUpperCase();
      const mobile = String(e.mobileNumber || e.mobile || '').replace(/\s/g, '').toUpperCase();
      const username = String(e.username || '').replace(/\s/g, '').toUpperCase();

      return (
        empId === cleanSessionEmpId ||
        id === cleanSessionEmpId ||
        aadhaar === cleanSessionEmpId ||
        mobile === cleanSessionEmpId ||
        username === cleanSessionEmpId
      );
    });

    if (!matchedEmp) {
      return NextResponse.json(
        { success: false, message: "Employee record not found in system." },
        { status: 404 }
      );
    }

    // 3. Employee Security: Prevent Employee A from punching for Employee B
    const requestEmpId = body?.employeeId ? String(body.employeeId).replace(/\s/g, '').toUpperCase() : null;
    const internalEmpId = String(matchedEmp.employeeId || matchedEmp.id || matchedEmp._id);
    const internalEmpIdClean = internalEmpId.replace(/\s/g, '').toUpperCase();

    if (requestEmpId && requestEmpId !== internalEmpIdClean && requestEmpId !== cleanSessionEmpId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized: You can only mark attendance for your own account." },
        { status: 403 }
      );
    }

    // 4. Find active Open attendance record for this employee
    const recordId = body?.id || body?._id || body?.recordId;
    let activeRecord: any = null;

    if (recordId) {
      let query: any = { _id: recordId };
      if (ObjectId.isValid(recordId)) {
        query = { $or: [{ _id: new ObjectId(recordId) }, { id: recordId }, { _id: recordId }] };
      }
      activeRecord = await attendanceCol.findOne({
        ...query,
        employeeId: { $in: [internalEmpId, matchedEmp.employeeId, matchedEmp.id].filter(Boolean) }
      });
    }

    if (!activeRecord) {
      activeRecord = await attendanceCol.findOne({
        employeeId: { $in: [internalEmpId, matchedEmp.employeeId, matchedEmp.id].filter(Boolean) },
        status: 'Open'
      });
    }

    if (!activeRecord || !activeRecord.inTime) {
      return NextResponse.json(
        { success: false, message: "Cannot Mark OUT because no valid Mark IN record exists." },
        { status: 400 }
      );
    }

    const now = getISTTime();
    const outTimeStr = format(now, "HH:mm");
    const outDateStr = format(now, "yyyy-MM-dd");
    const outDT = parseDateTime(outDateStr, outTimeStr) || now;

    // ── Working-Hour Calculation (Manual OUT) ──────────────────────────────
    // Rule: Manual OUT = actual OUT timestamp − actual IN timestamp.
    // No per-session cap is applied here (caps apply only to Auto Mark OUT).
    // The only hard ceiling is the 24-hour combined daily total.
    let inDT: Date | null = null;
    // Prefer the ISO inDateTime for maximum precision
    if (activeRecord.inDateTime) {
      try { inDT = parseISO(activeRecord.inDateTime); } catch {}
    }
    if (!inDT || !isValid(inDT)) {
      if (activeRecord.inDate && activeRecord.inTime) {
        inDT = parseDateTime(activeRecord.inDate, activeRecord.inTime);
      } else if (activeRecord.date && activeRecord.inTime) {
        inDT = parseDateTime(activeRecord.date, activeRecord.inTime);
      }
    }

    const sessionIdx = activeRecord.sessionIndex || 1;

    let finalHours = 0;
    if (inDT && isValid(inDT)) {
      const diffMs = outDT.getTime() - inDT.getTime();
      if (diffMs < 0) {
        // OUT is before IN — this is impossible; reject the request
        return NextResponse.json(
          { success: false, message: "Mark OUT time cannot be earlier than Mark IN time. Please check the system clock." },
          { status: 400 }
        );
      }
      // Store actual elapsed hours (no per-session cap — that is only for Auto OUT)
      finalHours = diffMs / (1000 * 60 * 60);
    }

    // Rule: Max 24 combined daily hours across all sessions
    const otherSessions = await attendanceCol.find({
      employeeId: { $in: [internalEmpId, matchedEmp.employeeId, matchedEmp.id].filter(Boolean) },
      date: activeRecord.date || outDateStr,
      _id: { $ne: activeRecord._id }
    }).toArray();

    const otherHoursTotal = otherSessions.reduce((acc: number, s: any) => acc + (parseFloat(s.hours) || 0), 0);
    const maxAllowedRemaining = Math.max(0, 24 - otherHoursTotal);
    finalHours = Math.min(finalHours, maxAllowedRemaining);
    finalHours = parseFloat(finalHours.toFixed(2));

    // 1-hour rest period / cool-off after Mark OUT
    const nextEnableDT = addHours(outDT, 1);

    const {
      latitude,
      longitude,
      lat,
      lng,
      address,
      outPlant,
      plantName,
      street,
      area,
      city,
      state,
      pincode,
    } = body;

    const finalLat = parseFloat(lat ?? latitude ?? activeRecord.lat ?? 28.6329);
    const finalLng = parseFloat(lng ?? longitude ?? activeRecord.lng ?? 77.4357);
    const finalAddress = address || activeRecord.address || "Registered Location";
    const finalOutPlant = outPlant || plantName || activeRecord.inPlant || "Registered Plant";

    const updatePayload: any = {
      outTime: outTimeStr,
      outDate: outDateStr,
      outDateTime: outDT.toISOString(),
      hours: finalHours,
      status: 'Closed',
      outType: 'Manual',
      latOut: finalLat,
      lngOut: finalLng,
      addressOut: finalAddress,
      streetOut: street || activeRecord.street || "Plant",
      areaOut: area || activeRecord.area || "Plant Radius Zone",
      cityOut: city || activeRecord.city || "NCR",
      stateOut: state || activeRecord.state || "Uttar Pradesh",
      pincodeOut: pincode || activeRecord.pincode || "N/A",
      outPlant: finalOutPlant,
      nextInEnableTime: nextEnableDT.toISOString(),
      currentGeofenceStatus: "Shift Closed",
      updatedAt: now.toISOString(),
    };

    // Close any uncompleted exit events
    if (Array.isArray(activeRecord.exitEvents)) {
      const updatedEvents = activeRecord.exitEvents.map((evt: any) => {
        if (!evt.inPlantTime && evt.trackingStatus === "Outside Plant") {
          return {
            ...evt,
            inPlantTime: format(now, "yyyy-MM-dd HH:mm"),
            trackingStatus: "Shift Closed",
          };
        }
        return evt;
      });
      updatePayload.exitEvents = updatedEvents;
    }

    // Also close any active open plantExits in plantExits collection
    await db.collection('plantExits').updateMany(
      {
        $or: [
          { attendanceId: String(activeRecord._id) },
          { employeeCode: { $in: [internalEmpId, matchedEmp.employeeId, matchedEmp.id].filter(Boolean) }, inPlantTime: null }
        ]
      },
      {
        $set: {
          inPlantTime: format(now, "yyyy-MM-dd HH:mm"),
          trackingStatus: "Shift Closed",
          updatedAt: now.toISOString()
        }
      }
    ).catch(() => {});

    await attendanceCol.updateOne(
      { _id: activeRecord._id },
      { $set: updatePayload }
    );

    const savedRecord = { ...activeRecord, ...updatePayload, id: String(activeRecord._id) };

    const empFullName = matchedEmp.firstName
      ? `${matchedEmp.firstName} ${matchedEmp.lastName || ''}`.trim()
      : (matchedEmp.name || matchedEmp.fullName || "Employee");

    // Record in Notifications collection
    const notifMsg = `${empFullName} – Mark OUT Recorded (Session ${sessionIdx}) | Time: ${outTimeStr} | Worked: ${finalHours} hrs`;
    await db.collection('notifications').insertOne({
      employeeId: internalEmpId,
      message: notifMsg,
      timestamp: format(now, "yyyy-MM-dd HH:mm:ss"),
      read: false,
      type: 'MARK_OUT',
      createdAt: now.toISOString(),
    }).catch(() => {});

    invalidateBootstrapCache();

    // Broadcast real-time event AFTER confirmed MongoDB save
    //    This triggers SSE push to all connected clients (Mark Attendance + Approvals pages)
    realtimeBroadcaster.broadcast('attendance_updated', {
      collection: 'attendance',
      action: 'update',
      data: savedRecord,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Attendance Marked OUT Successfully!",
        data: savedRecord
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Mark OUT API Error:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error during Mark OUT." },
      { status: 500 }
    );
  }
}
