import { NextRequest, NextResponse } from 'next/server';
import { geocode, getWeather } from '@/lib/weather';

export const runtime = 'nodejs';

// GET /api/weather?q=Oslo  OR  /api/weather?lat=59.91&lng=10.75
// Server-side Open-Meteo fetch (no key, cached). Returns { location, weather }.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  try {
    let location;
    if (lat && lng) {
      location = { name: 'Your location', latitude: Number(lat), longitude: Number(lng) };
    } else if (q) {
      location = await geocode(q);
      if (!location) {
        return NextResponse.json({ error: 'Location not found' }, { status: 404 });
      }
    } else {
      return NextResponse.json({ error: 'Provide q or lat/lng' }, { status: 400 });
    }

    const weather = await getWeather(location.latitude, location.longitude);
    return NextResponse.json({ location, weather });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Weather lookup failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
