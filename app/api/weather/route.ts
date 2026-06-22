import { NextRequest, NextResponse } from 'next/server';
import { getWeather, resolveLocationFromQuery } from '@/lib/weather';

export const runtime = 'nodejs';

// GET /api/weather?q=Oslo  OR  /api/weather?lat=59.91&lng=10.75
// Server-side Open-Meteo fetch (no key, cached). Returns { location, weather }.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  try {
    const location = await resolveLocationFromQuery(q, lat, lng);
    if ('error' in location) {
      return NextResponse.json({ error: location.error }, { status: location.status });
    }

    const weather = await getWeather(location.latitude, location.longitude);
    return NextResponse.json({ location, weather });
  } catch (err) {
    // Log detail server-side; return a generic message so provider/internal detail doesn't leak.
    console.error('GET /api/weather failed:', err);
    return NextResponse.json({ error: 'Weather lookup failed' }, { status: 502 });
  }
}
