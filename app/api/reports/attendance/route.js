import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import Employee from '@/models/Employee';
import Plant from '@/models/Plant';
import { authorizeSystemUser, getScopedPlantContext } from '@/lib/rbac';
import { processAutoMarkOut } from '@/lib/autoMarkOut';
import { formatKolkataDateTime, formatWorkingHours, getAttendanceDateString, parseKolkataDateTime } from '@/lib/timezone';
import { formatInTimeZone } from 'date-fns-tz';
import * as XLSX from 'xlsx';

import { normalizeAttendance } from '@/lib/normalize';

export async function GET(request) {
  const auth = await authorizeSystemUser(request, 'report');
  if (!auth.authorized) return auth.response;

  try {
    await connectToDatabase();
    await processAutoMarkOut();
    const plantScope = await getScopedPlantContext(auth.session);

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const employeeId = searchParams.get('employeeId');
    const plantId = searchParams.get('plantId');
    const statusParam = searchParams.get('status'); // 'Present' | 'Absent' | 'ALL'
    const attendanceType = searchParams.get('attendanceType'); // 'all', 'regular', 'auto'
    const exportFormat = searchParams.get('export'); // 'csv' | 'xlsx'
    const allData = searchParams.get('all') === 'true' || searchParams.get('allData') === 'true';

    const query = {
      $and: [],
    };

    // Direct Attendance logs table query: fetch all attendance records across the requested date range
    // Historical IN/OUT records are preserved regardless of prior approval flag

    // Status filter: Present or Absent only
    if (statusParam === 'Present') {
      query.$and.push({
        status: { $nin: ['ABSENT', 'Absent'] },
        attendanceType: { $ne: 'Absent' },
      });
    } else if (statusParam === 'Absent') {
      query.$and.push({
        $or: [
          { status: { $in: ['ABSENT', 'Absent'] } },
          { attendanceType: 'Absent' },
        ],
      });
    }

    // Date range filter
    if (dateFrom || dateTo) {
      const dateConditions = [];
      const from = dateFrom ? parseKolkataDateTime(`${dateFrom}T00:00:00`) : null;
      const to = dateTo ? new Date(parseKolkataDateTime(`${dateTo}T23:59:59.999`) || new Date(`${dateTo}T23:59:59.999+05:30`)) : null;

      if (from && to) {
        dateConditions.push(
          { markInAt: { $gte: from, $lte: to } },
          { inDateTime: { $gte: from, $lte: to } },
          { mark_in_datetime: { $gte: from, $lte: to } },
          { createdAt: { $gte: from, $lte: to } },
          { inDate: { $gte: dateFrom, $lte: dateTo } },
          { date: { $gte: dateFrom, $lte: dateTo } },
          { attendanceDate: { $gte: dateFrom, $lte: dateTo } }
        );
      } else if (from) {
        dateConditions.push(
          { markInAt: { $gte: from } },
          { inDateTime: { $gte: from } },
          { mark_in_datetime: { $gte: from } },
          { createdAt: { $gte: from } },
          { inDate: { $gte: dateFrom } },
          { date: { $gte: dateFrom } },
          { attendanceDate: { $gte: dateFrom } }
        );
      } else if (to) {
        dateConditions.push(
          { markInAt: { $lte: to } },
          { inDateTime: { $lte: to } },
          { mark_in_datetime: { $lte: to } },
          { createdAt: { $lte: to } },
          { inDate: { $lte: dateTo } },
          { date: { $lte: dateTo } },
          { attendanceDate: { $lte: dateTo } }
        );
      }
      if (dateConditions.length > 0) {
        query.$and.push({ $or: dateConditions });
      }
    }

    if (employeeId) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { employeeId: employeeId },
          { employeeId: employeeId.toUpperCase() },
          { aadhaarNumber: employeeId },
        ],
      });
    }

    // Plant Level Data Security: Enforce allowed plant scope unconditionally for non-admin users
    if (!plantScope.isAllPlants) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { plantId: { $in: plantScope.plantIds } },
          { markInPlantId: { $in: plantScope.plantIds } },
          { plantName: { $in: plantScope.plantNames } },
          { markInPlantName: { $in: plantScope.plantNames } },
          { inPlant: { $in: plantScope.plantNames } },
        ],
      });
    }

    const plantIdsParam = searchParams.get('plants') || searchParams.get('plantId');
    if (plantIdsParam && plantIdsParam !== 'ALL') {
      const pList = plantIdsParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (pList.length > 0) {
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { plantId: { $in: pList } },
            { markInPlantId: { $in: pList } },
            { plantName: { $in: pList } },
            { markInPlantName: { $in: pList } },
            { inPlant: { $in: pList } },
          ],
        });
      }
    }

    if (attendanceType === 'auto') {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [{ autoMarkOut: true }, { autoCheckout: true }, { status: 'Auto OUT' }, { status: 'AUTO_COMPLETED' }],
      });
    } else if (attendanceType === 'regular') {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [{ autoMarkOut: false }, { autoMarkOut: { $exists: false } }],
      });
    }

    const finalQuery = query.$and && query.$and.length > 0 ? query : {};
    const fetchLimit = 15000;
    const rawRecords = await Attendance.find(finalQuery)
      .select('employeeId employeeName designation plantId plantName markInPlantId markInPlantName markInLocationType inPlant outPlant street markInPlant markOutPlant markInAt inDate inTime inDateTime markOutAt outDate outTime outDateTime markOutType markOutByUserId markOutByUserName markOutPlantName status attendanceType workingMinutes hours approvalStatus approved approvedBy approvedAt attendanceDate date remarks remark manualAttendanceBy markInManualBy markOutManualBy mark_in_datetime mark_out_datetime mark_in_time mark_out_time loginTime logoutTime createdAt updatedAt')
      .lean()
      .sort({ markInAt: -1, createdAt: -1, _id: -1 })
      .limit(fetchLimit);

    // Map plant IDs to plant names from Plant collection
    const plantDocs = await Plant.find({}).select('_id id plantId plantName name').lean();
    const plantIdMap = new Map();
    for (const p of plantDocs) {
      const pName = p.plantName || p.name;
      if (pName) {
        if (p._id) plantIdMap.set(String(p._id), pName);
        if (p.id) plantIdMap.set(String(p.id), pName);
        if (p.plantId) plantIdMap.set(String(p.plantId), pName);
      }
    }

    // Query scoped active and matching employees from Employee collection
    const empQueryParts = [];
    if (employeeId) {
      empQueryParts.push({
        $or: [
          { employeeId: employeeId },
          { employeeId: employeeId.toUpperCase() },
          { aadhaarNumber: employeeId },
        ],
      });
    }
    if (!plantScope.isAllPlants) {
      const plantRegexes = (plantScope.plantNames || []).map(
        (name) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      );
      empQueryParts.push({
        $or: [
          { unitIds: { $in: plantScope.plantIds } },
          { plantId: { $in: plantScope.plantIds } },
          { plantName: { $in: plantScope.plantNames } },
          { plantName: { $in: plantRegexes } },
        ],
      });
    }

    const employeeDocs = await Employee.find(empQueryParts.length > 0 ? { $and: empQueryParts } : {})
      .select('employeeId id _id fullName name firstName lastName designation plantName plantId unitIds status active aadhaarNumber')
      .lean();

    const designationMap = new Map();
    const nameMap = new Map();
    const empPlantMap = new Map();

    for (const emp of employeeDocs) {
      const desig = emp.designation;
      if (desig && typeof desig === 'string' && desig.trim()) {
        const cleanDesig = desig.trim();
        if (emp.employeeId) designationMap.set(String(emp.employeeId).toUpperCase().trim(), cleanDesig);
        if (emp.id) designationMap.set(String(emp.id).trim(), cleanDesig);
        if (emp._id) designationMap.set(String(emp._id).trim(), cleanDesig);
      }

      const firstLast = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
      const resolvedName = emp.name || emp.fullName || (firstLast || '');
      if (resolvedName && resolvedName.toLowerCase() !== 'employee') {
        const cleanName = resolvedName.trim();
        if (emp.employeeId) nameMap.set(String(emp.employeeId).toUpperCase().trim(), cleanName);
        if (emp.id) nameMap.set(String(emp.id).trim(), cleanName);
        if (emp._id) nameMap.set(String(emp._id).trim(), cleanName);
        if (emp.aadhaarNumber) nameMap.set(String(emp.aadhaarNumber).trim(), cleanName);
      }

      const assignedPlant =
        emp.plantName ||
        (emp.plantId && plantIdMap.get(String(emp.plantId))) ||
        (Array.isArray(emp.unitIds) && emp.unitIds[0] && plantIdMap.get(String(emp.unitIds[0]))) ||
        '';

      if (assignedPlant) {
        if (emp.employeeId) empPlantMap.set(String(emp.employeeId).toUpperCase().trim(), assignedPlant);
        if (emp.id) empPlantMap.set(String(emp.id).trim(), assignedPlant);
        if (emp._id) empPlantMap.set(String(emp._id).trim(), assignedPlant);
      }
    }

    const cleanPlant = (val) => {
      if (!val || typeof val !== 'string') return '';
      const t = val.trim();
      return (t === 'Manufacturing Plant' || t === '-' || t.toLowerCase() === 'n/a') ? '' : t;
    };

    // Index existing raw records by (empId + '_' + dateKey) and (aadhaar + '_' + dateKey)
    const recordKeyMap = new Map();
    for (const raw of rawRecords) {
      const rec = normalizeAttendance(raw);
      const dKey = rec.attendanceDate || getAttendanceDateString(raw);
      const idKey = String(rec.employeeId || '').toUpperCase().trim();
      const aadhaarKey = rec.aadhaarNumber ? String(rec.aadhaarNumber).trim() : '';

      if (dKey) {
        if (idKey) {
          const key = `${idKey}_${dKey}`;
          if (!recordKeyMap.has(key)) {
            recordKeyMap.set(key, { rec, raw });
          }
        }
        if (aadhaarKey) {
          const aKey = `${aadhaarKey}_${dKey}`;
          if (!recordKeyMap.has(aKey)) {
            recordKeyMap.set(aKey, { rec, raw });
          }
        }
      }
    }

    const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';
    let records = [];

    // If date range is specified and not allData mode, generate rows for every employee for every calendar date
    if (!allData && dateFrom && dateTo) {
      const calendarDates = [];
      const dStart = new Date(`${dateFrom}T00:00:00+05:30`);
      const dEnd = new Date(`${dateTo}T00:00:00+05:30`);
      let cur = new Date(dStart);
      while (cur <= dEnd) {
        calendarDates.push(formatInTimeZone(cur, APP_TIMEZONE, 'yyyy-MM-dd'));
        cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
      }
      calendarDates.reverse(); // Newest first

      const activeEmployees = employeeDocs.filter((e) => {
        const s = String(e.status || '').toLowerCase();
        return s === 'active' || e.active === true || (!e.status && e.active !== false);
      });

      const seenKeys = new Set();

      for (const date of calendarDates) {
        for (const emp of activeEmployees) {
          const empId = String(emp.employeeId || emp.id || emp._id || '').trim();
          const idKey = empId.toUpperCase();
          const key = `${idKey}_${date}`;
          const empAadhaarKey = emp.aadhaarNumber ? `${String(emp.aadhaarNumber).trim()}_${date}` : null;
          seenKeys.add(key);

          const existingEntry = recordKeyMap.get(key) || (empAadhaarKey ? recordKeyMap.get(empAadhaarKey) : null);
          if (existingEntry) {
            const { rec, raw } = existingEntry;
            if (designationMap.has(idKey)) rec.designation = designationMap.get(idKey);
            if (nameMap.has(idKey)) rec.employeeName = nameMap.get(idKey);
            else if (!rec.employeeName || rec.employeeName.toLowerCase() === 'employee') rec.employeeName = empId;

            const isAbsent = rec.status === 'ABSENT' || String(rec.status).toLowerCase() === 'absent';
            if (!isAbsent) {
              const assignedPlant = empPlantMap.get(idKey) || '';
              const resolvedPlant =
                cleanPlant(raw.inPlant) ||
                cleanPlant(raw.markInPlantName) ||
                cleanPlant(raw.plantName) ||
                cleanPlant(raw.outPlant) ||
                cleanPlant(raw.street) ||
                cleanPlant(raw.plantId ? plantIdMap.get(String(raw.plantId)) : '') ||
                cleanPlant(raw.markInPlantId ? plantIdMap.get(String(raw.markInPlantId)) : '') ||
                assignedPlant ||
                'Authorized Plant';

              rec.markInPlantName = resolvedPlant;
              rec.plantName = resolvedPlant;

              const resolvedOutPlant =
                cleanPlant(raw.outPlant) ||
                cleanPlant(raw.markOutPlantName) ||
                resolvedPlant;
              rec.markOutPlantName = resolvedOutPlant;
            } else {
              rec.markInPlantName = '-';
              rec.plantName = '-';
              rec.markOutPlantName = '-';
              rec.markInAt = null;
              rec.markOutAt = null;
              rec.workingMinutes = 0;
              rec.status = 'Absent';
            }
            rec.attendanceDate = date;
            records.push(rec);
          } else {
            // Zero-activity day for this employee: Generate dynamic Absent row
            const resolvedName = nameMap.get(idKey) || emp.name || emp.fullName || empId;
            records.push({
              _id: `absent_${empId}_${date}`,
              id: `absent_${empId}_${date}`,
              employeeId: empId,
              employeeName: resolvedName,
              designation: designationMap.get(idKey) || emp.designation || 'Staff',
              attendanceDate: date,
              inDate: date,
              date: date,
              markInPlantName: '-',
              markOutPlantName: '-',
              plantName: '-',
              markInAt: null,
              markOutAt: null,
              workingMinutes: 0,
              status: 'Absent',
              attendanceType: 'Absent',
              markOutType: '-',
              approvedBy: '-',
              remarks: 'Absent',
              approvalStatus: 'APPROVED',
              approved: true,
            });
          }
        }
      }

      // Also append any existing DB records matching the query that were not in activeEmployees (e.g. inactive employees)
      for (const raw of rawRecords) {
        const rec = normalizeAttendance(raw);
        const dKey = rec.attendanceDate || getAttendanceDateString(raw);
        const idKey = String(rec.employeeId || '').toUpperCase().trim();
        const key = `${idKey}_${dKey}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          if (designationMap.has(idKey)) rec.designation = designationMap.get(idKey);
          if (nameMap.has(idKey)) rec.employeeName = nameMap.get(idKey);
          else if (!rec.employeeName || rec.employeeName.toLowerCase() === 'employee') rec.employeeName = rec.employeeId || '';
          if (dKey) rec.attendanceDate = dKey;
          records.push(rec);
        }
      }
    } else {
      // allData mode or no date range specified
      records = rawRecords.map((raw) => {
        const rec = normalizeAttendance(raw);
        const idKey = String(rec.employeeId || '').toUpperCase().trim();
        const nameKey = String(rec.employeeName || '').toLowerCase().trim();
        if (designationMap.has(idKey)) {
          rec.designation = designationMap.get(idKey);
        }
        if (nameMap.has(idKey)) {
          rec.employeeName = nameMap.get(idKey);
        } else if (!rec.employeeName || rec.employeeName.toLowerCase() === 'employee') {
          rec.employeeName = rec.employeeId || '';
        }

        const isAbsent = rec.status === 'ABSENT' || String(rec.status).toLowerCase() === 'absent';
        if (!isAbsent) {
          const assignedPlant = empPlantMap.get(idKey) || empPlantMap.get(nameKey) || '';
          const resolvedPlant =
            cleanPlant(raw.inPlant) ||
            cleanPlant(raw.markInPlantName) ||
            cleanPlant(raw.plantName) ||
            cleanPlant(raw.outPlant) ||
            cleanPlant(raw.street) ||
            cleanPlant(raw.plantId ? plantIdMap.get(String(raw.plantId)) : '') ||
            cleanPlant(raw.markInPlantId ? plantIdMap.get(String(raw.markInPlantId)) : '') ||
            assignedPlant ||
            'Authorized Plant';

          rec.markInPlantName = resolvedPlant;
          rec.plantName = resolvedPlant;

          const resolvedOutPlant =
            cleanPlant(raw.outPlant) ||
            cleanPlant(raw.markOutPlantName) ||
            resolvedPlant;
          rec.markOutPlantName = resolvedOutPlant;
        } else {
          rec.markInPlantName = '-';
          rec.plantName = '-';
          rec.markOutPlantName = '-';
        }

        if (!rec.attendanceDate && (raw.date || raw.inDate)) {
          rec.attendanceDate = raw.date || raw.inDate;
        }

        return rec;
      });
    }

    // Apply status filter if present
    if (statusParam === 'Present') {
      records = records.filter((r) => r.status !== 'Absent' && r.status !== 'ABSENT');
    } else if (statusParam === 'Absent') {
      records = records.filter((r) => r.status === 'Absent' || r.status === 'ABSENT');
    }

    // Sort newest attendance date first
    records.sort((a, b) => {
      const dateA = a.attendanceDate || a.inDate || a.date || '';
      const dateB = b.attendanceDate || b.inDate || b.date || '';
      return dateB.localeCompare(dateA);
    });

    // Handle CSV or Excel Export
    if (exportFormat === 'csv' || exportFormat === 'xlsx') {
      const getManualAttendanceDisplay = (r) => {
        const inBy = r.markInManualBy;
        const outBy = r.markOutManualBy;
        const legacyBy = r.manualAttendanceBy;

        if (inBy && outBy) {
          if (inBy === outBy) {
            return inBy;
          }
          return `Mark In Manual by ${inBy}, Mark Out Manual by ${outBy}`;
        }
        if (inBy) {
          return `Mark In Manual by ${inBy}`;
        }
        if (outBy) {
          return `Mark Out Manual by ${outBy}`;
        }
        if (legacyBy) {
          return legacyBy;
        }
        return '-';
      };

      const getRemarkDisplay = (r) => {
        const inBy = r.markInManualBy;
        const outBy = r.markOutManualBy;
        const rawRemarks = (r.remarks || '').trim();
        const isAbsent = r.status === 'ABSENT' || String(r.status).toLowerCase() === 'absent';

        const parts = [];
        if (inBy && outBy) {
          if (inBy === outBy) {
            parts.push(`Mark In Manual by ${inBy}`, `Mark Out Manual by ${inBy}`);
          } else {
            parts.push(`Mark In Manual by ${inBy}`, `Mark Out Manual by ${outBy}`);
          }
        } else if (inBy) {
          parts.push(`Mark In Manual by ${inBy}`);
        } else if (outBy) {
          parts.push(`Mark Out Manual by ${outBy}`);
        } else if (r.manualAttendanceBy) {
          parts.push(`Manual by ${r.manualAttendanceBy}`);
        }

        if (rawRemarks) {
          const isRedundant = parts.some((p) => rawRemarks.toLowerCase().includes(p.toLowerCase()));
          if (!isRedundant) {
            parts.push(rawRemarks);
          }
        } else if (isAbsent && parts.length === 0) {
          parts.push('Absent');
        }

        return parts.length > 0 ? parts.join('; ') : '-';
      };

      const formattedRows = records.map((r) => {
        const isAbsent = r.status === 'ABSENT' || String(r.status).toLowerCase() === 'absent';
        return {
          'Employee ID': r.employeeId || '-',
          'Employee Name': r.employeeName || '-',
          'Designation': r.designation || 'Staff',
          'Date': r.attendanceDate || '-',
          'Mark In Plant': isAbsent ? '-' : (r.markInPlantName || r.plantName || '-'),
          'Mark IN Date Time': !isAbsent && r.markInAt ? formatKolkataDateTime(r.markInAt) : '-',
          'Mark Out Date Time': !isAbsent && r.markOutAt ? formatKolkataDateTime(r.markOutAt) : '-',
          'Working Hour': !isAbsent && r.workingMinutes > 0 ? formatWorkingHours(r.workingMinutes) : '00:00 Hours',
          'Mark Out Type': isAbsent ? '-' : (r.markOutType || 'Manual Mark-Out'),
          'Mark Out Plant': isAbsent ? '-' : (r.markOutPlantName || r.plantName || '-'),
          'Status': isAbsent ? 'Absent' : 'Present',
          'Manual Attendance By': getManualAttendanceDisplay(r),
          'Approved By': r.approvedBy || '-',
          'Remark': getRemarkDisplay(r),
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(formattedRows);

      // Auto-size worksheet column widths
      const colWidths = Object.keys(formattedRows[0] || {}).map((key) => ({
        wch: Math.max(key.length + 3, 14),
      }));
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Report');

      if (exportFormat === 'csv') {
        const csvContent = XLSX.utils.sheet_to_csv(worksheet);
        return new NextResponse(csvContent, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="attendance_report.csv"',
          },
        });
      }

      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="attendance_report.xlsx"',
        },
      });
    }

    return NextResponse.json({ success: true, count: records.length, records });
  } catch (error) {
    console.error('Report error:', error);
    return NextResponse.json({ error: 'Failed to generate attendance report' }, { status: 500 });
  }
}
