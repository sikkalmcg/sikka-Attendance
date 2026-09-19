import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Employee from '@/models/Employee';
import mongoose from 'mongoose';
import { authorizeSystemUser, getScopedPlantContext } from '@/lib/rbac';
import { hashPassword } from '@/lib/auth';

/**
 * Safely find an employee by the given id string.
 * Tries ObjectId match first (if id looks like a valid ObjectId),
 * then falls back to { id }, { employeeId } matches.
 * This handles both new records (ObjectId _id) and legacy records
 * (string _id or employeeId-based lookup).
 */
async function findEmployeeById(id) {
  // Build OR conditions — always include string _id and employeeId matches
  // This handles legacy records where _id is a custom string (not an ObjectId)
  const conditions = [
    { _id: id },        // direct string _id match (handles custom string _id)
    { id: id },         // legacy 'id' field
    { employeeId: id }, // business key lookup
  ];

  // Additionally try ObjectId cast if id looks like a valid ObjectId hex
  if (mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id) {
    conditions.unshift({ _id: new mongoose.Types.ObjectId(id) });
  }

  return Employee.findOne({ $or: conditions });
}


export async function PUT(request, { params }) {
  const auth = await authorizeSystemUser(request, 'employee');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const data = await request.json();
    await connectToDatabase();

    const employee = await findEmployeeById(id);
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Plant-Level Data Security: verify logged in user has access to employee's plant
    const plantScope = await getScopedPlantContext(auth.session);
    if (!plantScope.isAllPlants) {
      const empPlantId = employee.plantId;
      const empPlantName = employee.plantName;
      const hasPlantAccess =
        (empPlantId && plantScope.plantIds.includes(String(empPlantId))) ||
        (empPlantName && plantScope.plantNames.map((n) => n.toLowerCase()).includes(String(empPlantName).toLowerCase()));
      if (!hasPlantAccess) {
        return NextResponse.json(
          { error: 'Access denied: You do not have permission to manage employees for this plant.' },
          { status: 403 }
        );
      }
    }

    if (data.fullName !== undefined) {
      employee.fullName = String(data.fullName).trim();
      employee.name = employee.fullName;
    }
    if (data.designation !== undefined) employee.designation = String(data.designation).trim();
    if (data.plantId !== undefined) employee.plantId = String(data.plantId).trim();
    if (data.plantName !== undefined) employee.plantName = String(data.plantName).trim();
    if (data.attendanceAuthorized !== undefined) employee.attendanceAuthorized = Boolean(data.attendanceAuthorized);
    if (data.status !== undefined) {
      employee.status = data.status;
      employee.active = data.status === 'Active';
    }

    // If mobile number changed, update password hash accordingly
    if (data.mobileNumber && data.mobileNumber !== employee.mobileNumber) {
      const cleanMobile = String(data.mobileNumber).trim();
      if (!/^\d{10}$/.test(cleanMobile)) {
        return NextResponse.json({ error: 'Mobile Number must be 10 digits.' }, { status: 400 });
      }
      employee.mobileNumber = cleanMobile;
      employee.mobile = cleanMobile;
      employee.passwordHash = await hashPassword(cleanMobile);
    }

    await employee.save();

    const safeEmployee = employee.toObject();
    delete safeEmployee.passwordHash;

    return NextResponse.json({ success: true, employee: safeEmployee });
  } catch (error) {
    console.error('Error updating employee:', error);
    return NextResponse.json({ error: error.message || 'Failed to update employee' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await authorizeSystemUser(request, 'employee');
  if (!auth.authorized) return auth.response;

  // ── Admin-only gate ──────────────────────────────────────────────────────
  if (auth.session.role !== 'Admin') {
    return NextResponse.json(
      { error: 'Only Administrators are allowed to remove employees.' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    await connectToDatabase();

    const employee = await findEmployeeById(id);
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Plant-Level Data Security: verify logged in user has access to employee's plant
    const plantScope = await getScopedPlantContext(auth.session);
    if (!plantScope.isAllPlants) {
      const empPlantId = employee.plantId;
      const empPlantName = employee.plantName;
      const hasPlantAccess =
        (empPlantId && plantScope.plantIds.includes(String(empPlantId))) ||
        (empPlantName && plantScope.plantNames.map((n) => n.toLowerCase()).includes(String(empPlantName).toLowerCase()));
      if (!hasPlantAccess) {
        return NextResponse.json(
          { error: 'Access denied: You do not have permission to remove employees for this plant.' },
          { status: 403 }
        );
      }
    }

    // ── Soft-deactivate (NEVER hard-delete — attendance history must be preserved) ──
    employee.status = 'Inactive';
    employee.active = false;
    employee.isActive = false;
    employee.loginEnabled = false;
    employee.deactivatedAt = new Date();
    employee.deactivatedBy = auth.session.fullName || auth.session.username || auth.session.userId || 'Admin';

    await employee.save();

    return NextResponse.json({
      success: true,
      message: `Employee "${employee.fullName}" has been deactivated. Their attendance history is preserved.`,
    });
  } catch (error) {
    console.error('Error deactivating employee:', error);
    return NextResponse.json({ error: error.message || 'Failed to deactivate employee' }, { status: 500 });
  }
}

