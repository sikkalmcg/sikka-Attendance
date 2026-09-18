import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Employee from '@/models/Employee';
import { authorizeSystemUser } from '@/lib/rbac';
import { hashPassword } from '@/lib/auth';
import * as XLSX from 'xlsx';

export async function POST(request) {
  const auth = await authorizeSystemUser(request, 'employee');
  if (!auth.authorized) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'Please upload a CSV or Excel file.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return NextResponse.json({ error: 'The uploaded file is empty.' }, { status: 400 });
    }

    await connectToDatabase();

    // Fetch existing records for duplicate check
    const existingEmployees = await Employee.find({}, 'employeeId aadhaarNumber');
    const existingEmpIdSet = new Set(existingEmployees.map((e) => e.employeeId));
    const existingAadhaarSet = new Set(existingEmployees.map((e) => e.aadhaarNumber));

    const fileEmpIdSet = new Set();
    const fileAadhaarSet = new Set();

    let successfullyImported = 0;
    let duplicateRecords = 0;
    let invalidRecords = 0;
    const errors = [];
    const validToInsert = [];

    for (let index = 0; index < rawRows.length; index++) {
      const row = rawRows[index];
      const rowNum = index + 2; // Accounting for 1-based indexing and header row

      // Extract keys flexibly (handling different casings or spaces)
      const getVal = (keyNames) => {
        for (const k of keyNames) {
          if (row[k] !== undefined && String(row[k]).trim() !== '') {
            return String(row[k]).trim();
          }
        }
        return '';
      };

      const employeeId = getVal(['Employee ID', 'EmployeeId', 'employeeId', 'EMPLOYEE ID']).toUpperCase();
      const fullName = getVal(['Employee Full Name', 'FullName', 'fullName', 'Name', 'EMPLOYEE FULL NAME']);
      const designation = getVal(['Designation', 'designation', 'DESIGNATION']);
      const rawAadhaar = getVal(['Aadhaar Number', 'Aadhaar', 'aadhaarNumber', 'AADHAAR NUMBER']);
      const rawMobile = getVal(['Mobile Number', 'Mobile', 'mobileNumber', 'MOBILE NUMBER']);
      const rawAuth = getVal(['Attendance Authorization', 'AttendanceAccess', 'attendanceAuthorized', 'ATTENDANCE AUTHORIZATION']);
      const rawStatus = getVal(['Status', 'status', 'STATUS']);

      const aadhaar = rawAadhaar.replace(/\s+/g, '');
      const mobile = rawMobile.replace(/\D/g, '');

      // Check required fields
      if (!employeeId || !fullName || !designation || !aadhaar || !mobile) {
        invalidRecords++;
        errors.push({
          row: rowNum,
          employeeId: employeeId || 'N/A',
          field: 'Mandatory Fields',
          message: 'Missing required field(s): Employee ID, Full Name, Designation, Aadhaar or Mobile.',
        });
        continue;
      }

      // Format validations
      if (!/^\d{12}$/.test(aadhaar)) {
        invalidRecords++;
        errors.push({
          row: rowNum,
          employeeId,
          field: 'Aadhaar Number',
          message: `Invalid Aadhaar format '${aadhaar}'. Must be exactly 12 digits.`,
        });
        continue;
      }

      if (!/^\d{10}$/.test(mobile)) {
        invalidRecords++;
        errors.push({
          row: rowNum,
          employeeId,
          field: 'Mobile Number',
          message: `Invalid Mobile format '${mobile}'. Must be exactly 10 digits.`,
        });
        continue;
      }

      // Duplicate checks in file
      if (fileEmpIdSet.has(employeeId)) {
        duplicateRecords++;
        errors.push({
          row: rowNum,
          employeeId,
          field: 'Employee ID',
          message: `Duplicate Employee ID '${employeeId}' in upload file.`,
        });
        continue;
      }

      if (fileAadhaarSet.has(aadhaar)) {
        duplicateRecords++;
        errors.push({
          row: rowNum,
          employeeId,
          field: 'Aadhaar Number',
          message: `Duplicate Aadhaar '${aadhaar}' in upload file.`,
        });
        continue;
      }

      // Duplicate checks in DB
      if (existingEmpIdSet.has(employeeId)) {
        duplicateRecords++;
        errors.push({
          row: rowNum,
          employeeId,
          field: 'Employee ID',
          message: `Employee ID '${employeeId}' already exists in the database.`,
        });
        continue;
      }

      if (existingAadhaarSet.has(aadhaar)) {
        duplicateRecords++;
        errors.push({
          row: rowNum,
          employeeId,
          field: 'Aadhaar Number',
          message: `Aadhaar '${aadhaar}' already registered in database.`,
        });
        continue;
      }

      // Mark as seen in this file
      fileEmpIdSet.add(employeeId);
      fileAadhaarSet.add(aadhaar);

      // Authorization & Status parsing
      const attendanceAuthorized =
        rawAuth.toLowerCase() === 'not authorized' || rawAuth.toLowerCase() === 'false' || rawAuth.toLowerCase() === 'no'
          ? false
          : true;

      const status = rawStatus.toLowerCase() === 'inactive' ? 'Inactive' : 'Active';

      validToInsert.push({
        employeeId,
        fullName,
        designation,
        aadhaarNumber: aadhaar,
        mobileNumber: mobile,
        attendanceAuthorized,
        status,
      });
    }

    // Process valid inserts with hashed mobile passwords
    for (const item of validToInsert) {
      try {
        const passwordHash = await hashPassword(item.mobileNumber);
        await Employee.create({
          ...item,
          passwordHash,
        });
        successfullyImported++;
      } catch (insertErr) {
        invalidRecords++;
        errors.push({
          row: 0,
          employeeId: item.employeeId,
          field: 'Database',
          message: insertErr.message || 'Insert failed',
        });
      }
    }

    const failedRecords = duplicateRecords + invalidRecords;

    return NextResponse.json({
      success: true,
      summary: {
        totalRecords: rawRows.length,
        successfullyImported,
        failedRecords,
        duplicateRecords,
        invalidRecords,
      },
      errors,
    });
  } catch (error) {
    console.error('Bulk upload processing error:', error);
    return NextResponse.json({ error: error.message || 'Bulk upload failed' }, { status: 500 });
  }
}
