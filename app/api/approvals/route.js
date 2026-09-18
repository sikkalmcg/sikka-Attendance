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

    // Backend Future Date Validation (Rules 2, 3, 7, 8)
    if (isFutureKolkataDate(selectedDate)) {
      return NextResponse.json(
        { error: 'Future date or time is not allowed. Please select the current or past date and time.' },
        { status: 400 }
      );
    }

    // ─── TAB 1: PENDING APPROVALS – ME ─────────────────────────────────────────
    // Must display every active employee's attendance record/status for current or selected past date.
    // If an employee has not Marked IN on the selected date: Status = Absent
    if (approvalStatus === 'PENDING') {
      // 1. Fetch all active employees matching plant scope
      const empQueryParts = [
        { $or: [{ status: 'Active' }, { active: true }, { active: { $exists: false }, status: { $exists: false } }] },
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
      const activeEmployees = await Employee.find({ $and: empQueryParts }).sort({ fullName: 1, employeeId: 1 });

      // 2. Fetch existing attendance records for the selected date
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

      const attQueryParts = [dateFilter];
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

      const rawAttendances = await Attendance.find({ $and: attQueryParts }).sort({
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

      // 3. Assemble list starting with ALL active employees
      const combinedList = [];
      const seenEmpIds = new Set();

      for (const rawEmp of activeEmployees) {
        const emp = normalizeEmployee(rawEmp);
        const empIdKey = (emp.employeeId || '').toUpperCase();
        seenEmpIds.add(empIdKey);
        if (emp.aadhaarNumber) seenEmpIds.add(emp.aadhaarNumber);

        const existing = attendanceByEmp.get(empIdKey) || (emp.aadhaarNumber ? attendanceByEmp.get(emp.aadhaarNumber) : null);

        if (existing) {
          combinedList.push({
            ...existing,
            attendanceDate: existing.attendanceDate || selectedDate,
          });
        } else {
          // Employee has not marked IN on the selected Mark Date -> Status = Absent
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

      // 4. Also include any attendance record that exists for this date but wasn't in activeEmployees
      for (const att of attendances) {
        const empIdKey = (att.employeeId || '').toUpperCase();
        if (!seenEmpIds.has(empIdKey)) {
          combinedList.push(att);
          seenEmpIds.add(empIdKey);
        }
      }

      // Optional status filter (e.g. if user filtered by ACTIVE or ABSENT)
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

    // ─── TAB 2: APPROVED ATTENDANCE ──────────────────────────────────────────
    const queryParts = [];

    // Filter by approved
    queryParts.push({ $or: [{ approvalStatus: 'APPROVED' }, { approved: true }] });

    // If date provided or selected, optionally filter by date
    if (dateParam) {
      const istStart = parseKolkataDateTime(`${selectedDate}T00:00:00`);
      const istEnd = new Date(istStart.getTime() + 24 * 60 * 60 * 1000);

      queryParts.push({
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
      .sort({ markInAt: -1, approvedAt: -1, _id: -1 })
      .limit(300);

    const attendances = rawAttendances.map(normalizeAttendance);

    return NextResponse.json({
      success: true,
      attendances,
      selectedDate,
      serverDate: todayDate,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching approvals:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance approvals' }, { status: 500 });
  }
}
