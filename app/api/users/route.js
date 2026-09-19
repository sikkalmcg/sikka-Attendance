import { NextResponse } from 'next/server';
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

export async function GET(request) {
  const auth = await authorizeSystemUser(request, 'user-management');
  if (!auth.authorized) return auth.response;

  try {
    await connectToDatabase();
    const users = await User.find({}).select('-passwordHash').sort({ createdAt: -1 });
    return NextResponse.json({ success: true, users }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function POST(request) {
  const auth = await authorizeSystemUser(request, 'user-management');
  if (!auth.authorized) return auth.response;

  try {
    const data = await request.json();
    const { userId: reqUserId, fullName, username, password, role, status, permissions, plantIds } = data;

    if (!fullName || !username || !password) {
      return NextResponse.json(
        { error: 'Full Name, Username, and Password are required.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const cleanUsername = String(username).trim().toLowerCase();

    await connectToDatabase();

    const existingUser = await User.findOne({ username: cleanUsername });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already in use. Please choose another username.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    let finalUserId = reqUserId ? String(reqUserId).trim() : '';
    if (!finalUserId) {
      const userCount = await User.countDocuments();
      finalUserId = `USR-${String(userCount + 1).padStart(3, '0')}`;
    }

    const existingUserId = await User.findOne({ userId: finalUserId });
    if (existingUserId) {
      finalUserId = `USR-${Date.now().toString().slice(-4)}`;
    }

    const passwordHash = await hashPassword(String(password).trim());

    // User Management must reject any attempt to assign Mark Attendance permission to an Admin/User
    if (Array.isArray(permissions) && permissions.some((p) => String(p).toLowerCase() === 'mark-attendance')) {
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

    const cleanPermissions = Array.isArray(permissions)
      ? Array.from(new Set(
          permissions
            .map((p) => String(p).trim().toLowerCase())
            .map((p) => PERMISSION_ID_MAP[p] || p)
            .filter((p) => VALID_PERMISSION_IDS.includes(p))
        ))
      : ['dashboard'];

    const cleanPlantIds = Array.isArray(plantIds) ? plantIds.filter(Boolean) : [];

    const user = await User.create({
      userId: finalUserId,
      fullName: String(fullName).trim(),
      username: cleanUsername,
      passwordHash,
      role: role === 'Admin' ? 'Admin' : 'User',
      status: status || 'Active',
      permissions: cleanPermissions,
      plantIds: role === 'Admin' && cleanPlantIds.length === 0 ? ['*'] : cleanPlantIds,
    });

    const safeUser = user.toObject();
    delete safeUser.passwordHash;

    return NextResponse.json({ success: true, user: safeUser }, { status: 201, headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
