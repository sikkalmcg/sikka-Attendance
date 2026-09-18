/**
 * Calculates the great-circle distance between two geographic points
 * using the Haversine formula.
 *
 * @param {number} lat1 Latitude of point 1 in degrees
 * @param {number} lon1 Longitude of point 1 in degrees
 * @param {number} lat2 Latitude of point 2 in degrees
 * @param {number} lon2 Longitude of point 2 in degrees
 * @returns {number} Distance in meters
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (angle) => (angle * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance); // distance in meters
}

/**
 * Validates employee's coordinates against all active plants.
 * If employee is within radius of multiple plants, picks the nearest one.
 * If outside all plants, returns the nearest plant and the distance.
 *
 * @param {number} lat Current employee latitude
 * @param {number} lng Current employee longitude
 * @param {Array} activePlants Array of active plant documents
 */
export function matchPlantForLocation(lat, lng, activePlants) {
  if (!activePlants || activePlants.length === 0) {
    return {
      matched: false,
      reason: 'NO_ACTIVE_PLANTS',
      message: 'No active plants configured in the system.',
    };
  }

  const evaluated = activePlants.map((plant) => {
    const distance = calculateDistance(lat, lng, plant.latitude, plant.longitude);
    const isInside = distance <= plant.radiusMeters;
    return {
      plant,
      distance,
      isInside,
    };
  });

  // Filter those inside allowed radius
  const matchingPlants = evaluated.filter((e) => e.isInside);

  if (matchingPlants.length > 0) {
    // If multiple overlap, pick the nearest one
    matchingPlants.sort((a, b) => a.distance - b.distance);
    const bestMatch = matchingPlants[0];
    return {
      matched: true,
      plant: bestMatch.plant,
      distance: bestMatch.distance,
      radiusMeters: bestMatch.plant.radiusMeters,
    };
  }

  // If outside all, sort all by distance to report nearest plant
  evaluated.sort((a, b) => a.distance - b.distance);
  const nearest = evaluated[0];

  return {
    matched: false,
    reason: 'OUTSIDE_RADIUS',
    nearestPlant: nearest.plant,
    distance: nearest.distance,
    radiusMeters: nearest.plant.radiusMeters,
  };
}
