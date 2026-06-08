import type { SessionUser } from '@/lib/auth/session';

export function isAdmin(user: SessionUser | null): boolean {
  return !!user && ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(user.role);
}

export function isSuperAdmin(user: SessionUser | null): boolean {
  return !!user && user.role === 'SUPER_ADMIN';
}

export function canDeleteCollection(user: SessionUser | null): boolean {
  // Matches existing frontend logic: only SUPER_ADMIN can delete
  return isSuperAdmin(user);
}

