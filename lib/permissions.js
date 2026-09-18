/**
 * Universal Permission & Role Helper (Compatible with both Client & Server)
 */

/**
 * Normalizes permission strings from DB (handles uppercase, plural, aliases).
 */
export function normalizePermissions(rawPermissions = []) {
  if (!Array.isArray(rawPermissions)) return [];
  const normalized = new Set();
  
  for (const p of rawPermissions) {
    if (!p) continue;
    const s = String(p).trim().toLowerCase();
    normalized.add(s);

    if (s === 'dashboard') {
      normalized.add('dashboard');
    }
    if (s === 'approval' || s === 'approvals' || s === 'leave approvals') {
      normalized.add('approval');
      normalized.add('approvals');
    }
    if (s === 'employee' || s === 'employees') {
      normalized.add('employee');
      normalized.add('employees');
    }
    if (s === 'report' || s === 'reports') {
      normalized.add('report');
      normalized.add('reports');
    }
    if (s === 'plant' || s === 'plants' || s === 'settings') {
      normalized.add('plant');
      normalized.add('plants');
      normalized.add('settings');
    }
    if (s === 'user-management' || s === 'user management' || s === 'users') {
      normalized.add('user-management');
      normalized.add('users');
    }
    if (s === 'attendance' || s === 'mark-attendance' || s === 'mark attendance') {
      normalized.add('mark-attendance');
      normalized.add('attendance');
    }
  }

  return Array.from(normalized);
}

/**
 * Checks if a user has access to a specific permission/module.
 * System Admins always return true.
 */
export function hasPermission(userOrPermissions, requiredPermission) {
  if (!userOrPermissions || !requiredPermission) return false;
  const target = String(requiredPermission).trim().toLowerCase();

  // If object with role
  if (typeof userOrPermissions === 'object' && !Array.isArray(userOrPermissions)) {
    if (userOrPermissions.role === 'Admin') return true;
    const perms = normalizePermissions(userOrPermissions.permissions || []);
    return perms.includes(target);
  }

  // If array of permissions
  const perms = normalizePermissions(userOrPermissions);
  return perms.includes(target);
}
