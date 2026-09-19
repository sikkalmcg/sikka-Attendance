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

async function enrichWithEmployeeDesignation(records) {
  if (!records || records.length === 0) return records;

  const empIdSet = new Set();
  const aadhaarSet = new Set();
  const nameSet = new Set();

  for (const r of records) {
    if (r.employeeId) empIdSet.add(String(r.employeeId).trim());
    if (r.aadhaarNumber) aadhaarSet.add(String(r.aadhaarNumber).trim());
    if (r.employeeName) nameSet.add(String(r.employeeName).trim());
  }

  const queryOr = [];
  if (empIdSet.size > 0) {
    const list = [...empIdSet];
    queryOr.push({ employeeId: { $in: list } });
    queryOr.push({ id: { $in: list } });
    queryOr.push({ _id: { $in: list } });
  }
  if (aadhaarSet.size > 0) {
    queryOr.push({ aadhaarNumber: { $in: [...aadhaarSet] } });
    queryOr.push({ aadhaar: { $in: [...aadhaarSet] } });
  }
  if (nameSet.size > 0) {
    queryOr.push({ fullName: { $in: [...nameSet] } });
    queryOr.push({ name: { $in: [...nameSet] } });
  }

  if (queryOr.length === 0) return records;

  const employees = await Employee.find({ $or: queryOr })
    .select('employeeId id _id fullName name aadhaarNumber aadhaar designation')
    .lean();

  const designationMap = new Map();
  for (const emp of employees) {
    const desig = emp.designation;
    if (desig && typeof desig === 'string' && desig.trim()) {
      const cleanDesig = desig.trim();
      if (emp.employeeId) designationMap.set(String(emp.employeeId).toUpperCase().trim(), cleanDesig);
      if (emp.id) designationMap.set(String(emp.id).trim(), cleanDesig);
      if (emp._id) designationMap.set(String(emp._id).trim(), cleanDesig);
      if (emp.aadhaarNumber) designationMap.set(String(emp.aadhaarNumber).trim(), cleanDesig);
      if (emp.aadhaar) designationMap.set(String(emp.aadhaar).trim(), cleanDesig);
      if (emp.fullName) designationMap.set(String(emp.fullName).toLowerCase().trim(), cleanDesig);
      if (emp.name) designationMap.set(String(emp.name).toLowerCase().trim(), cleanDesig);
    }
  }

  for (const r of records) {
    const empIdKey = String(r.employeeId || '').toUpperCase().trim();
    const aadhaarKey = String(r.aadhaarNumber || '').trim();
    const nameKey = String(r.employeeName || '').toLowerCase().trim();

    if (empIdKey && designationMap.has(empIdKey)) {
      r.designation = designationMap.get(empIdKey);
    } else if (aadhaarKey && designationMap.has(aadhaarKey)) {
      r.designation = designationMap.get(aadhaarKey);
    } else if (nameKey && designationMap.has(nameKey)) {
      r.designation = designationMap.get(nameKey);
    }
  }

  return records;
}

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

      // Active employees query for the plant scope
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

      // Build attendance query depending on whether dateParam is passed
      const scopedAttQueryParts = [...attQueryParts];
      if (dateParam) {
        const istStart = parseKolkataDateTime(`${dateParam}T00:00:00`);
        const istEnd = new Date(istStart.getTime() + 24 * 60 * 60 * 1000);
        scopedAttQueryParts.push({
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

      const rawAttendances = await Attendance.find({ $and: scopedAttQueryParts })
        .select(ATTENDANCE_PROJECTION)
        .lean()
        .sort({ markInAt: -1, createdAt: -1 })
        .limit(500);

      const dbAttendances = rawAttendances
        .map(normalizeAttendance)
        .filter((a) => a.approvalStatus !== 'APPROVED' && a.approved !== true);

      // Determine eligible dates for absent record generation
      const eligibleDatesSet = new Set();
      if (dateParam) {
        eligibleDatesSet.add(dateParam);
      } else {
        // All dates mode: collect dates with pending records plus today
        for (const att of dbAttendances) {
          const d = att.attendanceDate || att.inDate;
          if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
            eligibleDatesSet.add(d);
          }
        }
        eligibleDatesSet.add(todayDate);
      }
      const eligibleDates = Array.from(eligibleDatesSet).sort().reverse();

      // Find any employees already approved on these eligible dates to prevent duplicate absent entries
      const approvedOnDates = await Attendance.find({
        $and: [
          {
            $or: [
              { attendanceDate: { $in: eligibleDates } },
              { inDate: { $in: eligibleDates } },
              { date: { $in: eligibleDates } },
            ],
          },
          {
            $or: [
              { approvalStatus: { $in: ['APPROVED', 'approved', 'Approved'] } },
              { approved: true },
              { approved: 'true' },
            ],
          },
        ],
      })
        .select('employeeId aadhaarNumber attendanceDate inDate date')
        .lean();

      const approvedKeySet = new Set();
      for (const appDoc of approvedOnDates) {
        const d = appDoc.attendanceDate || appDoc.inDate || appDoc.date;
        if (d) {
          if (appDoc.employeeId) approvedKeySet.add(`${appDoc.employeeId.toUpperCase()}_${d}`);
          if (appDoc.aadhaarNumber) approvedKeySet.add(`${appDoc.aadhaarNumber}_${d}`);
        }
      }

      // Track existing pending attendance records by (empId + '_' + date) and (aadhaar + '_' + date)
      const pendingKeySet = new Set();
      const combinedList = [];
      const seenRecordKeys = new Set();

      for (const att of dbAttendances) {
        const d = att.attendanceDate || att.inDate || todayDate;
        const empIdKey = (att.employeeId || '').toUpperCase();
        const recordKey = `${empIdKey}_${d}`;

        if (!seenRecordKeys.has(recordKey)) {
          seenRecordKeys.add(recordKey);
          if (empIdKey) pendingKeySet.add(`${empIdKey}_${d}`);
          if (att.aadhaarNumber) pendingKeySet.add(`${att.aadhaarNumber}_${d}`);
          combinedList.push(att);
        }
      }

      // Generate Absent attendance records for employees with no attendance on each eligible date
      for (const date of eligibleDates) {
        for (const rawEmp of activeEmployees) {
          const emp = normalizeEmployee(rawEmp);
          const empIdKey = (emp.employeeId || '').toUpperCase();
          const empDateKey = `${empIdKey}_${date}`;
          const aadhaarDateKey = emp.aadhaarNumber ? `${emp.aadhaarNumber}_${date}` : null;

          // Skip if employee already has a pending or approved record on this date
          if (
            pendingKeySet.has(empDateKey) ||
            (aadhaarDateKey && pendingKeySet.has(aadhaarDateKey)) ||
            approvedKeySet.has(empDateKey) ||
            (aadhaarDateKey && approvedKeySet.has(aadhaarDateKey)) ||
            seenRecordKeys.has(empDateKey)
          ) {
            continue;
          }

          seenRecordKeys.add(empDateKey);

          combinedList.push({
            id: `absent_${emp.employeeId}_${date}`,
            _id: `absent_${emp.employeeId}_${date}`,
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
            attendanceDate: date,
            markOutType: '-',
            markOutPlantName: '-',
          });
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

      await enrichWithEmployeeDesignation(finalList);

      return NextResponse.json({
        success: true,
        attendances: finalList,
        ...(dateParam ? { selectedDate: dateParam } : {}),
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

    await enrichWithEmployeeDesignation(attendances);

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
