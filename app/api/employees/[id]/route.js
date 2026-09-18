import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Employee from '@/models/Employee';
import { authorizeSystemUser } from '@/lib/rbac';
import { hashPassword } from '@/lib/auth';

export async function PUT(request, { params }) {
  const auth = await authorizeSystemUser(request, 'employee');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const data = await request.json();
    await connectToDatabase();

    const employee = await Employee.findOne({
      $or: [{ _id: id }, { id: id }, { employeeId: id }],
    });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
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

  try {
    const { id } = await params;
    await connectToDatabase();

    const employee = await Employee.findOneAndDelete({
      $or: [{ _id: id }, { id: id }, { employeeId: id }],
    });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete employee' }, { status: 500 });
  }
}
