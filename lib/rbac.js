import { NextResponse } from 'next/server';
import { getSessionUser } from './auth';

/**
 * Ensures user is authenticated.
 * Returns { session } or NextResponse error.
 */
export async function authorizeRequest(request) {
  const session = await getSessionUser(request);
  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Unauthorized. Please log in to continue.' },
        { status: 401 }
      ),
    };
  }
  return { authorized: true, session };
}

import { normalizePermissions, hasPermission } from './permissions';
export { normalizePermissions, hasPermission };
export const checkPermission = hasPermission;

/**
 * Resolves the plant scoping context for the logged-in session.
 * If user is Admin or plantIds contains '*', they have full access.
 * Otherwise, maps their assigned plantIds to plant names and IDs.
 */
export async function getScopedPlantContext(session) {
  if (!session || session.role === 'Admin') {
    return { isAllPlants: true, plantIds: [], plantNames: [], plants: [] };
  }

  const rawPlantIds = Array.isArray(session.plantIds) ? session.plantIds : [];
  if (rawPlantIds.includes('*') || rawPlantIds.length === 0) {
    return { isAllPlants: true, plantIds: [], plantNames: [], plants: [] };
  }

  try {
    const Plant = (await import('@/models/Plant')).default;
    const plants = await Plant.find({
      $or: [
        { _id: { $in: rawPlantIds } },
        { id: { $in: rawPlantIds } },
        { plantId: { $in: rawPlantIds } },
      ],
    });

    const plantNames = plants.map((p) => p.plantName || p.name).filter(Boolean);
    const resolvedIds = plants.map((p) => (p._id ? p._id.toString() : p.plantId || p.id)).filter(Boolean);
    const allIds = Array.from(new Set([...resolvedIds, ...rawPlantIds]));

    return {
      isAllPlants: false,
      plantIds: allIds,
      plantNames,
      plants,
    };
  } catch (err) {
    console.error('Error resolving scoped plant context:', err);
    return { isAllPlants: false, plantIds: rawPlantIds, plantNames: [], plants: [] };
  }
}

/**
 * Ensures user is a System User (Admin or User) and has permission for the resource.
 * Admin has all permissions.
 * System user must have requiredPermission in session.permissions.
 */
export async function authorizeSystemUser(request, requiredPermission) {
  const auth = await authorizeRequest(request);
  if (!auth.authorized) return auth;

  const { session } = auth;
  if (session.userType !== 'SYSTEM_USER') {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Access restricted to administrative and system users.' },
        { status: 403 }
      ),
    };
  }

  // Admin has full access to all pages
  if (session.role === 'Admin') {
    return { authorized: true, session };
  }

  // User must have explicit permission
  if (requiredPermission && !checkPermission(session, requiredPermission)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: `You do not have access permission for ${requiredPermission}.` },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, session };
}

/**
 * Ensures user is an authorized active Employee.
 * Blocks Admins and System Users from marking attendance according to prompt rules.
 */
export async function authorizeEmployee(request) {
  const auth = await authorizeRequest(request);
  if (!auth.authorized) return auth;

  const { session } = auth;
  if (session.userType !== 'EMPLOYEE') {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Mark Attendance is strictly reserved for active employees.' },
        { status: 403 }
      ),
    };
  }

  if (!session.attendanceAuthorized) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'You are not authorized to mark attendance. Please contact your administrator.' },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, session };
}
