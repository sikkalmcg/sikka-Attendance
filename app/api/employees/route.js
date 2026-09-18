import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Employee from '@/models/Employee';
import { authorizeSystemUser, getScopedPlantContext } from '@/lib/rbac';
import { hashPassword } from '@/lib/auth';
import { normalizeEmployee } from '@/lib/normalize';

export async function GET(request) {
  const auth = await authorizeSystemUser(request, 'employee');
  if (!auth.authorized) return auth.response;

  try {
    await connectToDatabase();
    const plantScope = await getScopedPlantContext(auth.session);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const authorization = searchParams.get('authorization') || '';

    const queryParts = [];

    if (status) {
      if (status === 'Active') {
        queryParts.push({ $or: [{ status: 'Active' }, { active: true }, { active: { $exists: false }, status: { $exists: false } }] });
      } else {
        queryParts.push({ $or: [{ status: 'Inactive' }, { active: false }] });
      }
    }
    if (authorization) {
      queryParts.push({ attendanceAuthorized: authorization === 'Authorized' });
    }
    if (search) {
      queryParts.push({
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { employeeId: { $regex: search, $options: 'i' } },
          { designation: { $regex: search, $options: 'i' } },
          { aadhaarNumber: { $regex: search, $options: 'i' } },
          { aadhaar: { $regex: search, $options: 'i' } },
          { mobileNumber: { $regex: search, $options: 'i' } },
          { mobile: { $regex: search, $options: 'i' } },
        ],
      });
    }

    if (!plantScope.isAllPlants) {
      queryParts.push({
        $or: [
          { unitIds: { $in: plantScope.plantIds } },
          { plantId: { $in: plantScope.plantIds } },
          { plantName: { $in: plantScope.plantNames } },
        ],
      });
    }

    const query = queryParts.length > 0 ? { $and: queryParts } : {};

    const rawEmployees = await Employee.find(query)
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    const employees = rawEmployees.map(normalizeEmployee);

    return NextResponse.json({ success: true, employees });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await authorizeSystemUser(request, 'employee');
  if (!auth.authorized) return auth.response;

  try {
    const data = await request.json();
    const {
      employeeId,
      fullName,
      designation,
      aadhaarNumber,
      mobileNumber,
      plantId,
      plantName,
      attendanceAuthorized,
      status,
    } = data;

    // Mandatory validations
    if (!employeeId || !fullName || !designation || !aadhaarNumber || !mobileNumber) {
      return NextResponse.json(
        { error: 'Employee ID, Full Name, Designation, Aadhaar Number, and Mobile Number are mandatory.' },
        { status: 400 }
      );
    }

    const cleanEmployeeId = String(employeeId).trim().toUpperCase();
    const cleanAadhaar = String(aadhaarNumber).trim().replace(/\s+/g, '');
    const cleanMobile = String(mobileNumber).trim();

    if (!/^\d{12}$/.test(cleanAadhaar)) {
      return NextResponse.json({ error: 'Aadhaar Number must be exactly 12 digits.' }, { status: 400 });
    }

    if (!/^\d{10}$/.test(cleanMobile)) {
      return NextResponse.json({ error: 'Mobile Number must be exactly 10 digits.' }, { status: 400 });
    }

    await connectToDatabase();

    // Check duplicates
    const duplicateEmpId = await Employee.findOne({ employeeId: cleanEmployeeId });
    if (duplicateEmpId) {
      return NextResponse.json({ error: `Employee ID ${cleanEmployeeId} is already registered.` }, { status: 400 });
    }

    const duplicateAadhaar = await Employee.findOne({ aadhaarNumber: cleanAadhaar });
    if (duplicateAadhaar) {
      return NextResponse.json({ error: 'Aadhaar Number is already registered with another employee.' }, { status: 400 });
    }

    // Password is set to Employee Mobile Number hashed
    const passwordHash = await hashPassword(cleanMobile);

    const employee = await Employee.create({
      employeeId: cleanEmployeeId,
      fullName: String(fullName).trim(),
      designation: String(designation).trim(),
      aadhaarNumber: cleanAadhaar,
      mobileNumber: cleanMobile,
      plantId: plantId ? String(plantId).trim() : '',
      plantName: plantName ? String(plantName).trim() : '',
      passwordHash,
      attendanceAuthorized: attendanceAuthorized !== undefined ? Boolean(attendanceAuthorized) : true,
      status: status || 'Active',
    });

    const safeEmployee = employee.toObject();
    delete safeEmployee.passwordHash;

    return NextResponse.json({ success: true, employee: safeEmployee }, { status: 201 });
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json({ error: error.message || 'Failed to create employee' }, { status: 500 });
  }
}
