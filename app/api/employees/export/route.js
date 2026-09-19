import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Employee from '@/models/Employee';
import { authorizeSystemUser, getScopedPlantContext } from '@/lib/rbac';
import { normalizeEmployee } from '@/lib/normalize';
import { maskAadhaar } from '@/lib/timezone';
import * as XLSX from 'xlsx';

export async function GET(request) {
  const auth = await authorizeSystemUser(request, 'employee');
  if (!auth.authorized) return auth.response;

  const { session } = auth;
  const isAdmin = session.role === 'Admin';

  try {
    await connectToDatabase();
    const plantScope = await getScopedPlantContext(session);

    let query = {};
    if (!plantScope.isAllPlants) {
      const plantRegexes = (plantScope.plantNames || []).map(
        (name) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      );
      query = {
        $or: [
          { unitIds: { $in: plantScope.plantIds } },
          { plantId: { $in: plantScope.plantIds } },
          { plantName: { $in: plantScope.plantNames } },
          { plantName: { $in: plantRegexes } },
        ],
      };
    }

    const rawEmployees = await Employee.find(query).sort({ createdAt: -1 });
    const employees = rawEmployees.map(normalizeEmployee);

    const formattedRows = employees.map((emp) => {
      // Admin sees full Aadhaar, other authorized users see masked Aadhaar
      const displayAadhaar = isAdmin ? emp.aadhaarNumber : maskAadhaar(emp.aadhaarNumber);

      return {
        'Employee ID': emp.employeeId || '-',
        'Employee Full Name': emp.fullName || '-',
        'Designation': emp.designation || 'Staff',
        'Aadhaar Number': displayAadhaar || '-',
        'Mobile Number': emp.mobileNumber || '-',
        'Attendance Authorization': emp.attendanceAuthorized ? 'Authorized' : 'Unauthorized',
        'Status': emp.status || 'Active',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(formattedRows);

    // Auto-size column widths
    const colWidths = Object.keys(formattedRows[0] || {}).map((key) => ({
      wch: Math.max(key.length + 3, 16),
    }));
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="employee_directory.xlsx"',
      },
    });
  } catch (error) {
    console.error('Employee export error:', error);
    return NextResponse.json({ error: 'Failed to export employee records' }, { status: 500 });
  }
}
