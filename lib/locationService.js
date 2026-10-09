/**
 * Location Service for resolving and formatting human-readable locations
 * for attendance records (Mark IN and Mark OUT).
 */

/**
 * Format a plant's display location nicely.
 * If employee marks at a registered plant, displays the plant name and readable location.
 * E.g., "Salt Plant, Plot 12, Kandla SEZ" or "Salt Plant".
 */
export function formatPlantLocation(plant) {
  if (!plant) return null;
  const pName = (plant.plantName || plant.name || '').trim();
  const pLoc = (plant.location || plant.address || '').trim();

  if (!pName && !pLoc) return null;
  if (!pLoc || pLoc.toLowerCase() === pName.toLowerCase()) {
    return pName || pLoc;
  }

  // If pLoc already contains pName, avoid duplicate prefix
  if (pLoc.toLowerCase().includes(pName.toLowerCase())) {
    return pLoc;
  }

  // If pName already contains pLoc, use pName
  if (pName.toLowerCase().includes(pLoc.toLowerCase())) {
    return pName;
  }

  return `${pName}, ${pLoc}`;
}

/**
 * Reverse geocode latitude and longitude to a human-readable area or address.
 * Uses ArcGIS, BigDataCloud, and OpenStreetMap with fast timeouts.
 */
export async function getReverseGeocodeAddress(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
    return null;
  }

  // 1. Try ArcGIS if API key is present
  const arcgisKey = process.env.ARCGIS_API_KEY;
  if (arcgisKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${lng},${lat}&f=json&token=${arcgisKey}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const addr = data?.address;
        if (addr) {
          const longLabel = addr.LongLabel || addr.Match_addr;
          if (longLabel) {
            // Remove trailing ", IND" or postal code if needed, or keep clean label
            const clean = longLabel.replace(/,\s*IND$/i, '').trim();
            if (clean) return clean;
          }
        }
      }
    } catch {}
  }

  // 2. Try BigDataCloud free client reverse geocoder
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const parts = [
        data.locality || data.city,
        data.principalSubdivision,
        data.countryName,
      ].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(', ');
      }
    }
  } catch {}

  // 3. Try OpenStreetMap Nominatim
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SikkaAttendanceApp/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        const parts = data.display_name.split(',').map((s) => s.trim()).filter(Boolean);
        return parts.slice(0, 4).join(', ');
      }
    }
  } catch {}

  return null;
}

/**
 * Resolves a readable location for saving or displaying.
 * Returns a human-readable location or "Location Not Available".
 */
export async function resolveReadableLocation({
  latitude,
  longitude,
  matchedPlant = null,
  clientLocation = null,
  fallbackLocation = null,
} = {}) {
  // If matched at a registered plant
  if (matchedPlant) {
    const plantLoc = formatPlantLocation(matchedPlant);
    if (plantLoc) return plantLoc;
  }

  // If client provided a human-readable address/location
  if (clientLocation && typeof clientLocation === 'string') {
    const trimmed = clientLocation.trim();
    // Validate it's not a dummy or pure coordinates string
    if (
      trimmed &&
      trimmed !== 'Location Not Available' &&
      trimmed !== '-' &&
      !/^[-+]?\d*\.?\d+,\s*[-+]?\d*\.?\d+$/.test(trimmed)
    ) {
      return trimmed;
    }
  }

  // Attempt reverse geocoding if coordinates are valid
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
    const geocoded = await getReverseGeocodeAddress(lat, lng);
    if (geocoded) return geocoded;
  }

  // Fallback if provided (e.g., existing saved location)
  if (fallbackLocation && typeof fallbackLocation === 'string' && fallbackLocation.trim()) {
    const trimmed = fallbackLocation.trim();
    if (trimmed !== '-' && !/^[-+]?\d*\.?\d+,\s*[-+]?\d*\.?\d+$/.test(trimmed)) {
      return trimmed;
    }
  }

  return 'Location Not Available';
}
