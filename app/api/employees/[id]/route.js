import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Employee from '@/models/Employee';
import mongoose from 'mongoose';
import { authorizeSystemUser, getScopedPlantContext } from '@/lib/rbac';
import { hashPassword } from '@/lib/auth';
import { normalizeEmployee } from '@/lib/normalize';

/**
 * Safely find an employee by the given id string.
 * Tries ObjectId match first (if id looks like a valid ObjectId),
 * then falls back to { id }, { employeeId } matches.
 * This handles both new records (ObjectId _id) and legacy records
 * (string _id or employeeId-based lookup).
 */
async function findEmployeeById(id) {
  if (!id) return null;
  const decodedId = decodeURIComponent(String(id).trim());

  const conditions = [
    { _id: decodedId },        // direct string _id match (handles custom string _id)
    { id: decodedId },         // legacy 'id' field
    { employeeId: decodedId }, // business key lookup
    { employeeId: { $regex: new RegExp(`^${decodedId}$`, 'i') } },
  ];

  // Additionally try ObjectId cast if id looks like a valid ObjectId hex
  if (mongoose.Types.ObjectId.isValid(decodedId)) {
    try {
      conditions.unshift({ _id: new mongoose.Types.ObjectId(decodedId) });
    } catch {}
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
    if (data.plantId !== undefined) {
      employee.plantId = String(data.plantId).trim();
      if (employee.plantId) employee.unitIds = [employee.plantId];
    }
    if (data.plantName !== undefined) employee.plantName = String(data.plantName).trim();
    if (data.attendanceAuthorized !== undefined) employee.attendanceAuthorized = Boolean(data.attendanceAuthorized);
    if (data.status !== undefined) {
      employee.status = data.status;
      employee.active = data.status === 'Active';
    }

    // Aadhaar handling (sync both aadhaarNumber and aadhaar)
    const incomingAadhaar = data.aadhaarNumber || data.aadhaar;
    if (incomingAadhaar) {
      const cleanAadhaar = String(incomingAadhaar).trim().replace(/\D/g, '');
      employee.aadhaarNumber = cleanAadhaar;
      employee.aadhaar = cleanAadhaar;
    } else if (!employee.aadhaarNumber && employee.aadhaar) {
      employee.aadhaarNumber = String(employee.aadhaar).trim();
    }

    // Mobile & Password handling (sync both mobileNumber and mobile)
    const incomingMobile = data.mobileNumber || data.mobile;
    if (incomingMobile) {
      const cleanMobile = String(incomingMobile).trim().replace(/\D/g, '');
      if (cleanMobile.length === 10) {
        const mobileChanged = employee.mobileNumber !== cleanMobile && employee.mobile !== cleanMobile;
        employee.mobileNumber = cleanMobile;
        employee.mobile = cleanMobile;
        if (mobileChanged || !employee.passwordHash) {
          employee.passwordHash = await hashPassword(cleanMobile);
        }
      }
    } else if (!employee.mobileNumber && employee.mobile) {
      employee.mobileNumber = String(employee.mobile).trim();
    }

    // Ensure passwordHash is present
    if (!employee.passwordHash) {
      const fallbackMobile = employee.mobileNumber || employee.mobile || '1234567890';
      employee.passwordHash = await hashPassword(fallbackMobile);
    }

    await employee.save();

    const safeEmployee = normalizeEmployee(employee);
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

