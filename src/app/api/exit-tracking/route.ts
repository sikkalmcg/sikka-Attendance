import { NextResponse } from 'next/server';
import { db } from '@/lib/db'; // Aapka db client

// Distance nikalne ke liye Haversine Formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius meters me
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance meters me
}

export async function POST(req: Request) {
  try {
    const { employeeId, attendanceId, latitude, longitude, plantId } = await req.json();

    // 1. Plant details fetch karein
    const plant = await db.plant.findUnique({ where: { id: plantId } });
    if (!plant) return NextResponse.json({ error: 'Plant not found' }, { status: 404 });

    const distance = calculateDistance(latitude, longitude, plant.latitude, plant.longitude);
    const isOutside = distance > plant.geofenceRadius;

    // 2. Check karein agar koi active exit event pehle se chal raha hai
    let activeExit = await db.plantExitEvent.findFirst({
      where: { attendanceId, employeeId, returnTime: null },
      orderBy: { exitTime: 'desc' }
    });

    if (isOutside) {
      // Reverse geocoding aapke existing api/geocode se ya directly yahan se call karein
      let fullAddress = "Location Unavailable";
      try {
        const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.GOOGLE_MAPS_API_KEY}`);
        const geoData = await geoRes.json();
        if (geoData.results?.[0]) fullAddress = geoData.results[0].formatted_address;
      } catch (e) { console.error("Geocoding failed", e); }

      if (!activeExit) {
        // Naya exit event banayein
        activeExit = await db.plantExitEvent.create({
          data: { employeeId, attendanceId, exitTime: new Date() }
        });
      }

      // Check karein duplicate consecutive entry to nahi hai (30 mins ke andar same point)
      const lastLocation = await db.plantExitLocation.findFirst({
        where: { plantExitEventId: activeExit.id },
        orderBy: { timestamp: 'desc' }
      });

      if (!lastLocation || (lastLocation.latitude !== latitude && lastLocation.longitude !== longitude)) {
        await db.plantExitLocation.create({
          data: {
            plantExitEventId: activeExit.id,
            latitude,
            longitude,
            address: fullAddress,
            distanceFromPlant: Math.round(distance)
          }
        });
      }

      return NextResponse.json({ status: 'Outside Plant', event: activeExit });
    } else {
      // Agar employee andar wapas aa gaya hai aur exit event chal raha tha
      if (activeExit) {
        const returnTime = new Date();
        const diffMs = returnTime.getTime() - new Date(activeExit.exitTime).getTime();
        const totalDurationMinutes = Math.round(diffMs / 60000);

        await db.plantExitEvent.update({
          where: { id: activeExit.id },
          data: { returnTime, totalDuration: totalDurationMinutes }
        });
        return NextResponse.json({ status: 'Returned to Plant' });
      }
      return NextResponse.json({ status: 'Inside Plant' });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}