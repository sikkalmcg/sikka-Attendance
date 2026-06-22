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
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing ARCGIS_API_KEY in environment' },
        { status: 500 }
      );
    }

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
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { error: 'ArcGIS reverseGeocode failed', details: text || null },
        { status: 502 }
      );
    }

    const data = await res.json();

    // 🌟 सुधार (FIX): ArcGIS पूरा लंबा पता 'Match_addr' या 'LongLabel' फ़ील्ड में देता है
    let readableAddress = '';
    if (data?.address) {
      if (typeof data.address === 'object') {
        // अगर 'Match_addr' उपलब्ध है (जो कि पूरा पता होता है), उसे लें
        readableAddress = data.address.Match_addr || data.address.LongLabel || data.address.Address || '';
      } else if (typeof data.address === 'string') {
        readableAddress = data.address;
      }
    }

    // यदि ऊपर से कुछ नहीं मिला तो फ़ॉलबैक इस्तेमाल करें
    if (!readableAddress) {
      readableAddress = data?.formattedAddress || data?.location?.label || 'Unknown Location';
    }

    const components = {
      street: data?.address?.Match_addr || data?.address?.address || '',
      area: data?.address?.neighborhood || data?.address?.neighborhoodName || '',
      city: data?.address?.city || data?.address?.locality || '',
      state: data?.address?.region || data?.address?.adminArea || data?.address?.state || '',
      pincode: data?.address?.postal || data?.address?.postalCode || '',
    };

    // यहाँ हमेशा एक String ही रिटर्न होगी, जिससे फ्रंटेंड क्रैश नहीं होगा और पूरा पता दिखेगा
    return NextResponse.json({ address: readableAddress, components });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}