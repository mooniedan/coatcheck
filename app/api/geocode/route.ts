import { NextRequest, NextResponse } from 'next/server';
import { geocodeSearch } from '@/lib/weather';

export const runtime = 'nodejs';

// GET /api/geocode?q=par → { results: ResolvedLocation[] }
// Autocomplete candidates for the city search. Thin proxy over Open-Meteo geocoding (no key);
// results are cached at the fetch layer. Returns an empty list for blank/too-short queries.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2 || q.length > 120) return NextResponse.json({ results: [] });

  try {
    const results = await geocodeSearch(q, 5);
    return NextResponse.json({ results });
  } catch (err) {
    console.error('GET /api/geocode failed:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 502 });
  }
}
