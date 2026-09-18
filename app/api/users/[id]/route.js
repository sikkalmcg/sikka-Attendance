import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { authorizeSystemUser } from '@/lib/rbac';
import { hashPassword } from '@/lib/auth';

export async function PUT(request, { params }) {
  const auth = await authorizeSystemUser(request, 'user-management');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const data = await request.json();
    await connectToDatabase();

    // First fetch to validate business rules (admin guard, mark-attendance block)
    const existing = await User.findById(id).lean();
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build $set payload — never touch userId or passwordHash unless explicitly changing password
    const updateFields = {};

    if (data.fullName !== undefined) updateFields.fullName = String(data.fullName).trim();
    if (data.role !== undefined) updateFields.role = data.role === 'Admin' ? 'Admin' : 'User';
    if (data.status !== undefined) updateFields.status = data.status;

    if (data.permissions !== undefined && Array.isArray(data.permissions)) {
      if (data.permissions.some((p) => String(p).toLowerCase() === 'mark-attendance')) {
        return NextResponse.json(
          { error: 'Mark Attendance is strictly an Employee-only function and cannot be assigned to Admin or System Users.' },
          { status: 400 }
        );
      }
      const resolvedRole = data.role === 'Admin' ? 'Admin' : (existing.role || 'User');
      updateFields.permissions = resolvedRole === 'Admin'
        ? ['dashboard', 'plant', 'approval', 'report', 'employee', 'user-management']
        : data.permissions.filter((p) => p !== 'mark-attendance');
    }

    // Password reset if provided
    if (data.password && String(data.password).trim().length > 0) {
      updateFields.passwordHash = await hashPassword(String(data.password).trim());
    }

    // Use findByIdAndUpdate to skip re-validation of required fields already in DB
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: false }
    ).lean();

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const safeUser = { ...updatedUser };
    delete safeUser.passwordHash;

    return NextResponse.json({ success: true, user: safeUser });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: error.message || 'Failed to update user' }, { status: 500 });
  }
}


export async function DELETE(request, { params }) {
  const auth = await authorizeSystemUser(request, 'user-management');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await connectToDatabase();

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.username === 'ajaysomra') {
      return NextResponse.json({ error: 'The primary administrator account cannot be deleted.' }, { status: 400 });
    }

    await User.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete user' }, { status: 500 });
  }
}
