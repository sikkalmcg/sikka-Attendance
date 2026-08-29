import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionUser, isEmployeeRole } from '@/lib/auth/session';
import { format } from 'date-fns';
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

    // 4. Check if already marked IN or existing Open shift for today
    const existing = await attendanceCol.findOne({ employeeId: internalEmpId, date: todayStr });
    if (existing && existing.status === 'Open') {
      return NextResponse.json(
        {
          success: false,
          message: "You already have an active Mark IN shift for today.",
          data: existing
        },
        { status: 400 }
      );
    }

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
      remark: body.remark || `Checked IN for ${finalAttendanceType}`,
      approved: false,
      unapprovedOutDuration: 0,
      currentGeofenceStatus: geofenceStatus,
      exitEvents: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    let recordId: any;
    if (existing) {
      await attendanceCol.updateOne(
        { _id: existing._id },
        { $set: newAttendanceRecord }
      );
      recordId = existing._id;
    } else {
      const result = await attendanceCol.insertOne(newAttendanceRecord);
      recordId = result.insertedId;
    }

    // 6. Record in Notifications collection
    const notifMsg = `${empFullName} – Mark IN Recorded | Time: ${timeStr} | ${finalPlant}`;
    await db.collection('notifications').insertOne({
      employeeId: internalEmpId,
      message: notifMsg,
      timestamp: format(now, "yyyy-MM-dd HH:mm:ss"),
      read: false,
      type: 'MARK_IN',
      createdAt: now.toISOString(),
    }).catch(() => {});

    invalidateBootstrapCache();

    return NextResponse.json(
      {
        success: true,
        message: "Attendance Marked IN Successfully!",
        id: recordId,
        data: { ...newAttendanceRecord, id: String(recordId), _id: String(recordId) },
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
