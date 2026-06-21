import { NextRequest, NextResponse } from 'next/server';
import { geocode, getWeather } from '@/lib/weather';
import { recommend } from '@/lib/recommend';
import { DEFAULT_CATALOG } from '@/lib/catalog';
import { resolveComfort } from '@/lib/thresholds';
import { createClient } from '@/lib/supabase/server';
import type { ComfortModel } from '@/lib/types';

export const runtime = 'nodejs';

// GET /api/recommendations?q=Oslo[&profileId=...]   OR  ?lat=&lng=[&profileId=...]
// Resolves weather, then runs the pure engine with the wearer's comfort model
// (personal → cohort baseline → generic). Returns { location, recommendation }.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const profileId = searchParams.get('profileId');

  try {
    let location;
    if (lat && lng) {
      location = { name: 'Your location', latitude: Number(lat), longitude: Number(lng) };
    } else if (q) {
      location = await geocode(q);
      if (!location) return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    } else {
      return NextResponse.json({ error: 'Provide q or lat/lng' }, { status: 400 });
    }

    const weather = await getWeather(location.latitude, location.longitude);
    const comfort = await resolveComfortForProfile(profileId);
    const recommendation = recommend(weather, DEFAULT_CATALOG, comfort);

    return NextResponse.json({ location, recommendation });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Recommendation failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// Loads the profile's learned comfort model when signed in; falls back to generic.
// Tolerant of a not-yet-migrated database so the app works before Supabase is wired up.
async function resolveComfortForProfile(profileId: string | null): Promise<ComfortModel> {
  if (!profileId) return resolveComfort(null, null);
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return resolveComfort(null, null);

    const { data } = await supabase
      .from('profiles')
      .select('comfort_model')
      .eq('id', profileId)
      .maybeSingle();

    const personal = (data?.comfort_model as ComfortModel | undefined) ?? null;
    return resolveComfort(personal, null);
  } catch {
    return resolveComfort(null, null);
  }
}
