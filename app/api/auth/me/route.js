import { NextResponse } from 'next/server';
import { getSessionUser, extractTokenFromRequest, COOKIE_NAME } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import Employee from '@/models/Employee';
import { normalizeEmployee, normalizeUser } from '@/lib/normalize';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 365 days

export async function GET(request) {
  try {
    const session = await getSessionUser(request);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    const token = await extractTokenFromRequest(request);
    const attachCookie = (response) => {
      if (token) {
        response.cookies.set(COOKIE_NAME, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: COOKIE_MAX_AGE,
          expires: new Date(Date.now() + COOKIE_MAX_AGE * 1000),
        });
      }
      return response;
    };

    await connectToDatabase();

    if (session.userType === 'SYSTEM_USER') {
      const userLookup = [];
      if (session.username) {
        userLookup.push({ username: String(session.username).trim().toLowerCase() });
      }
      if (session.sub) {
        userLookup.push({ _id: session.sub });
      }
      if (session.userId) {
        userLookup.push({ userId: session.userId });
      }

      const rawUser = await User.findOne(
        userLookup.length > 0 ? { $or: userLookup } : { username: session.username }
      );

      if (!rawUser) {
        // Fallback to session payload if database lookup has issue
        return attachCookie(
          NextResponse.json(
            {
              authenticated: true,
              token: token || undefined,
              user: {
                id: session.sub,
                userId: session.userId || session.sub,
                fullName: session.fullName || session.username,
                username: session.username,
                role: session.role || 'User',
                permissions: session.permissions || [],
                plantIds: session.plantIds || [],
                userType: 'SYSTEM_USER',
              },
            },
            { headers: NO_CACHE_HEADERS }
          )
        );
      }

      const user = normalizeUser(rawUser);
      if (user.status !== 'Active') {
        return NextResponse.json(
          { authenticated: false, error: 'User account inactive' },
          { status: 401, headers: NO_CACHE_HEADERS }
        );
      }

      return attachCookie(
        NextResponse.json(
          {
            authenticated: true,
            token: token || undefined,
            user: {
              id: user.id,
              userId: user.userId,
              fullName: user.fullName,
              username: user.username,
              role: user.role,
              permissions: user.permissions,
              plantIds: user.plantIds || [],
              userType: 'SYSTEM_USER',
            },
          },
          { headers: NO_CACHE_HEADERS }
        )
      );
    }

    if (session.userType === 'EMPLOYEE') {
      const rawEmployee = await Employee.findOne({
        $or: [
          { _id: session.sub },
          { id: session.sub },
          { employeeId: session.employeeId },
          { aadhaar: session.aadhaarNumber },
          { aadhaarNumber: session.aadhaarNumber },
        ],
      });

      if (!rawEmployee) {
        return NextResponse.json({ authenticated: false, error: 'Employee not found' }, { status: 401 });
      }

      const employee = normalizeEmployee(rawEmployee);
      if (employee.status !== 'Active') {
        return NextResponse.json({ authenticated: false, error: 'Employee inactive' }, { status: 401 });
      }

      return attachCookie(
        NextResponse.json(
          {
            authenticated: true,
            token: token || undefined,
            user: {
              id: employee.id,
              employeeId: employee.employeeId,
              fullName: employee.fullName,
              designation: employee.designation,
              aadhaarNumber: employee.aadhaarNumber,
              mobileNumber: employee.mobileNumber,
              role: 'Employee',
              attendanceAuthorized: Boolean(employee.attendanceAuthorized),
              userType: 'EMPLOYEE',
            },
          },
          { headers: NO_CACHE_HEADERS }
        )
      );
    }

    return NextResponse.json({ authenticated: false }, { status: 401, headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Session verification error:', error);
    return NextResponse.json({ authenticated: false }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
