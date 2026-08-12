import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { cookies } from 'next/headers';

import { Workbook } from 'exceljs';

import type { Holiday, AttendanceRecord, Employee, Plant, LeaveRequest } from '@/lib/types';

// Note: this route is used for Attendance History Ledger (Session History).
// It must correctly aggregate multiple punch documents for the same employee+date
// so that Mark IN and Mark OUT both appear accurately without incorrect/missing pairing.


// Ensure Next.js does not attempt static rendering for this API route.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SortDir = 'asc' | 'desc';

const DEFAULT_PAGE_SIZE = 100;
const ALLOWED_PAGE_SIZES = new Set([50, 100, 250, 500]);

function toISODateOnly(d: string) {
  // expects YYYY-MM-DD
  if (!d) return null;
  const dt = new Date(`${d}T00:00:00.000Z`);
  if (Number.isNaN(dt.getTime())) return null;
  return d;
}

function getNowISTParts() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return { now, from: `${yyyy}-${mm}-01`, today: `${yyyy}-${mm}-${dd}` };
}

function normalizeSort(sortBy?: string): string {
  // client-facing keys -> mongo/derived keys handled in code
  switch (sortBy) {
    case 'employeeId':
      return 'employeeId';
    case 'employeeName':
      return 'employeeName';
    case 'department':
      return 'department';
    case 'date':
      return 'date';
    case 'attendanceStatus':
      return 'attendanceStatus';
    case 'shiftType':
      return 'shiftType';
    default:
      return 'employeeId';
  }
}

function parseSortDir(dir?: string): SortDir {
  const d = String(dir || '').toLowerCase();
  return d === 'desc' ? 'desc' : 'asc';
}

function isEmployeeActiveOnDate(emp: any, dateStr: string) {
  if (!emp) return false;
  if (emp.joinDate && dateStr < emp.joinDate) return false;
  if (emp.active === false && emp.inactiveDate && dateStr > emp.inactiveDate) return false;
  return true;
}

function isSunday(dateStr: string) {
  const dt = new Date(`${dateStr}T00:00:00.000Z`);
  return dt.getUTCDay() === 0;
}

