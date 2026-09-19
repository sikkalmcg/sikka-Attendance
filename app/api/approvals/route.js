import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import Employee from '@/models/Employee';
import { authorizeSystemUser, getScopedPlantContext } from '@/lib/rbac';
import { processAutoMarkOut } from '@/lib/autoMarkOut';
import { normalizeAttendance, normalizeEmployee } from '@/lib/normalize';
import {
  getTodayDateString,
  isFutureKolkataDate,
  parseKolkataDateTime,
} from '@/lib/timezone';

const ATTENDANCE_PROJECTION =
  'employeeId employeeName designation plantId plantName markInPlantId markInPlantName markInLocationType markInAt inDate inTime inDateTime markOutAt outDate outTime outDateTime markOutType markOutPlantName status attendanceType workingMinutes hours approvalStatus approved approvedBy approvedAt attendanceDate remarks manualAttendanceBy markInManualBy markOutManualBy';

export async function GET(request) {
  const auth = await authorizeSystemUser(request, 'approval');
  if (!auth.authorized) return auth.response;

  try {
    await connectToDatabase();
    await processAutoMarkOut();
    const plantScope = await getScopedPlantContext(auth.session);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const approvalStatus = searchParams.get('approvalStatus') || 'PENDING';
    const dateParam = searchParams.get('date');

    const todayDate = getTodayDateString();
    const selectedDate = dateParam || todayDate;

    // Backend Future Date Validation (Rules 2, 3, 7, 8) if dateParam is passed
    if (dateParam && isFutureKolkataDate(dateParam)) {
      return NextResponse.json(
        { error: 'Future date or time is not allowed. Please select the current or past date and time.' },
        { status: 400 }
      );
    }

    // ─── TAB 1: PENDING APPROVALS ──────────────────────────────────────────────
    // Strictly displays pending attendance records (approvalStatus !== 'APPROVED' and not approved).
    if (approvalStatus === 'PENDING') {
      const attQueryParts = [
        { approvalStatus: { $nin: ['APPROVED', 'approved', 'Approved'] } },
        { approved: { $nin: [true, 'true'] } },
      ];

      if (!plantScope.isAllPlants) {
        attQueryParts.push({
          $or: [
            { plantId: { $in: plantScope.plantIds } },
            { markInPlantId: { $in: plantScope.plantIds } },
            { inPlant: { $in: plantScope.plantNames } },
            { plantName: { $in: plantScope.plantNames } },
            { markInPlantName: { $in: plantScope.plantNames } },
          ],
        });
      }

      // If no specific dateParam is requested, query all pending records from MongoDB
      if (!dateParam) {
        const rawAttendances = await Attendance.find({ $and: attQueryParts })
          .select(ATTENDANCE_PROJECTION)
          .lean()
          .sort({ markInAt: -1, createdAt: -1 })
          .limit(300);

        const attendances = rawAttendances
          .map(normalizeAttendance)
          .filter((a) => a.approvalStatus !== 'APPROVED' && a.approved !== true);

        let finalList = attendances;
        if (status) {
          if (status === 'ACTIVE') {
            finalList = attendances.filter((a) => a.status === 'ACTIVE' && !a.markOutAt);
          } else if (status === 'ABSENT') {
            finalList = attendances.filter((a) => a.status === 'ABSENT');
          } else if (status === 'COMPLETED') {
            finalList = attendances.filter((a) => a.status === 'COMPLETED' || a.status === 'AUTO_COMPLETED');
          }
        }

        return NextResponse.json({
          success: true,
          attendances: finalList,
          serverDate: todayDate,
          serverTime: new Date().toISOString(),
        });
      }

      // If dateParam is explicitly provided (e.g. historical date lookup or automated tests)
      const selectedDate = dateParam;
      const empQueryParts = [
        {
          $or: [
            { status: { $regex: /^active$/i } },
            { status: 'Active' },
            { active: true },
            { active: { $exists: false }, status: { $exists: false } },
          ],
        },
      ];
      if (!plantScope.isAllPlants) {
        empQueryParts.push({
          $or: [
            { unitIds: { $in: plantScope.plantIds } },
            { plantId: { $in: plantScope.plantIds } },
            { plantName: { $in: plantScope.plantNames } },
          ],
        });
      }
      const activeEmployees = await Employee.find({ $and: empQueryParts })
        .select('fullName employeeId designation aadhaarNumber mobileNumber plantId plantName unitIds')
        .lean()
        .sort({ fullName: 1, employeeId: 1 });

      const istStart = parseKolkataDateTime(`${selectedDate}T00:00:00`);
      const istEnd = new Date(istStart.getTime() + 24 * 60 * 60 * 1000);

      const dateFilter = {
        $or: [
          { attendanceDate: selectedDate },
          { inDate: selectedDate },
          { date: selectedDate },
          {
            markInAt: {
              $gte: istStart,
              $lt: istEnd,
            },
          },
        ],
      };

      const scopedAttQueryParts = [...attQueryParts, dateFilter];
      const rawAttendances = await Attendance.find({ $and: scopedAttQueryParts })
        .select(ATTENDANCE_PROJECTION)
        .lean()
        .sort({
          markInAt: -1,
          createdAt: -1,
        });
      const attendances = rawAttendances.map(normalizeAttendance);

      // Index attendances by employeeId & aadhaarNumber
      const attendanceByEmp = new Map();
      for (const att of attendances) {
        const empIdKey = (att.employeeId || '').toUpperCase();
        if (empIdKey && !attendanceByEmp.has(empIdKey)) {
          attendanceByEmp.set(empIdKey, att);
        }
        if (att.aadhaarNumber && !attendanceByEmp.has(att.aadhaarNumber)) {
          attendanceByEmp.set(att.aadhaarNumber, att);
        }
      }

      // Check if any employee is already approved for this date in DB to avoid duplicate absent entries
      const approvedOnDate = await Attendance.find({
        $and: [
          dateFilter,
          { $or: [{ approvalStatus: 'APPROVED' }, { approved: true }] },
        ],
      }).select('employeeId aadhaarNumber').lean();
      const approvedEmpSet = new Set();
      for (const appDoc of approvedOnDate) {
        if (appDoc.employeeId) approvedEmpSet.add(appDoc.employeeId.toUpperCase());
        if (appDoc.aadhaarNumber) approvedEmpSet.add(appDoc.aadhaarNumber);
      }

      const combinedList = [];
      const seenEmpIds = new Set();

      for (const rawEmp of activeEmployees) {
        const emp = normalizeEmployee(rawEmp);
        const empIdKey = (emp.employeeId || '').toUpperCase();
        seenEmpIds.add(empIdKey);
        if (emp.aadhaarNumber) seenEmpIds.add(emp.aadhaarNumber);

        // If employee is already approved for this date, do NOT display in Pending Approvals
        if (approvedEmpSet.has(empIdKey) || (emp.aadhaarNumber && approvedEmpSet.has(emp.aadhaarNumber))) {
          continue;
        }

        const existing = attendanceByEmp.get(empIdKey) || (emp.aadhaarNumber ? attendanceByEmp.get(emp.aadhaarNumber) : null);

        if (existing) {
          if (existing.approvalStatus !== 'APPROVED' && existing.approved !== true) {
            combinedList.push({
              ...existing,
              attendanceDate: existing.attendanceDate || selectedDate,
            });
          }
        } else {
          combinedList.push({
            id: `absent_${emp.employeeId}_${selectedDate}`,
            _id: `absent_${emp.employeeId}_${selectedDate}`,
            isSyntheticAbsent: true,
            employeeId: emp.employeeId,
            employeeName: emp.fullName,
            designation: emp.designation || 'Staff',
            aadhaarNumber: emp.aadhaarNumber,
            mobileNumber: emp.mobileNumber,
            plantId: emp.plantId || null,
            plantName: emp.plantName || '',
            markInPlantName: '-',
            markInAt: null,
            markOutAt: null,
            workingMinutes: 0,
            status: 'ABSENT',
            attendanceType: 'Absent',
            approvalStatus: 'PENDING',
            approved: false,
            attendanceDate: selectedDate,
            markOutType: '-',
            markOutPlantName: '-',
          });
        }
      }

      for (const att of attendances) {
        const empIdKey = (att.employeeId || '').toUpperCase();
        if (!seenEmpIds.has(empIdKey) && att.approvalStatus !== 'APPROVED' && att.approved !== true) {
          combinedList.push(att);
          seenEmpIds.add(empIdKey);
        }
      }

      let finalList = combinedList;
      if (status) {
        if (status === 'ACTIVE') {
          finalList = combinedList.filter((a) => a.status === 'ACTIVE' && !a.markOutAt);
        } else if (status === 'ABSENT') {
          finalList = combinedList.filter((a) => a.status === 'ABSENT');
        } else if (status === 'COMPLETED') {
          finalList = combinedList.filter((a) => a.status === 'COMPLETED' || a.status === 'AUTO_COMPLETED');
        }
      }

      return NextResponse.json({
        success: true,
        attendances: finalList,
        selectedDate,
        serverDate: todayDate,
        serverTime: new Date().toISOString(),
      });
    }

    // ─── TAB 2: APPROVED HISTORY (APPROVED ATTENDANCE) ─────────────────────────
    // Strictly displays only attendance records that are approved.
    const queryParts = [];

    // Filter strictly by approved
    queryParts.push({
      $or: [
        { approvalStatus: { $in: ['APPROVED', 'approved', 'Approved'] } },
        { approved: true },
        { approved: 'true' },
      ],
    });

    // Only filter by date if dateParam is explicitly specified
    if (dateParam) {
      const istStart = parseKolkataDateTime(`${dateParam}T00:00:00`);
      const istEnd = new Date(istStart.getTime() + 24 * 60 * 60 * 1000);

      queryParts.push({
        $or: [
          { attendanceDate: dateParam },
          { inDate: dateParam },
          { date: dateParam },
          {
            markInAt: {
              $gte: istStart,
              $lt: istEnd,
            },
          },
        ],
      });
    }

    if (!plantScope.isAllPlants) {
      queryParts.push({
        $or: [
          { plantId: { $in: plantScope.plantIds } },
          { markInPlantId: { $in: plantScope.plantIds } },
          { inPlant: { $in: plantScope.plantNames } },
          { plantName: { $in: plantScope.plantNames } },
          { markInPlantName: { $in: plantScope.plantNames } },
        ],
      });
    }

    const query = queryParts.length > 0 ? { $and: queryParts } : {};

    const rawAttendances = await Attendance.find(query)
      .select(ATTENDANCE_PROJECTION)
      .lean()
      .sort({ approvedAt: -1, markInAt: -1, _id: -1 })
      .limit(300);

    const attendances = rawAttendances
      .map(normalizeAttendance)
      .filter((a) => a.approvalStatus === 'APPROVED' || a.approved === true);

    return NextResponse.json({
      success: true,
      attendances,
      ...(dateParam ? { selectedDate: dateParam } : {}),
      serverDate: todayDate,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching approvals:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance approvals' }, { status: 500 });
  }
}
