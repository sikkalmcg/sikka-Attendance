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
 * As required by Database as Source of Truth, reads authoritative role and plantIds
 * directly from the User database record if available.
 * If user is Admin or plantIds contains '*', they have full access.
 * Otherwise, maps their assigned plantIds to plant names and IDs.
 */
export async function getScopedPlantContext(session) {
  if (!session) {
    return {
      isAllPlants: false,
      plantIds: ['__UNAUTHORIZED_NO_SESSION__'],
      plantNames: ['__UNAUTHORIZED_NO_SESSION__'],
      plants: [],
    };
  }

  let userRole = session.role || 'User';
  let rawPlantIds = Array.isArray(session.plantIds) ? [...session.plantIds] : [];

  // Database as Source of Truth: query authoritative User model directly
  try {
    const User = (await import('@/models/User')).default;
    const mongoose = (await import('mongoose')).default;
    const orClauses = [];

    if (session.sub) {
      orClauses.push({ _id: session.sub });
      if (mongoose.Types.ObjectId.isValid(session.sub)) {
        orClauses.push({ _id: new mongoose.Types.ObjectId(session.sub) });
      }
    }
    if (session.userId) {
      orClauses.push({ userId: session.userId });
    }
    if (session.username) {
      orClauses.push({ username: String(session.username).toLowerCase() });
    }

    if (orClauses.length > 0) {
      const userDoc = await User.findOne({ $or: orClauses })
        .select('role plantIds status')
        .lean();
      if (userDoc) {
        if (userDoc.role) userRole = userDoc.role;
        if (Array.isArray(userDoc.plantIds)) rawPlantIds = userDoc.plantIds;
      }
    }
  } catch (err) {
    console.error('Error fetching authoritative user plant permissions from DB:', err);
  }

  // Admin role has unrestricted All-Plant access
  if (userRole === 'Admin') {
    return { isAllPlants: true, plantIds: [], plantNames: [], plants: [] };
  }

  // Explicit All-Plant wildcard indicators
  const isAllPlantsAssigned = rawPlantIds.some((p) => {
    const val = String(p).trim().toLowerCase();
    return val === '*' || val === 'all' || val === 'all plants';
  });

  if (isAllPlantsAssigned) {
    return { isAllPlants: true, plantIds: [], plantNames: [], plants: [] };
  }

  // Non-admin users with no assigned plants cannot view any plant data
  if (rawPlantIds.length === 0) {
    return {
      isAllPlants: false,
      plantIds: ['__UNAUTHORIZED_NO_PLANT_ACCESS__'],
      plantNames: ['__UNAUTHORIZED_NO_PLANT_ACCESS__'],
      plants: [],
    };
  }

  try {
    const Plant = (await import('@/models/Plant')).default;
    const plants = await Plant.find({
      $or: [
        { _id: { $in: rawPlantIds } },
        { id: { $in: rawPlantIds } },
        { plantId: { $in: rawPlantIds } },
        { plantName: { $in: rawPlantIds } },
        { name: { $in: rawPlantIds } },
      ],
    }).lean();

    const plantNames = Array.from(
      new Set([
        ...plants.map((p) => p.plantName || p.name).filter(Boolean),
        ...rawPlantIds,
      ])
    );
    const resolvedIds = plants
      .map((p) => (p._id ? p._id.toString() : p.plantId || p.id))
      .filter(Boolean);
    const allIds = Array.from(new Set([...resolvedIds, ...rawPlantIds]));

    return {
      isAllPlants: false,
      plantIds: allIds,
      plantNames,
      plants,
    };
  } catch (err) {
    console.error('Error resolving scoped plant context:', err);
    return { isAllPlants: false, plantIds: rawPlantIds, plantNames: rawPlantIds, plants: [] };
  }
}

/**
 * Validates whether a target plantId or plantName matches the user's scoped plant context.
 */
export function hasPlantAccess(plantScope, { plantId, plantName, unitIds } = {}) {
  if (!plantScope) return false;
  if (plantScope.isAllPlants) return true;

  const allowedIds = new Set((plantScope.plantIds || []).map((id) => String(id).trim()));
  const allowedNames = new Set(
    (plantScope.plantNames || []).map((name) => String(name).trim().toLowerCase())
  );

  // Check plantId
  if (plantId && allowedIds.has(String(plantId).trim())) {
    return true;
  }
  if (plantId && allowedNames.has(String(plantId).trim().toLowerCase())) {
    return true;
  }

  // Check plantName
  if (plantName && allowedNames.has(String(plantName).trim().toLowerCase())) {
    return true;
  }
  if (plantName && allowedIds.has(String(plantName).trim())) {
    return true;
  }

  // Check unitIds array
  if (Array.isArray(unitIds)) {
    for (const uid of unitIds) {
      if (uid && (allowedIds.has(String(uid).trim()) || allowedNames.has(String(uid).trim().toLowerCase()))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Validates whether the employee's assigned plant belongs to the user's scoped plant context.
 */
export function hasEmployeePlantAccess(plantScope, employee) {
  if (!plantScope) return false;
  if (plantScope.isAllPlants) return true;
  if (!employee) return false;

  return hasPlantAccess(plantScope, {
    plantId: employee.plantId,
    plantName: employee.plantName,
    unitIds: employee.unitIds,
  });
}

/**
 * Validates whether an attendance record (and optionally its employee) belongs to the user's scoped plant context.
 */
export function hasAttendancePlantAccess(plantScope, record, employee = null) {
  if (!plantScope) return false;
  if (plantScope.isAllPlants) return true;
  if (!record) return false;

  // Check attendance record plant fields
  const recordAccess =
    hasPlantAccess(plantScope, { plantId: record.plantId, plantName: record.plantName }) ||
    hasPlantAccess(plantScope, { plantId: record.markInPlantId, plantName: record.markInPlantName }) ||
    hasPlantAccess(plantScope, { plantId: record.markOutPlantId, plantName: record.markOutPlantName }) ||
    hasPlantAccess(plantScope, { plantName: record.inPlant }) ||
    hasPlantAccess(plantScope, { plantName: record.outPlant });

  if (!recordAccess) {
    return false;
  }

  // If employee record is available, employee's assigned plant must also match
  if (employee) {
    return hasEmployeePlantAccess(plantScope, employee);
  }

  return true;
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
