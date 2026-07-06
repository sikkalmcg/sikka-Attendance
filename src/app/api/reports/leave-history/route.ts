import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { cookies } from 'next/headers';

import ExcelJS from 'exceljs';



export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeToISODateOnly(d?: string | null) {
  if (!d) return null;
  const dt = new Date(`${d}T00:00:00.000Z`);
  if (Number.isNaN(dt.getTime())) return null;
  return d; // expects YYYY-MM-DD
}

function safeUpperStatus(status: any) {
  const s = String(status ?? '').trim();
  return s ? s.toUpperCase() : '-';
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams;

    const fromDate = normalizeToISODateOnly(q.get('fromDate'));
    const toDate = normalizeToISODateOnly(q.get('toDate'));
    const search = (q.get('search') || '').trim();

    const cookieStore = cookies();
    const sessionRaw = cookieStore.get('sikka_session')?.value;
    const session = sessionRaw ? JSON.parse(sessionRaw) : null;

    const isAdmin = session?.role && ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(session.role);
    const allowedPlantIds: string[] = (session?.plantIds || []) as string[];

    // NOTE: leave export is based on leaveRequests collection.
    // If your leaveRequests schema differs, adjust fields below accordingly.
    const db = await getDb();
    const leaveCol = db.collection<any>('leaveRequests');
    const employeesCol = db.collection<any>('employees');

    const empMap = new Map<string, any>();
    if (allowedPlantIds?.length && !isAdmin) {
      // Non-admin: scope employees by plants if employee docs keep unitIds.
      // If your schema uses unitId/name instead, adjust this query.
      const emps = await employeesCol
        .find({
          $or: [
            { unitIds: { $in: allowedPlantIds } },
            { unitId: { $in: allowedPlantIds } },
            { unitName: { $in: allowedPlantIds } },
          ],
        })
        .toArray();

      for (const e of emps) empMap.set(e.employeeId, e);
    } else {
      const emps = await employeesCol.find({}).toArray();
      for (const e of emps) empMap.set(e.employeeId, e);
    }

    const leaveQuery: any = {};

    if (fromDate || toDate) {
      const start = fromDate || '1970-01-01';
      const end = toDate || '2999-12-31';
      leaveQuery.$or = [
        { fromDate: { $gte: start, $lte: end } },
        { toDate: { $gte: start, $lte: end } },
      ];
    }

    if (search) {
      // Search by employeeId or employeeName/purpose (where available)
      leaveQuery.$or = leaveQuery.$or || [];
      (leaveQuery.$or as any[]).push(
        { employeeId: { $regex: String(search), $options: 'i' } },
        { purpose: { $regex: String(search), $options: 'i' } },
        { remark: { $regex: String(search), $options: 'i' } }
      );
    }

    const leaves = await leaveCol.find(leaveQuery).toArray();

    // Post-filter by employee scope (plant access)
    const scopedLeaves = leaves.filter((l: any) => {
      const emp = empMap.get(l.employeeId);
      if (!emp) return false;
      if (isAdmin) return true;
      if (!allowedPlantIds?.length) return true;

      const empUnits: string[] = (emp.unitIds || []) as string[];
      return (
        empUnits.some((id) => allowedPlantIds.includes(id)) ||
        allowedPlantIds.includes(emp.unitId) ||
        allowedPlantIds.includes(emp.unitName)
      );
    });

    // Prepare rows
    const rows = scopedLeaves
      .map((l: any) => {
        const emp = empMap.get(l.employeeId) || {};
        const department = emp.department || 'N/A';
        const designation = emp.designation || 'N/A';

        return {
          employeeId: l.employeeId || '-',
          employeeName: l.employeeName || emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || '-',
          department,
          designation,
          leaveType: l.purpose || l.leaveType || '-',
          fromDate: l.fromDate || '-',
          toDate: l.toDate || '-',
          days: l.days ?? '-',
          remarks: l.remark || l.remarks || '-',
          approvedDate: l.processedAt || '-',
          approvedBy: l.processedByUserId || l.processedByUserId || '-',
          status: safeUpperStatus(l.status),
        };
      })
      .sort((a, b) => String(b.approvedDate).localeCompare(String(a.approvedDate)));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leave History');

    worksheet.columns = [
      { header: 'Employee ID', key: 'employeeId', width: 14 },
      { header: 'Employee Name', key: 'employeeName', width: 22 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Designation', key: 'designation', width: 20 },
      { header: 'Leave Type', key: 'leaveType', width: 22 },
      { header: 'From Date', key: 'fromDate', width: 14 },
      { header: 'To Date', key: 'toDate', width: 14 },
      { header: 'Days', key: 'days', width: 10 },
      { header: 'Remarks', key: 'remarks', width: 30 },
      { header: 'Approved Date', key: 'approvedDate', width: 16 },
      { header: 'Approved By', key: 'approvedBy', width: 18 },
      { header: 'Status', key: 'status', width: 12 },
    ];

    worksheet.getRow(1).font = { bold: true };

    for (const r of rows) {
      worksheet.addRow(r);
    }

    // styling: wrap remarks
    const remarksColIndex = worksheet.getColumn('remarks').number;
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const cell = row.getCell(remarksColIndex);
      cell.alignment = { wrapText: true, vertical: 'top' };
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="leave-history.xlsx"',
      },
    });
  } catch (error: any) {
    console.error('leave-history export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

