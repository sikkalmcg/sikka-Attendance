import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { authorizeSystemUser } from '@/lib/rbac';
import { hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(request, { params }) {
  const auth = await authorizeSystemUser(request, 'user-management');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await connectToDatabase();

    const queryList = [{ _id: id }, { id: id }, { userId: id }];
    if (mongoose.Types.ObjectId.isValid(id)) {
      queryList.unshift({ _id: new mongoose.Types.ObjectId(id) });
    }

    const user = await User.findOne({ $or: queryList }).select('-passwordHash').lean();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    return NextResponse.json({ success: true, user }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function PUT(request, { params }) {
  const auth = await authorizeSystemUser(request, 'user-management');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const data = await request.json();
    await connectToDatabase();

    const queryList = [{ _id: id }, { id: id }, { userId: id }];
    if (mongoose.Types.ObjectId.isValid(id)) {
      queryList.unshift({ _id: new mongoose.Types.ObjectId(id) });
    }
    const existing = await User.findOne({ $or: queryList }).lean();
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    // Build $set payload — never touch userId or passwordHash unless explicitly changing password
    const updateFields = {};

    if (data.fullName !== undefined) updateFields.fullName = String(data.fullName).trim();

    if (data.username !== undefined) {
      const cleanUsername = String(data.username).trim().toLowerCase();
      if (cleanUsername !== existing.username) {
        const dup = await User.findOne({
          username: cleanUsername,
          _id: { $ne: existing._id },
        });
        if (dup) {
          return NextResponse.json({ error: 'Username already in use by another user.' }, { status: 400, headers: NO_CACHE_HEADERS });
        }
        updateFields.username = cleanUsername;
      }
    }

    if (data.role !== undefined) updateFields.role = data.role === 'Admin' ? 'Admin' : 'User';
    if (data.status !== undefined) updateFields.status = data.status;

    if (data.plantIds !== undefined && Array.isArray(data.plantIds)) {
      updateFields.plantIds = data.plantIds.filter(Boolean);
    }

    if (data.permissions !== undefined && Array.isArray(data.permissions)) {
      if (data.permissions.some((p) => String(p).toLowerCase() === 'mark-attendance')) {
        return NextResponse.json(
          { error: 'Mark Attendance is strictly an Employee-only function and cannot be assigned to Admin or System Users.' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
      const VALID_PERMISSION_IDS = ['dashboard', 'plant', 'approval', 'report', 'employee', 'user-management'];
      const PERMISSION_ID_MAP = {
        dashboard: 'dashboard',
        plant: 'plant',
        plants: 'plant',
        approval: 'approval',
        approvals: 'approval',
        report: 'report',
        reports: 'report',
        employee: 'employee',
        employees: 'employee',
        'user-management': 'user-management',
        'user management': 'user-management',
        users: 'user-management',
      };

      // Save exact valid permissions chosen by Admin/User Management user
      updateFields.permissions = Array.from(new Set(
        data.permissions
          .map((p) => String(p).trim().toLowerCase())
          .map((p) => PERMISSION_ID_MAP[p] || p)
          .filter((p) => VALID_PERMISSION_IDS.includes(p))
      ));
    }

    // Password reset if provided
    if (data.password && String(data.password).trim().length > 0) {
      updateFields.passwordHash = await hashPassword(String(data.password).trim());
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: existing._id },
      { $set: updateFields },
      { new: true, runValidators: false }
    ).lean();

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    const safeUser = { ...updatedUser };
    delete safeUser.passwordHash;

    return NextResponse.json({ success: true, user: safeUser }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: error.message || 'Failed to update user' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function DELETE(request, { params }) {
  const auth = await authorizeSystemUser(request, 'user-management');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await connectToDatabase();

    const queryList = [{ _id: id }, { id: id }, { userId: id }];
    if (mongoose.Types.ObjectId.isValid(id)) {
      queryList.unshift({ _id: new mongoose.Types.ObjectId(id) });
    }

    const user = await User.findOne({ $or: queryList });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    if (user.username === 'ajaysomra') {
      return NextResponse.json({ error: 'The primary administrator account cannot be deleted.' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    await User.deleteOne({ _id: user._id });

    return NextResponse.json({ success: true, message: 'User deleted successfully' }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete user' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
