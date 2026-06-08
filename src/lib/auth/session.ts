import { cookies } from 'next/headers';
import type { Role, User } from '@/lib/types';

export type SessionUser = Pick<User, 'id' | 'username' | 'fullName' | 'role' | 'plantIds'> & {
  sessionId?: string;
};

export function getSessionUser(): SessionUser | null {
  const cookieStore = cookies();
  const session = cookieStore.get('sikka_session');
  if (!session?.value) return null;

  try {
    const parsed = JSON.parse(session.value) as SessionUser & { role?: Role };
    if (!parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function requireSessionUser(): SessionUser {
  const user = getSessionUser();
  if (!user) {
    // Frontend currently relies on cookie existence; for API we return 401.
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

