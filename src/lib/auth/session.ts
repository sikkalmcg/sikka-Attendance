import { cookies } from 'next/headers';
import type { Role, User } from '@/lib/types';

export type SessionUser = Pick<User, 'id' | 'username' | 'fullName' | 'role' | 'plantIds'> & {
  sessionId?: string;
  employeeId?: string;
  firmId?: string | null;
  designation?: string;
  department?: string;
  mobileNumber?: string;
  aadhaarNumber?: string;
  mobile?: string;
  aadhaar?: string;
  name?: string;
};

export function parseSessionString(sessionStr: string): SessionUser | null {
  if (!sessionStr) return null;
  try {
    const raw = decodeURIComponent(sessionStr);
    const parsed = JSON.parse(raw) as SessionUser & { role?: Role };
    if (!parsed?.role) return null;
    return parsed;
  } catch {
    try {
      const parsed = JSON.parse(sessionStr) as SessionUser & { role?: Role };
      if (!parsed?.role) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}

export function getSessionUser(req?: Request): SessionUser | null {
  // 1. Check from Request headers if provided
  if (req) {
    const customHeader = req.headers.get('x-sikka-session');
    if (customHeader) {
      const parsed = parseSessionString(customHeader);
      if (parsed) return parsed;
    }

    const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(/sikka_session=([^;]+)/);
      if (match && match[1]) {
        const parsed = parseSessionString(match[1]);
        if (parsed) return parsed;
      }
    }

    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const parsed = parseSessionString(token);
      if (parsed) return parsed;
    }

    return null;
  }

  // 2. Check from Next.js server cookieStore (when req is not provided)
  try {
    const cookieStore = cookies();
    const session = cookieStore.get('sikka_session');
    if (session?.value) {
      const parsed = parseSessionString(session.value);
      if (parsed) return parsed;
    }
  } catch {
    // In contexts where cookies() is unavailable
  }

  return null;
}

export function requireSessionUser(req?: Request): SessionUser {
  const user = getSessionUser(req);
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

export function isEmployeeRole(user?: SessionUser | null): boolean {
  if (!user) return false;
  const roleStr = String(user.role || '').toUpperCase();
  return roleStr === 'EMPLOYEE';
}
