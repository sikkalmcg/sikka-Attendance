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
 * Evaluates one attendance action against configured active plants.
 * If employee is within radius of any plant, returns that plant.
 * If outside all plants, returns withinPlantRadius: false.
 */
export function evaluatePlantLocation(latitude, longitude, activePlants) {
  const match = matchPlantForLocation(Number(latitude), Number(longitude), activePlants);

  if (match.matched) {
    return {
      plantId: match.plant.plantId,
      plantName: match.plant.plantName,
      withinPlantRadius: true,
      distanceMeters: match.distance,
      allowedRadiusMeters: match.radiusMeters,
      nearestPlant: match.plant.plantName,
    };
  }

  return {
    plantId: null,
    plantName: OUTSIDE_PLANT_LABEL,
    withinPlantRadius: false,
    distanceMeters: match.distance ?? null,
    allowedRadiusMeters: match.radiusMeters ?? null,
    nearestPlant: match.nearestPlant ? match.nearestPlant.plantName : null,
  };
}

export const evaluateAssignedPlantLocation = evaluatePlantLocation;