function fmtHoursToHHMM(hours: number) {
  if (!hours || hours <= 0) return '00:00';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function attendanceStatusFromRules(params: {
  hasPunch: boolean;
  inTime?: string | null;
  isSunday: boolean;
  isHoliday: boolean;
  hasLeave?: boolean;
}) {
  const { hasPunch, isSunday: sun, isHoliday, hasLeave } = params;

  if (hasPunch) {
    if (isHoliday) return 'Present on Holiday';
    if (sun) return 'Present on Weekly Off';
    return 'Present';
  }

  if (hasLeave) return 'Leave';
  if (sun) return 'Weekly Off';
  if (isHoliday) return 'Holiday';
  return 'Absent';
}

function computeRemarks(params: {
  leaveType?: string;
  autoCheckout?: boolean;
  autoOut?: boolean;
  editedBy?: string | null;
  inPlant: string;
  outPlant: string | null;
  hasOutTime: boolean;
}): string {
  const { leaveType, autoCheckout, autoOut, editedBy, inPlant, outPlant, hasOutTime } = params;

  // 1. Leave Type
  if (leaveType) return leaveType;

  // 2. System Auto Out
  if (autoCheckout || autoOut) return 'System Auto Out';

  // 3. Manual Entry by (Username)
  if (editedBy) return `Manual Entry by ${editedBy}`;

  // 4. Out Not from Plant - when employee checked out from outside plant radius
  if (hasOutTime && outPlant && (outPlant === '--' || outPlant === 'N/A' || !outPlant)) {
    return 'Out Not from Plant';
  }

  // 5. Not In from Plant - when employee checked in from outside plant radius
  if (inPlant === '--' || inPlant === 'N/A') return 'Not In from Plant';

  // 6. Blank
  return '';
}

export async function GET(req: Request) {
  try {
    const { now, from: defaultFrom, today: defaultTo } = getNowISTParts();

    const q = new URL(req.url).searchParams;

    const fromDate = toISODateOnly(q.get('fromDate') || defaultFrom);
    const toDate = toISODateOnly(q.get('toDate') || defaultTo);

    if (!fromDate || !toDate) {
      return NextResponse.json({ error: 'Invalid fromDate/toDate' }, { status: 400 });
    }
    if (fromDate > toDate) {
      return NextResponse.json({ error: 'fromDate cannot be after toDate' }, { status: 400 });
    }

    const exportMode = q.get('export') === 'true';
    const exportFormat = String(q.get('format') || 'csv').toLowerCase();

    const printMode = q.get('print') === 'true';

    const pageStr = q.get('page') || '1';
    const page = Math.max(1, parseInt(pageStr, 10) || 1);

    const pageSizeRaw = q.get('pageSize');
    const pageSize =
      pageSizeRaw === 'ALL'
        ? null
        : ALLOWED_PAGE_SIZES.has(parseInt(pageSizeRaw || '', 10))
          ? parseInt(pageSizeRaw!, 10)
          : DEFAULT_PAGE_SIZE;

    const sortBy = normalizeSort(q.get('sortBy') || 'employeeId');
    const sortDir = parseSortDir(q.get('sortDir') || 'asc');

    const plant = q.get('plant') || 'all';
    const employeeId = q.get('employeeId') || '';
    const department = q.get('department') || '';
    const designation = q.get('designation') || '';
    const attendanceStatus = q.get('attendanceStatus') || '';
    const processedBy = q.get('processedBy') || '';
    const search = (q.get('search') || '').trim();

    // Auth scoping
    const cookieStore = cookies();
    const sessionRaw = cookieStore.get('sikka_session')?.value;
    const session = sessionRaw ? JSON.parse(sessionRaw) : null;

    const isAdmin = session?.role && ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(session.role);
    const allowedPlantIds: string[] = isAdmin ? (session?.plantIds || []) : (session?.plantIds || []);

    const db = await getDb();

    // Load reference tables (employees, plants, holidays, leaveRequests) scoped by plants
    const holidaysCol = db.collection<Holiday>('holidays');
    const employeesCol = db.collection<Employee>('employees');
    const attendanceCol = db.collection<AttendanceRecord>('attendance');
    const leaveRequestsCol = db.collection<LeaveRequest>('leaveRequests');

    let plantIdsFilter: string[] | null = null;
    if (isAdmin && allowedPlantIds?.length) plantIdsFilter = allowedPlantIds;

    if (plant !== 'all' && plant !== 'ALL') {
      // if a specific plant is requested, it must be within user scope when scope filter is active
      const match = plantIdsFilter ? plantIdsFilter.includes(plant) : true;
      if (!match) {
        return NextResponse.json({ records: [], totalEmployees: 0, totalRecords: 0, page, pageSize: pageSize ?? 'ALL' });
      }
      plantIdsFilter = [plant];
    }

    // holidays lookup for interval (server-side)
    const holidays = await holidaysCol
      .find({ date: { $gte: fromDate, $lte: toDate }, ...(plantIdsFilter?.length ? { plantIds: { $in: plantIdsFilter } } : {}) })
      .toArray();
    const holidayByDate = new Map<string, Holiday>();
    for (const h of holidays) {
      if (!h.auto) {
        holidayByDate.set(h.date, h);
      }
    }

    // employees scope config
    const employeeQuery: any = {};

    if (plantIdsFilter?.length) {
      employeeQuery.$or = [
        { unitIds: { $in: plantIdsFilter } },
        { unitId: { $in: plantIdsFilter } },
        { unitName: { $in: plantIdsFilter } },
        { plantName: { $in: plantIdsFilter } }
      ];
    }

    if (department && department !== 'ALL' && department !== 'all') {
      employeeQuery.department = department;
    }
    if (designation && designation !== 'ALL' && designation !== 'all') {
      employeeQuery.designation = designation;
    }
    if (employeeId) {
      employeeQuery.employeeId = employeeId;
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      const searchQuery = {
        $or: [
          { employeeId: { $regex: String(search), $options: 'i' } },
          { name: searchRegex },
          { firstName: searchRegex },
          { lastName: searchRegex },
        ],
      };
      if (employeeQuery.$or) {
        employeeQuery.$and = [{ $or: employeeQuery.$or }, searchQuery];
        delete employeeQuery.$or;
      } else {
        Object.assign(employeeQuery, searchQuery);
      }
    }

    const employees = await employeesCol.find(employeeQuery).toArray();

    if (!employees.length) {
      return NextResponse.json({
        rows: [],
        meta: {
          fromDate,
          toDate,
          totalEmployees: 0,
          totalRecords: 0,
          page,
          pageSize: pageSize ?? 'ALL',
          totalPages: 0,
          sortBy,
          sortDir,
        },
      });
    }

    // Attendance punches in range, scoped by employee
    const empIds = employees.map(e => e.employeeId);

    const attendanceQuery: any = {
      employeeId: { $in: empIds },
      date: { $gte: fromDate, $lte: toDate },
    };

    if (processedBy && processedBy !== 'ALL' && processedBy !== 'all') {
      attendanceQuery.approvedBy = processedBy;
    }

    const attendancePunches = await attendanceCol.find(attendanceQuery).toArray();

    // Load leave requests for the date range and employee scope
    const leaveRequestsData = await leaveRequestsCol
      .find({
        employeeId: { $in: empIds },
        status: { $regex: /^APPROVED$/i },
        $or: [
          { fromDate: { $gte: fromDate, $lte: toDate } },
          { toDate: { $gte: fromDate, $lte: toDate } },
          { fromDate: { $lte: fromDate }, toDate: { $gte: toDate } },
        ]
      })
      .toArray();

    // Build leave lookup: employeeId:date -> leaveRequest
    const leaveByEmpDate = new Map<string, any>();
    for (const lr of leaveRequestsData) {
      const lStart = new Date(`${lr.fromDate}T00:00:00.000Z`);
      const lEnd = new Date(`${lr.toDate}T00:00:00.000Z`);
      for (let d = new Date(lStart); d <= lEnd; d.setUTCDate(d.getUTCDate() + 1)) {
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const dateKey = `${yyyy}-${mm}-${dd}`;
        const key = `${lr.employeeId}:${dateKey}`;
        if (!leaveByEmpDate.has(key)) {
          leaveByEmpDate.set(key, lr);
        }
      }
    }

    // Build per-session lookup per employee+date.
    // Each attendance punch document represents ONE Mark IN / Mark OUT session.
    // All sessions for the same employee+date must be preserved (NOT merged/overwritten).
    type SessionPunch = {
      inTime: string | null;
      outTime: string | null;
      inLocation: string;
      outLocation: string;
      inPlant: string;
      outPlant: string | null;
      approved: boolean;
      approvedBy: string;
      editedBy: string | null;
      autoOut: boolean;
      autoCheckout: boolean;
      outDate: string | null;
      hours: number;
      status: string;
    };

    const sessionsByEmpDate = new Map<string, SessionPunch[]>();

    for (const rec of attendancePunches) {
      const key = `${rec.employeeId}:${rec.date}`;
      const session: SessionPunch = {
        inTime: rec.inTime ?? null,
        outTime: rec.outTime ?? null,
        inLocation: rec.address ? rec.address : '--',
        outLocation: rec.addressOut ? rec.addressOut : '--',
        inPlant: rec.inPlant ? rec.inPlant : '--',
        outPlant: rec.outPlant ? rec.outPlant : null,
        approved: rec.approved === true || String(rec.approved) === 'true',
        approvedBy: rec.approvedBy || '--',
        editedBy: (rec as any).editedBy || null,
        autoOut: rec.autoOut === true || rec.autoCheckout === true,
        autoCheckout: rec.autoCheckout === true,
        outDate: rec.outDate ?? null,
        hours: rec.hours || 0,
        status: rec.status || 'Open',
      };

      const existing = sessionsByEmpDate.get(key);
      if (existing) {
        existing.push(session);
      } else {
        sessionsByEmpDate.set(key, [session]);
      }
    }

    // Sort sessions per employee+date by Mark IN time (chronological).
    const compareTimeHHMM = (a: string, b: string) => {
      const [ah, am] = a.split(':').map((x) => parseInt(x, 10));
      const [bh, bm] = b.split(':').map((x) => parseInt(x, 10));
      const av = (ah || 0) * 60 + (am || 0);
      const bv = (bh || 0) * 60 + (bm || 0);
      return av < bv ? -1 : av > bv ? 1 : 0;
    };
    for (const sessions of sessionsByEmpDate.values()) {
      sessions.sort((a, b) => {
        const aIn = a.inTime ?? '';
        const bIn = b.inTime ?? '';
        if (aIn === bIn) return 0;
        if (!aIn) return 1;
        if (!bIn) return -1;
        return compareTimeHHMM(aIn, bIn);
      });
    }

    // Create date array (calendar days)
    const start = new Date(`${fromDate}T00:00:00.000Z`);
    const end = new Date(`${toDate}T00:00:00.000Z`);
    const dates: string[] = [];
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }

    // Compute ledger rows server-side.
    const allRows: any[] = [];

    for (const emp of employees) {
      for (const dateStr of dates) {
        if (!isEmployeeActiveOnDate(emp, dateStr)) continue;

        const key = `${emp.employeeId}:${dateStr}`;
        const sessions = sessionsByEmpDate.get(key) || [];

        const sun = isSunday(dateStr);
        const holidayObj = holidayByDate.get(dateStr);
        const isHoliday = !!holidayObj;

        // A day is considered "has punch" if ANY session has a Mark IN time.
        const hasPunch = sessions.some((s) => !!s.inTime);
        const leaveKey = `${emp.employeeId}:${dateStr}`;
        const approvedLeave = leaveByEmpDate.get(leaveKey);
        const hasLeave = !!approvedLeave;

        const status = attendanceStatusFromRules({
          hasPunch,
          isSunday: sun,
          isHoliday,
          hasLeave,
        });

        // If status is absent but has leave, override to Leave
        const finalStatus = hasLeave && !hasPunch ? 'Leave' : status;

        if (attendanceStatus && attendanceStatus !== 'ALL' && attendanceStatus !== 'all') {
          if (finalStatus !== attendanceStatus) continue;
        }

        const baseRow = {
          employeeId: emp.employeeId,
          employeeName: emp.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : (emp.name || ''),
          department: emp.department || '--',
          designation: emp.designation || '--',
          attendanceStatus: finalStatus,
        };

        // Case: no completed sessions -> single absent/holiday/weekly-off/leave row (existing format).
        const completedSessions = sessions.filter((s) => !!s.inTime);
        if (completedSessions.length === 0) {
          const rec = sessions[0];

          // Approval Status
          let approvalStatus = 'Pending';
          if (rec?.approved === true || String(rec?.approved) === 'true') {
            approvalStatus = 'Approved';
          } else if (String(rec?.status || '').toUpperCase() === 'REJECTED') {
            approvalStatus = 'Rejected';
          }

          // Approved By (Username)
          const approvedBy = rec?.approvedBy && rec.approvedBy !== '--' ? rec.approvedBy : '--';

          // Compute remarks
          const remarks = computeRemarks({
            leaveType: approvedLeave ? approvedLeave.purpose : undefined,
            autoCheckout: rec?.autoCheckout,
            autoOut: rec?.autoOut,
            editedBy: rec?.editedBy || null,
            inPlant: rec?.inPlant || '--',
            outPlant: rec?.outPlant || null,
            hasOutTime: !!rec?.outTime,
          });

          allRows.push({
            ...baseRow,
            session: '1',
            isDayTotal: false,
            inPlant: rec?.inPlant ? rec.inPlant : '--',
            inDateTime: '--',
            outDateTime: '--',
            workingHours: '00:00',
            inLocation: rec?.inLocation ? rec.inLocation : '--',
            outLocation: rec?.outLocation ? rec.outLocation : '--',
            outPlant: rec?.outPlant ? rec.outPlant : '--',
            approvalStatus,
            approvedBy,
            remarks,
          });
          continue;
        }

        // Case: sessions exist. Compute per-session working hours and sum.
        const sessionRows: any[] = [];
        let dayTotalMinutes = 0;

        completedSessions.forEach((rec, idx) => {
          // Compute working hours from IN/OUT times (same-day assumption).
          let workingHHMM = '00:00';
          if (rec.inTime && rec.outTime) {
            const [inH, inM] = rec.inTime.split(':').map((x) => parseInt(x, 10));
            const [outH, outM] = rec.outTime.split(':').map((x) => parseInt(x, 10));
            const inMinutes = (inH || 0) * 60 + (inM || 0);
            const outMinutes = (outH || 0) * 60 + (outM || 0);
            // If out is earlier than in, assume next day
            const deltaMinutes = outMinutes >= inMinutes ? outMinutes - inMinutes : outMinutes + 24 * 60 - inMinutes;
            dayTotalMinutes += deltaMinutes;
            const hoursFloat = deltaMinutes / 60;
            workingHHMM = fmtHoursToHHMM(hoursFloat);
          }

          // Approval Status
          let approvalStatus = 'Pending';
          if (rec.approved === true || String(rec.approved) === 'true') {
            approvalStatus = 'Approved';
          } else if (String(rec.status || '').toUpperCase() === 'REJECTED') {
            approvalStatus = 'Rejected';
          }

          // Approved By (Username)
          const approvedBy = rec.approvedBy && rec.approvedBy !== '--' ? rec.approvedBy : '--';

          // Compute remarks
          const remarks = computeRemarks({
            leaveType: approvedLeave ? approvedLeave.purpose : undefined,
            autoCheckout: rec.autoCheckout,
            autoOut: rec.autoOut,
            editedBy: rec.editedBy || null,
            inPlant: rec.inPlant || '--',
            outPlant: rec.outPlant || null,
            hasOutTime: !!rec.outTime,
          });

          const inDateTime = rec.inTime ? `${dateStr} ${rec.inTime}` : '--';
          const outDateTime = rec.outTime ? `${rec.outDate || dateStr} ${rec.outTime}` : '--';

          sessionRows.push({
            ...baseRow,
            session: String(idx + 1),
            isDayTotal: false,
            inPlant: rec.inPlant ? rec.inPlant : '--',
            inDateTime,
            outDateTime,
            workingHours: workingHHMM,
            inLocation: rec.inLocation,
            outLocation: rec.outLocation,
            outPlant: rec.outPlant ? rec.outPlant : '--',
            approvalStatus,
            approvedBy,
            remarks,
          });
        });

        allRows.push(...sessionRows);

        // If a day has 2+ sessions, append a Day Total row (sum of completed sessions).
        if (sessionRows.length > 1) {
          const dayTotalHHMM = fmtHoursToHHMM(dayTotalMinutes / 60);
          const dayTotalApproval = sessionRows.every((r) => r.approvalStatus === 'Approved')
            ? 'Approved'
            : sessionRows.some((r) => r.approvalStatus === 'Rejected')
              ? 'Rejected'
              : 'Pending';
          const dayTotalApprovedBy = '--';
          const dayTotalRemarks = `Day Total (${sessionRows.length} sessions)`;

          allRows.push({
            ...baseRow,
            session: 'TOTAL',
            isDayTotal: true,
            inPlant: '--',
            inDateTime: '--',
            outDateTime: '--',
            workingHours: dayTotalHHMM,
            inLocation: '--',
            outLocation: '--',
            outPlant: '--',
            approvalStatus: dayTotalApproval,
            approvedBy: dayTotalApprovedBy,
            remarks: dayTotalRemarks,
          });
        }
      }
    }

    // Sorting
    const sign = sortDir === 'desc' ? -1 : 1;
    allRows.sort((a, b) => {
      const av = (a as any)[sortBy === 'employeeName' ? 'employeeName' : sortBy] ?? '';
      const bv = (b as any)[sortBy === 'employeeName' ? 'employeeName' : sortBy] ?? '';
      return String(av).localeCompare(String(bv)) * sign;
    });

    const totalEmployees = new Set(allRows.map(r => r.employeeId)).size;
    const totalRecords = allRows.length;

    if (exportMode || printMode) {
      if (exportMode) {
        if (exportFormat !== 'csv' && exportFormat !== 'excel' && exportFormat !== 'xlsx') {
          return NextResponse.json({ error: `format ${exportFormat} not supported. Use csv or excel.` }, { status: 400 });
        }

        const rows = allRows;
        const headers = [
          'Employee ID',
          'Employee Name',
'Department / Designation',
          'Session',
          'In Plant',
          'In Date & Time',
          'Out Date & Time',
          'Working Hours',
          'In Location',
          'Out Location',
          'Out Plant',
          'Attendance Status',
          'Approval Status',
          'Approved By',
          'Remarks',
        ];

        const csv = [
          headers.join(','),
          ...rows.map(r => {
const line = [
              r.employeeId,
              r.employeeName,
              `${r.department} / ${r.designation}`,
              r.isDayTotal ? 'Day Total' : (r.session || '1'),
              r.inPlant,
              r.inDateTime,
              r.outDateTime,
              r.workingHours,
              r.inLocation,
              r.outLocation,
              r.outPlant,
              r.attendanceStatus,
              r.approvalStatus,
              r.approvedBy,
              r.remarks,
            ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`);
            return line.join(',');
          }),
        ].join('\n');

        return new NextResponse(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="attendance_history_ledger_${fromDate}_to_${toDate}.csv"`,
          },
        });
      }

      // Print-ready JSON payload
      return NextResponse.json({
        print: true,
        meta: {
          reportName: 'Attendance History Ledger',
          fromDate,
          toDate,
          generatedAt: now.toISOString(),
          totalEmployees,
          totalRecords,
        },
        rows: allRows,
      });
    }

    // Pagination
    const take = pageSize ?? totalRecords;
    const skip = pageSize ? (page - 1) * take : 0;
    const paged = pageSize ? allRows.slice(skip, skip + take) : allRows;

    return NextResponse.json({
      rows: paged,
      meta: {
        fromDate,
        toDate,
        totalEmployees,
        totalRecords,
        page,
        pageSize: pageSize ?? 'ALL',
        totalPages: pageSize ? Math.ceil(totalRecords / take) : 1,
        sortBy,
        sortDir,
      },
    });
  } catch (error: any) {
    console.error('attendance-history-ledger error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
