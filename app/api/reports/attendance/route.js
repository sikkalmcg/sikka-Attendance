import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import Employee from '@/models/Employee';
import Plant from '@/models/Plant';
import { authorizeSystemUser, getScopedPlantContext } from '@/lib/rbac';
import { processAutoMarkOut } from '@/lib/autoMarkOut';
import { formatKolkataDateTime, formatWorkingHours } from '@/lib/timezone';
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

    // By default, match approved records (both approvalStatus === 'APPROVED' and legacy approved === true)
    // If allData is requested, fetch all records from database without restriction
    if (!allData) {
      query.$and.push({
        $or: [
          { approvalStatus: 'APPROVED' },
          { approved: true },
        ],
      });
    }

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
      const from = dateFrom ? new Date(dateFrom) : null;
      if (from) from.setHours(0, 0, 0, 0);
      const to = dateTo ? new Date(dateTo) : null;
      if (to) to.setHours(23, 59, 59, 999);

      if (from && to) {
        dateConditions.push(
          { markInAt: { $gte: from, $lte: to } },
          { inDateTime: { $gte: from, $lte: to } },
          { inDate: { $gte: dateFrom, $lte: dateTo } },
          { date: { $gte: dateFrom, $lte: dateTo } },
          { attendanceDate: { $gte: dateFrom, $lte: dateTo } }
        );
      } else if (from) {
        dateConditions.push(
          { markInAt: { $gte: from } },
          { inDateTime: { $gte: from } },
          { inDate: { $gte: dateFrom } },
          { date: { $gte: dateFrom } },
          { attendanceDate: { $gte: dateFrom } }
        );
      } else if (to) {
        dateConditions.push(
          { markInAt: { $lte: to } },
          { inDateTime: { $lte: to } },
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

    // NOTE: status filter is intentionally removed — report only shows APPROVED records
    // The approvalStatus: APPROVED condition is locked at query initialization above

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
    const isExport = exportFormat === 'csv' || exportFormat === 'xlsx';
    const fetchLimit = isExport ? 10000 : 500;
    const rawRecords = await Attendance.find(finalQuery)
      .select('employeeId employeeName designation plantId plantName markInPlantId markInPlantName markInLocationType inPlant outPlant street markInPlant markOutPlant markInAt inDate inTime inDateTime markOutAt outDate outTime outDateTime markOutType markOutByUserId markOutByUserName markOutPlantName status attendanceType workingMinutes hours approvalStatus approved approvedBy approvedAt attendanceDate remarks manualAttendanceBy markInManualBy markOutManualBy')
      .lean()
      .sort({ _id: -1 })
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

    // Map actual designations and assigned plants from Employee collection
    const empIds = [...new Set(rawRecords.map((r) => r.employeeId).filter(Boolean))];
    const employeeDocs = empIds.length > 0 ? await Employee.find({
      $or: [
        { employeeId: { $in: empIds } },
        { id: { $in: empIds } },
        { _id: { $in: empIds } },
      ],
    }).select('employeeId id designation fullName name plantName plantId unitIds').lean() : [];

    const designationMap = new Map();
    const empPlantMap = new Map();
    for (const emp of employeeDocs) {
      const desig = emp.designation;
      if (desig) {
        if (emp.employeeId) designationMap.set(String(emp.employeeId).toUpperCase().trim(), desig);
        if (emp.id) designationMap.set(String(emp.id).trim(), desig);
        if (emp._id) designationMap.set(String(emp._id).trim(), desig);
        if (emp.fullName) designationMap.set(String(emp.fullName).toLowerCase().trim(), desig);
        if (emp.name) designationMap.set(String(emp.name).toLowerCase().trim(), desig);
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
        if (emp.fullName) empPlantMap.set(String(emp.fullName).toLowerCase().trim(), assignedPlant);
        if (emp.name) empPlantMap.set(String(emp.name).toLowerCase().trim(), assignedPlant);
      }
    }

    const cleanPlant = (val) => {
      if (!val || typeof val !== 'string') return '';
      const t = val.trim();
      return (t === 'Manufacturing Plant' || t === '-' || t.toLowerCase() === 'n/a') ? '' : t;
    };

    const records = rawRecords.map((raw) => {
      const rec = normalizeAttendance(raw);
      const idKey = String(rec.employeeId || '').toUpperCase().trim();
      const nameKey = String(rec.employeeName || '').toLowerCase().trim();
      if (designationMap.has(idKey)) {
        rec.designation = designationMap.get(idKey);
      } else if (designationMap.has(nameKey)) {
        rec.designation = designationMap.get(nameKey);
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

      return rec;
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
          'Attendance Date': r.attendanceDate || '-',
          'Mark In Plant': isAbsent ? '-' : (r.markInPlantName || r.plantName || '-'),
          'Mark IN Date Time': !isAbsent && r.markInAt ? formatKolkataDateTime(r.markInAt) : '-',
          'Mark Out Date Time': !isAbsent && r.markOutAt ? formatKolkataDateTime(r.markOutAt) : '-',
          'Working Hour': !isAbsent && r.workingMinutes > 0 ? formatWorkingHours(r.workingMinutes) : '0:00',
          'Mark Out Type': isAbsent ? '-' : (r.markOutType || 'Self'),
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
