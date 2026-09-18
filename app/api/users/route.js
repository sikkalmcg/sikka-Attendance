import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { authorizeSystemUser } from '@/lib/rbac';
import { hashPassword } from '@/lib/auth';

export async function GET(request) {
  const auth = await authorizeSystemUser(request, 'user-management');
  if (!auth.authorized) return auth.response;

  try {
    await connectToDatabase();
    const users = await User.find({}).select('-passwordHash').sort({ createdAt: -1 });
    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await authorizeSystemUser(request, 'user-management');
  if (!auth.authorized) return auth.response;

  try {
    const data = await request.json();
    const { userId, fullName, username, password, role, status, permissions } = data;

    if (!userId || !fullName || !username || !password) {
      return NextResponse.json(
        { error: 'User ID, Full Name, Username, and Password are required.' },
        { status: 400 }
      );
    }

    const cleanUsername = String(username).trim().toLowerCase();

    await connectToDatabase();

    const existingUser = await User.findOne({ username: cleanUsername });
    if (existingUser) {
      return NextResponse.json({ error: 'Username already in use.' }, { status: 400 });
    }

    const existingUserId = await User.findOne({ userId: String(userId).trim() });
    if (existingUserId) {
      return NextResponse.json({ error: 'User ID already exists.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(String(password).trim());

    // Section 13: User Management must reject any attempt to assign Mark Attendance permission to an Admin/User
    if (Array.isArray(permissions) && permissions.some((p) => String(p).toLowerCase() === 'mark-attendance')) {
      return NextResponse.json(
        { error: 'Mark Attendance is strictly an Employee-only function and cannot be assigned to Admin or System Users.' },
        { status: 400 }
      );
    }

    const cleanPermissions = Array.isArray(permissions) ? permissions.filter((p) => p !== 'mark-attendance') : ['dashboard'];

    const user = await User.create({
      userId: String(userId).trim(),
      fullName: String(fullName).trim(),
      username: cleanUsername,
      passwordHash,
      role: role === 'Admin' ? 'Admin' : 'User',
      status: status || 'Active',
      permissions: role === 'Admin' ? ['dashboard', 'plant', 'approval', 'report', 'employee', 'user-management'] : cleanPermissions,
    });


    const safeUser = user.toObject();
    delete safeUser.passwordHash;

    return NextResponse.json({ success: true, user: safeUser }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 500 });
  }
}
