import { matchPlantForLocation } from './geolocation.js';

export const OUTSIDE_PLANT_LABEL = 'Outside Plant';

/** Returns every plant reference assigned to the employee at the action time. */
export function getAssignedPlantReferences(employee, session = {}) {
  return Array.from(new Set([
    employee?.plantId,
    employee?.plantName,
    ...(Array.isArray(employee?.unitIds) ? employee.unitIds : []),
    session.plantId,
    session.plantName,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean)));
}

/** MongoDB filter which resolves plant IDs, names, and legacy ID fields. */
export function getAssignedPlantQuery(plantReferences) {
  return {
    $or: [
      { _id: { $in: plantReferences } },
      { id: { $in: plantReferences } },
      { plantId: { $in: plantReferences } },
      { plantName: { $in: plantReferences } },
      { name: { $in: plantReferences } },
    ],
  };
}

/**
 * Evaluates one attendance action against only the employee's assigned plants.
 * The returned values are stored with that action and must not be re-evaluated
 * when a plant configuration later changes.
 */
export function evaluateAssignedPlantLocation(latitude, longitude, assignedPlants) {
  const match = matchPlantForLocation(Number(latitude), Number(longitude), assignedPlants);

  if (match.matched) {
    return {
      plantId: match.plant.plantId,
      plantName: match.plant.plantName,
      withinPlantRadius: true,
      distanceMeters: match.distance,
      allowedRadiusMeters: match.radiusMeters,
    };
  }

  return {
    plantId: null,
    plantName: OUTSIDE_PLANT_LABEL,
    withinPlantRadius: false,
    distanceMeters: match.distance ?? null,
    allowedRadiusMeters: match.radiusMeters ?? null,
  };
}