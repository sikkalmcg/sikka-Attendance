import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Employee from '@/models/Employee';
import Plant from '@/models/Plant';
import { authorizeSystemUser, getScopedPlantContext, hasPlantAccess } from '@/lib/rbac';
import { hashPassword } from '@/lib/auth';
import { normalizeEmployee } from '@/lib/normalize';

export async function GET(request) {
  // Allow users with 'employee' or 'approval' permission to fetch scoped employees
  let auth = await authorizeSystemUser(request, 'employee');
  if (!auth.authorized) {
    auth = await authorizeSystemUser(request, 'approval');
  }
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
      const plantRegexes = (plantScope.plantNames || []).map(
        (name) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      );
      queryParts.push({
        $or: [
          { unitIds: { $in: plantScope.plantIds } },
          { plantId: { $in: plantScope.plantIds } },
          { plantName: { $in: plantScope.plantNames } },
          { plantName: { $in: plantRegexes } },
        ],
      });
    }

    const query = queryParts.length > 0 ? { $and: queryParts } : {};

    const rawEmployees = await Employee.find(query)
      .select('-passwordHash -avatar -photo -image -profileImage')
      .lean()
      .sort({ _id: -1 });

    const rawPlants = await Plant.find().select('plantId plantName name').lean();
    const plantMap = new Map();
    for (const p of rawPlants) {
      const name = p.plantName || p.name || 'Plant';
      if (p._id) plantMap.set(String(p._id), name);
      if (p.plantId) plantMap.set(String(p.plantId), name);
      if (p.id) plantMap.set(String(p.id), name);
    }

    const employees = rawEmployees.map((raw) => {
      const emp = normalizeEmployee(raw);
      if (!emp.plantName || plantMap.has(emp.plantName) || /^[0-9a-zA-Z]{15,30}$/.test(emp.plantName)) {
        const lookup = emp.plantId || (Array.isArray(raw.unitIds) ? raw.unitIds[0] : '');
        if (lookup && plantMap.has(String(lookup))) {
          emp.plantName = plantMap.get(String(lookup));
        } else if (emp.plantName && plantMap.has(String(emp.plantName))) {
          emp.plantName = plantMap.get(String(emp.plantName));
        }
      }
      return emp;
    });

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

    // Plant-Wise User Access Control (Requirements 1, 8, 10)
    const plantScope = await getScopedPlantContext(auth.session);
    let resolvedPlantId = plantId ? String(plantId).trim() : '';
    let resolvedPlantName = plantName ? String(plantName).trim() : '';

    if (resolvedPlantId || resolvedPlantName) {
      const matchPlant = await Plant.findOne({
        $or: [
          ...(resolvedPlantId ? [{ _id: resolvedPlantId }, { id: resolvedPlantId }, { plantId: resolvedPlantId }] : []),
          ...(resolvedPlantName ? [{ plantName: resolvedPlantName }, { name: resolvedPlantName }] : []),
        ],
      }).lean();

      if (matchPlant) {
        resolvedPlantId = matchPlant.plantId || (matchPlant._id ? String(matchPlant._id) : resolvedPlantId);
        resolvedPlantName = matchPlant.plantName || matchPlant.name || resolvedPlantName;
      }
    }

    if (!plantScope.isAllPlants) {
      if (!resolvedPlantId && !resolvedPlantName) {
        return NextResponse.json(
          { error: 'Plant selection is required. Please select a plant assigned to your account.' },
          { status: 400 }
        );
      }

      const hasAccess = hasPlantAccess(plantScope, { plantId: resolvedPlantId, plantName: resolvedPlantName });
      if (!hasAccess) {
        return NextResponse.json(
          { error: `Access denied: You do not have permission to add employees to plant "${resolvedPlantName || resolvedPlantId}".` },
          { status: 403 }
        );
      }
    }

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
      plantId: resolvedPlantId,
      plantName: resolvedPlantName,
      unitIds: resolvedPlantId ? [resolvedPlantId] : [],
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
