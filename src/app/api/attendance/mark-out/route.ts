import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/auth/session';
import { format, parseISO, addHours, isValid } from 'date-fns';
import { ObjectId } from 'mongodb';
import { invalidateBootstrapCache } from '@/lib/data-cache';

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
    const outDT = now;
    const outTimeStr = format(outDT, "HH:mm");
    const outDateStr = format(outDT, "yyyy-MM-dd");

    // Compute worked hours
    let inDT: Date | null = null;
    if (activeRecord.inDateTime) {
      try { inDT = parseISO(activeRecord.inDateTime); } catch {}
    }
    if (!inDT || !isValid(inDT)) {
      if (activeRecord.inDate && activeRecord.inTime) {
        try { inDT = parseISO(`${activeRecord.inDate}T${activeRecord.inTime}:00`); } catch {}
      }
    }

    let finalHours = 0;
    if (inDT && isValid(inDT)) {
      const diffHours = (outDT.getTime() - inDT.getTime()) / (1000 * 60 * 60);
      finalHours = parseFloat(Math.max(0, diffHours).toFixed(2));
    }

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

    await attendanceCol.updateOne(
      { _id: activeRecord._id },
      { $set: updatePayload }
    );

    const empFullName = matchedEmp.firstName
      ? `${matchedEmp.firstName} ${matchedEmp.lastName || ''}`.trim()
      : (matchedEmp.name || matchedEmp.fullName || "Employee");

    // Record in Notifications collection
    const notifMsg = `${empFullName} – Mark OUT Recorded | Time: ${outTimeStr} | Worked: ${finalHours} hrs`;
    await db.collection('notifications').insertOne({
      employeeId: internalEmpId,
      message: notifMsg,
      timestamp: format(now, "yyyy-MM-dd HH:mm:ss"),
      read: false,
      type: 'MARK_OUT',
      createdAt: now.toISOString(),
    }).catch(() => {});

    invalidateBootstrapCache();

    return NextResponse.json(
      {
        success: true,
        message: "Attendance Marked OUT Successfully!",
        data: { ...activeRecord, ...updatePayload, id: String(activeRecord._id) }
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
