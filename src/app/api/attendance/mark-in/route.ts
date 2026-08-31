import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionUser, isEmployeeRole } from '@/lib/auth/session';
import { format } from 'date-fns';
import { invalidateBootstrapCache } from '@/lib/data-cache';
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

    // 1. Mandatory Role-Based Security: Only EMPLOYEE can Mark IN
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

    // Check account status
    if (matchedEmp.active === false || matchedEmp.isActive === false || matchedEmp.status === 'Inactive') {
      return NextResponse.json(
        { success: false, message: "Access Denied: Employee account is currently inactive." },
        { status: 403 }
      );
    }

    const empFullName = matchedEmp.firstName
      ? `${matchedEmp.firstName} ${matchedEmp.lastName || ''}`.trim()
      : (matchedEmp.name || matchedEmp.fullName || "Employee");

    const now = getISTTime();
    const todayStr = format(now, "yyyy-MM-dd");
    const timeStr = format(now, "HH:mm");

    // 4. Check today's existing attendance sessions (Max 2 sessions per day)
    const empIdMatches = [internalEmpId, matchedEmp.employeeId, matchedEmp.id, cleanSessionEmpId].filter(Boolean);
    const todaySessions = await attendanceCol.find({
      employeeId: { $in: empIdMatches },
      date: todayStr
    }).sort({ createdAt: 1 }).toArray();

    // 4a. Check if already marked IN with an active Open shift
    const openSession = todaySessions.find((s: any) => s.status === 'Open');
    if (openSession) {
      return NextResponse.json(
        {
          success: false,
          message: "You already have an active Mark IN shift for today.",
          data: openSession
        },
        { status: 400 }
      );
    }

    // 4b. Rule 6: No Third Mark IN (Max 2 attendance sessions per day)
    if (todaySessions.length >= 2) {
      return NextResponse.json(
        {
          success: false,
          message: "You have already used the maximum 2 attendance sessions allowed for today."
        },
        { status: 400 }
      );
    }

    const sessionIndex = todaySessions.length + 1; // 1 for first session, 2 for second session

    // 5. Build Attendance Record with all required fields
    const {
      latitude,
      longitude,
      lat,
      lng,
      address,
      inPlant,
      plantName,
      attendanceType,
      selectedType,
      street,
      area,
      city,
      state,
      pincode,
      currentGeofenceStatus,
    } = body;

    const finalLat = parseFloat(lat ?? latitude ?? 28.6329);
    const finalLng = parseFloat(lng ?? longitude ?? 77.4357);

    // 4c. Rule 5: Second Mark IN Validation (Must be within 700m of a registered plant or valid Field/WFH)
    if (sessionIndex === 2) {
      const isSpecialType = selectedType === 'WFH' || selectedType === 'FIELD' || attendanceType === 'Work From Home' || attendanceType === 'Field Work';
      if (!isSpecialType) {
        const plants = await db.collection('plants').find({ active: { $ne: false } }).toArray().catch(() => []);
        let isWithinAnyPlant = false;
        const R_EARTH = 6371e3; // meters
        for (const p of plants) {
          if (typeof p.lat === 'number' && typeof p.lng === 'number') {
            const phi1 = (finalLat * Math.PI) / 180;
            const phi2 = (p.lat * Math.PI) / 180;
            const deltaPhi = ((p.lat - finalLat) * Math.PI) / 180;
            const deltaLambda = ((p.lng - finalLng) * Math.PI) / 180;
            const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = R_EARTH * c;
            if (distance <= (p.radius || 700)) {
              isWithinAnyPlant = true;
              break;
            }
          }
        }
        if (!isWithinAnyPlant && plants.length > 0) {
          return NextResponse.json(
            {
              success: false,
              message: "Second Mark IN requires you to be within 700 meters of a plant. Alternatively, select Field Work or WFH if applicable."
            },
            { status: 400 }
          );
        }
      }
    }

    const finalAddress = address || (inPlant ? String(inPlant) : "Registered Location");
    const finalPlant = inPlant || plantName || (selectedType === 'WFH' ? 'Outside-WFM' : selectedType === 'FIELD' ? 'Outside-Field Work' : 'N/A');
    const finalAttendanceType = attendanceType || (selectedType === 'WFH' ? 'Work From Home' : selectedType === 'FIELD' ? 'Field Work' : 'Plant Attendance');
    const geofenceStatus = currentGeofenceStatus || (finalPlant.startsWith('Outside') ? 'Outside Plant' : 'Inside Plant');

    const newAttendanceRecord = {
      employeeId: internalEmpId,
      employeeName: empFullName,
      aadhaarNumber: matchedEmp.aadhaarNumber || matchedEmp.aadhaar ? "[Aadhaar Redacted]" : undefined,
      mobileNumber: matchedEmp.mobileNumber || matchedEmp.mobile || undefined,
      firmId: matchedEmp.firmId || null,
      plantId: matchedEmp.plantId || null,
      sessionIndex,
      sessionNumber: sessionIndex,
      date: todayStr,
      inDate: todayStr,
      inTime: timeStr,
      inDateTime: now.toISOString(),
      hours: 0,
      status: 'Open',
      attendanceType: finalAttendanceType,
      lat: finalLat,
      lng: finalLng,
      address: finalAddress,
      street: street || finalPlant,
      area: area || (geofenceStatus === 'Inside Plant' ? "Plant Radius Zone" : "Outside Zone"),
      city: city || "NCR",
      state: state || "Uttar Pradesh",
      pincode: pincode || "N/A",
      inPlant: finalPlant,
      remark: body.remark || `Checked IN (Session ${sessionIndex}) for ${finalAttendanceType}`,
      approved: false,
      unapprovedOutDuration: 0,
      currentGeofenceStatus: geofenceStatus,
      exitEvents: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const result = await attendanceCol.insertOne(newAttendanceRecord);
    const recordId = result.insertedId;
    const savedRecord = { ...newAttendanceRecord, id: String(recordId), _id: String(recordId) };

    // 6. Record in Notifications collection
    const notifMsg = `${empFullName} – Mark IN Recorded (Session ${sessionIndex}) | Time: ${timeStr} | ${finalPlant}`;
    await db.collection('notifications').insertOne({
      employeeId: internalEmpId,
      message: notifMsg,
      timestamp: format(now, "yyyy-MM-dd HH:mm:ss"),
      read: false,
      type: 'MARK_IN',
      createdAt: now.toISOString(),
    }).catch(() => {});

    invalidateBootstrapCache();

    // 7. Broadcast real-time event AFTER confirmed MongoDB save
    //    This triggers SSE push to all connected clients (Mark Attendance + Approvals pages)
    realtimeBroadcaster.broadcast('attendance_updated', {
      collection: 'attendance',
      action: 'insert',
      data: savedRecord,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Attendance Marked IN Successfully! (Session ${sessionIndex} of 2)`,
        id: recordId,
        data: savedRecord,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Mark IN API Error:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error during Mark IN." },
      { status: 500 }
    );
  }
}
