import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import Employee from '@/models/Employee';
import { verifyPassword, createSessionToken, COOKIE_NAME } from '@/lib/auth';
import { normalizeEmployee, normalizeUser } from '@/lib/normalize';

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and Password are required.' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const cleanUsername = String(username).trim();
    const cleanPassword = String(password).trim();

    // 1. Try finding in System Users (Admin / User)
    const rawUser = await User.findOne({
      username: cleanUsername.toLowerCase(),
    });

    if (rawUser) {
      const user = normalizeUser(rawUser);

      if (user.status !== 'Active') {
        return NextResponse.json(
          { error: 'Your account is deactivated. Please contact your administrator.' },
          { status: 403 }
        );
      }

      // Check password: first try bcrypt hash, then fallback to stored password if existing DB
      let isPasswordValid = false;
      if (user.passwordHash) {
        isPasswordValid = await verifyPassword(cleanPassword, user.passwordHash);
      }
      if (!isPasswordValid && user.password) {
        isPasswordValid = cleanPassword === user.password;
      }

      if (!isPasswordValid) {
        return NextResponse.json(
          { error: 'Invalid username or password.' },
          { status: 401 }
        );
      }

      // Create session payload for Admin / System User
      const payload = {
        sub: user.id,
        userId: user.userId,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        permissions: Array.isArray(user.permissions) ? user.permissions : [],
        plantIds: Array.isArray(user.plantIds) ? user.plantIds : [],
        userType: 'SYSTEM_USER',
      };

      const token = await createSessionToken(payload);

      const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 365 days
      const COOKIE_EXPIRES = new Date(Date.now() + COOKIE_MAX_AGE * 1000);

      const response = NextResponse.json({
        success: true,
        token,
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
        redirectTo: '/dashboard',
      });

      // Set secure HTTP-only persistent cookie
      response.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE,
        expires: COOKIE_EXPIRES,
      });

      return response;
    }

    // 2. Try finding in Employees
    // Supports: Aadhaar Number (12 digits), Mobile Number, or Employee ID
    const normalizedAadhaar = cleanUsername.replace(/\s+/g, '');
    const rawEmployee = await Employee.findOne({
      $or: [
        { aadhaar: normalizedAadhaar },
        { aadhaarNumber: normalizedAadhaar },
        { mobile: cleanUsername },
        { mobileNumber: cleanUsername },
        { employeeId: cleanUsername.toUpperCase() },
        { id: cleanUsername },
      ],
    });

    if (rawEmployee) {
      const employee = normalizeEmployee(rawEmployee);

      // Block inactive employees — check both status and the new soft-delete flags
      const rawEmpDoc = rawEmployee.toObject ? rawEmployee.toObject() : rawEmployee;
      if (
        employee.status !== 'Active' ||
        rawEmpDoc.isActive === false ||
        rawEmpDoc.loginEnabled === false
      ) {
        return NextResponse.json(
          { error: 'Employee profile is inactive. Please contact the administrator.' },
          { status: 403 }
        );
      }

      // Verify Employee Password = Employee's Mobile Number (or passwordHash)
      let isPasswordValid = false;

      // Check hashed password if available
      if (employee.passwordHash) {
        isPasswordValid = await verifyPassword(cleanPassword, employee.passwordHash);
      }

      // Check password matching employee's mobile number
      if (!isPasswordValid) {
        const cleanEmpMobile = (employee.mobileNumber || '').replace(/\D/g, '');
        const cleanInputPass = cleanPassword.replace(/\D/g, '');
        if (
          cleanInputPass.length >= 10 &&
          cleanEmpMobile.length >= 10 &&
          cleanEmpMobile.slice(-10) === cleanInputPass.slice(-10)
        ) {
          isPasswordValid = true;
        }
      }

      // Check plain password if existing document has one
      if (!isPasswordValid && employee.password) {
        isPasswordValid = cleanPassword === employee.password;
      }

      if (!isPasswordValid) {
        return NextResponse.json(
          { error: 'Invalid Aadhaar number or Mobile number.' },
          { status: 401 }
        );
      }

      const payload = {
        sub: employee.id,
        employeeId: employee.employeeId,
        fullName: employee.fullName,
        designation: employee.designation,
        aadhaarNumber: employee.aadhaarNumber,
        mobileNumber: employee.mobileNumber,
        role: 'Employee',
        attendanceAuthorized: Boolean(employee.attendanceAuthorized),
        userType: 'EMPLOYEE',
      };

      const token = await createSessionToken(payload);

      const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 365 days
      const COOKIE_EXPIRES = new Date(Date.now() + COOKIE_MAX_AGE * 1000);

      const response = NextResponse.json({
        success: true,
        token,
        user: {
          id: employee.id,
          employeeId: employee.employeeId,
          fullName: employee.fullName,
          designation: employee.designation,
          role: 'Employee',
          attendanceAuthorized: Boolean(employee.attendanceAuthorized),
          userType: 'EMPLOYEE',
        },
        redirectTo: '/mark-attendance',
      });

      response.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE,
        expires: COOKIE_EXPIRES,
      });

      return response;
    }

    // 3. Neither matched
    return NextResponse.json(
      { error: 'Invalid username or password.' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An unexpected authentication error occurred.' },
      { status: 500 }
    );
  }
}


