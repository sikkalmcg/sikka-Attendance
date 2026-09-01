import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lat, lng } = body || {};

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'lat and lng are required numbers' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ARCGIS_API_KEY;
    let readableAddress = '';
    let components = { street: '', area: '', city: '', state: '', pincode: '' };

    if (apiKey) {
      try {
        const url = new URL(
          'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode'
        );
        url.searchParams.set('location', `${lng},${lat}`);
        url.searchParams.set('distance', '0.5');
        url.searchParams.set('maxLocations', '1');
        url.searchParams.set('f', 'json');
        url.searchParams.set('token', apiKey);

        const res = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          cache: 'no-store',
        });

        if (res.ok) {
          const data = await res.json();
          if (data?.address) {
            if (typeof data.address === 'object') {
              readableAddress = data.address.Match_addr || data.address.LongLabel || data.address.Address || '';
            } else if (typeof data.address === 'string') {
              readableAddress = data.address;
            }
          }
          if (data?.address && typeof data.address === 'object') {
            components = {
              street: data.address.Match_addr || data.address.address || '',
              area: data.address.neighborhood || data.address.neighborhoodName || '',
              city: data.address.city || data.address.locality || '',
              state: data.address.region || data.address.adminArea || data.address.state || '',
              pincode: data.address.postal || data.address.postalCode || '',
            };
          }
        }
      } catch (e) {
        console.warn('ArcGIS reverse geocode error in /api/geocode/reverse:', e);
      }
    }

    // Fallback to OSM Nominatim if ArcGIS was empty
    if (!readableAddress) {
      try {
        const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        const osmRes = await fetch(osmUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'SikkaAttendanceApp/1.0 (admin@sikkaenterprises.com)',
            'Accept-Language': 'en',
          },
          cache: 'no-store',
        });

        if (osmRes.ok) {
          const osmData = await osmRes.json();
          if (osmData?.display_name) {
            readableAddress = osmData.display_name;
            const addr = osmData.address || {};
            components = {
              street: addr.road || addr.street || addr.neighbourhood || '',
              area: addr.suburb || addr.neighbourhood || addr.residential || '',
              city: addr.city || addr.town || addr.village || addr.county || '',
              state: addr.state || '',
              pincode: addr.postcode || '',
            };
          }
        }
      } catch (e) {
        console.warn('OSM reverse geocode error in /api/geocode/reverse:', e);
      }
    }

    if (!readableAddress) {
      readableAddress = `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }

    // Clean standard country suffixes
    readableAddress = readableAddress
      .replace(/,\s*IND$/i, '')
      .replace(/,\s*India$/i, '')
      .trim();

    return NextResponse.json({ address: readableAddress, components });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}