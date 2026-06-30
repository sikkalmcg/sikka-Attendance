import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { cookies } from 'next/headers';

import { Workbook } from 'exceljs';

import type { Holiday, AttendanceRecord, Employee, Plant } from '@/lib/types';

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
}) {
  const { hasPunch, isSunday: sun, isHoliday } = params;

  if (hasPunch) {
    if (isHoliday) return 'Present on Holiday';
    if (sun) return 'Present on Weekly Off';
    return 'Present';
  }

  if (sun) return 'Weekly Off';
  if (isHoliday) return 'Holiday';
  return 'Absent';
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

    // Excel/PDF are not implemented in this codebase yet.
    // We keep exportFormat to unblock UI; only csv works for now.

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

    // Load reference tables (employees, plants, holidays) scoped by plants
    const holidaysCol = db.collection<Holiday>('holidays');
    const employeesCol = db.collection<Employee>('employees');
    const attendanceCol = db.collection<AttendanceRecord>('attendance');

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
    // Humne direct `active: true` thoda loose kiya h taaki purana historical data block na ho
    const employeeQuery: any = {};

    if (plantIdsFilter?.length) {
      // Fallback fallback add kiye hain agar DB me ID ki jagah string Name ho
      employeeQuery.$or = [
        { unitIds: { $in: plantIdsFilter } },
        { unitId: { $in: plantIdsFilter } },
        { unitName: { $in: plantIdsFilter } },
        { plantName: { $in: plantIdsFilter } }
      ];
    }

    // Safely apply dropdown filters only if they are not set to 'ALL' or 'all'
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

      // DB sample ke hisaab se fields: employeeId, name, firstName, lastName (plus department/designation etc.)
      // Strict exact match ki jagah partial/regex match use karenge taa-ke no-results na aaye.
      const searchQuery = {
        $or: [
          { employeeId: { $regex: String(search), $options: 'i' } },
          { name: searchRegex },
          { firstName: searchRegex },
          { lastName: searchRegex },
        ],
      };

      // plant scope (employeeQuery.$or) ke sath combine na ho, isliye single $and pattern use karte hain.
      // Agar employeeQuery me $or already hai, we wrap it into $and safely.
      if (employeeQuery.$or) {
        employeeQuery.$and = [{ $or: employeeQuery.$or }, searchQuery];
        delete employeeQuery.$or;
      } else {
        Object.assign(employeeQuery, searchQuery);
      }
    }


    const employees = await employeesCol.find(employeeQuery).toArray();

    // Verification check - agar criteria matching koi employee nahi mila to early exit response
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

    // Build quick lookup per employee+date (aggregate all punches so IN/OUT pair is correct)
    type AggregatedPunch = {
      inTime: string | null;
      outTime: string | null;
      inLocation: string;
      outLocation: string;
      inPlant: string;
      approvedBy: string;
      outDate: string | null;
    };


    const punchByEmpDate = new Map<string, AggregatedPunch>();

    const compareTimeHHMM = (a: string, b: string) => {
      // expects "HH:mm"; returns -1/0/1
      const [ah, am] = a.split(':').map((x) => parseInt(x, 10));
      const [bh, bm] = b.split(':').map((x) => parseInt(x, 10));
      const av = (ah || 0) * 60 + (am || 0);
      const bv = (bh || 0) * 60 + (bm || 0);
      return av < bv ? -1 : av > bv ? 1 : 0;
    };

    for (const rec of attendancePunches) {
      const key = `${rec.employeeId}:${rec.date}`;
      const existing = punchByEmpDate.get(key);

      const candidateIn = rec.inTime ?? null;
      const candidateOut = rec.outTime ?? null;

      if (!existing) {
        punchByEmpDate.set(key, {
          inTime: candidateIn,
          outTime: candidateOut,
          inLocation: rec.address ? rec.address : '--',
          outLocation: rec.addressOut ? rec.addressOut : '--',
          inPlant: rec.inPlant ? rec.inPlant : '--',
          approvedBy: rec.approvedBy || '--',
          outDate: rec.outDate ?? null,
        });
        continue;
      }

      // IN: keep earliest non-null inTime
      if (candidateIn) {
        if (!existing.inTime) {
          existing.inTime = candidateIn;
          existing.inLocation = rec.address ? rec.address : '--';
          // approvedBy should reflect the punch that actually set the IN
          if (rec.approvedBy) existing.approvedBy = rec.approvedBy;
        } else if (compareTimeHHMM(candidateIn, existing.inTime) < 0) {
          existing.inTime = candidateIn;
          existing.inLocation = rec.address ? rec.address : '--';
          if (rec.approvedBy) existing.approvedBy = rec.approvedBy;
        }
      }

      // OUT: keep latest non-null outTime
      if (candidateOut) {
        if (!existing.outTime) {
          existing.outTime = candidateOut;
          existing.outLocation = rec.addressOut ? rec.addressOut : '--';
          if (rec.approvedBy) existing.approvedBy = rec.approvedBy;
          existing.outDate = rec.outDate ?? existing.outDate;
        } else if (compareTimeHHMM(candidateOut, existing.outTime) > 0) {
          existing.outTime = candidateOut;
          existing.outLocation = rec.addressOut ? rec.addressOut : '--';
          if (rec.approvedBy) existing.approvedBy = rec.approvedBy;
          existing.outDate = rec.outDate ?? existing.outDate;
        }
      }

      punchByEmpDate.set(key, existing);
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
        const rec = punchByEmpDate.get(key);

        const sun = isSunday(dateStr);
        const holidayObj = holidayByDate.get(dateStr);
        const isHoliday = !!holidayObj;

        const hasPunch = !!rec?.inTime;

        const status = attendanceStatusFromRules({
          hasPunch,
          inTime: rec?.inTime,
          isSunday: sun,
          isHoliday,
        });

        if (attendanceStatus && attendanceStatus !== 'ALL' && attendanceStatus !== 'all') {
          if (status !== attendanceStatus) continue;
        }

        const inDT = rec?.inTime ? rec.inTime : null;
        const outDT = rec?.outTime ? rec.outTime : null;

        // Compute working hours from IN/OUT times (same-day assumption).
        // If no OUT punch is available, hours remain 0.
        let workingHHMM = '00:00';
        if (rec?.inTime && rec?.outTime) {
          // rec.inTime/outTime are "HH:mm" strings
          const [inH, inM] = rec.inTime.split(':').map((x) => parseInt(x, 10));
          const [outH, outM] = rec.outTime.split(':').map((x) => parseInt(x, 10));
          const inMinutes = (inH || 0) * 60 + (inM || 0);
          const outMinutes = (outH || 0) * 60 + (outM || 0);
          // If out is earlier than in, assume next day
          const deltaMinutes = outMinutes >= inMinutes ? outMinutes - inMinutes : outMinutes + 24 * 60 - inMinutes;
          const hoursFloat = deltaMinutes / 60;
          workingHHMM = fmtHoursToHHMM(hoursFloat);
        }



        // Shift type heuristic: day shift if inTime before 18:00, else night
        let shiftType: 'Day Shift' | 'Night Shift' = 'Day Shift';
        if (rec?.inTime) {
          const t = rec.inTime.split(':');
          const hh = parseInt(t[0] || '0', 10);
          shiftType = hh >= 18 || hh < 6 ? 'Night Shift' : 'Day Shift';
        }

        const inDateTime = inDT ? `${dateStr} ${inDT}` : '--';
        const outDateTime = outDT ? `${rec?.outDate || dateStr} ${outDT}` : '--';

        allRows.push({
          employeeId: emp.employeeId,
          employeeName: emp.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : (emp.name || ''),
          department: emp.department || '--',
          designation: emp.designation || '--',
          date: dateStr,
          inDateTime,
          outDateTime,
          workingHours: workingHHMM,
          inLocation: rec?.inLocation ? rec.inLocation : '--',
          outLocation: rec?.outLocation ? rec.outLocation : '--',
          inPlant: rec?.inPlant ? rec.inPlant : '--',

          attendanceStatus: status,
          shiftType,
          processedBy: rec?.approvedBy || '--',
        });
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
          'Date',
          'In Date & Time',
          'Out Date & Time',
          'Working Hours',
          'In Location',
          'Out Location',
          'Attendance Status',
          'Shift Type',
          'Processed By',
        ];

        const csv = [
          headers.join(','),
          ...rows.map(r => {
            const line = [
              r.employeeId,
              r.employeeName,
              `${r.department} / ${r.designation}`,
              r.date,
              r.inDateTime,
              r.outDateTime,
              r.workingHours,
              r.inPlant,
              r.inLocation,
              r.outLocation,

              r.attendanceStatus,
              r.shiftType,
              r.processedBy,
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