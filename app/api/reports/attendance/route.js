import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
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
    const attendanceType = searchParams.get('attendanceType'); // 'all', 'regular', 'auto'
    const exportFormat = searchParams.get('export'); // 'csv' | 'xlsx'

    // Report ONLY shows Approved records (§11)
    const query = {
      $and: [{ approvalStatus: 'APPROVED' }],
    };

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
          { inDate: { $gte: dateFrom, $lte: dateTo } }
        );
      } else if (from) {
        dateConditions.push(
          { markInAt: { $gte: from } },
          { inDateTime: { $gte: from } },
          { inDate: { $gte: dateFrom } }
        );
      } else if (to) {
        dateConditions.push(
          { markInAt: { $lte: to } },
          { inDateTime: { $lte: to } },
          { inDate: { $lte: dateTo } }
        );
      }
      if (dateConditions.length > 0) {
        query.$or = dateConditions;
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
    } else if (!plantScope.isAllPlants) {
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

    const rawRecords = await Attendance.find(query)
      .sort({ _id: -1 })
      .limit(2000);

    const records = rawRecords.map(normalizeAttendance);

    // Handle CSV or Excel Export (Section 26 Columns)
    if (exportFormat === 'csv' || exportFormat === 'xlsx') {
      const formattedRows = records.map((r) => ({
        'Employee ID': r.employeeId || '-',
        'Employee Name': r.employeeName || '-',
        'Designation': r.designation || 'Staff',
        'Mark In Plant': r.markInPlantName || r.plantName || '-',
        'Mark IN Date Time': r.markInAt ? formatKolkataDateTime(r.markInAt) : '-',
        'Mark Out Date Time': r.markOutAt ? formatKolkataDateTime(r.markOutAt) : '-',
        'Working Hour': r.workingMinutes > 0 ? formatWorkingHours(r.workingMinutes) : '0:00',
        'Status': r.status,
        'Mark Out Type': r.markOutType || 'Self',
        'Mark Out Plant': r.markOutPlantName || r.plantName || '-',
        'Manual Attendance By': r.manualAttendanceBy || '-',
        'Approved By': r.approvedBy || '-',
      }));

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
