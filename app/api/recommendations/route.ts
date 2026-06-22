import { NextRequest, NextResponse } from 'next/server';
import { getForecast, resolveLocationFromQuery } from '@/lib/weather';
import { recommend } from '@/lib/recommend';
import { DEFAULT_CATALOG } from '@/lib/catalog';
import { resolveComfort } from '@/lib/thresholds';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import type { ComfortModel, DailyForecast, DayRecommendation, WeatherSnapshot } from '@/lib/types';

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
    const location = await resolveLocationFromQuery(q, lat, lng);
    if ('error' in location) {
      return NextResponse.json({ error: location.error }, { status: location.status });
    }

    const { current, week } = await getForecast(location.latitude, location.longitude);
    const comfort = await resolveComfortForProfile(profileId);
    const recommendation = recommend(current, DEFAULT_CATALOG, comfort);

    // Precompute a recommendation per forecast day so tapping a day is a client-only swap.
    const weekRecommendations: DayRecommendation[] = week.map((day) => ({
      day,
      recommendation: recommend(dayToSnapshot(day), DEFAULT_CATALOG, comfort),
    }));

    return NextResponse.json({ location, recommendation, week: weekRecommendations });
  } catch (err) {
    console.error('GET /api/recommendations failed:', err);
    return NextResponse.json({ error: 'Recommendation failed' }, { status: 502 });
  }
}

// Synthesize a WeatherSnapshot from a day's summary so the pure engine (and the scene
// overrides, which read recommendation.weather) can run against a future day. Humidity is
// not in the daily block; it doesn't affect the recommendation so 0 is fine.
function dayToSnapshot(d: DailyForecast): WeatherSnapshot {
  return {
    feelsLikeC: d.feelsLikeC,
    tempC: d.tempMaxC,
    humidity: 0,
    windKph: d.windMaxKph,
    precipitationProbability: d.precipProb,
    isRaining: d.isRaining,
    weatherCode: d.weatherCode,
    description: d.description,
    observedAt: d.date,
  };
}

// Loads the profile's learned comfort model when signed in; falls back to generic.
// Reads via the service_role client (RLS denies SELECT on `profiles` to the anon/auth role,
// so the RLS-bound client always returns null) after verifying the profile belongs to the
// caller. Tolerant of a not-yet-migrated database so the app works before Supabase is wired up.
async function resolveComfortForProfile(profileId: string | null): Promise<ComfortModel> {
  if (!profileId || !isSupabaseConfigured()) return resolveComfort(null, null);
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return resolveComfort(null, null);

    // Service_role read + ownership check (the RLS-bound client can't see `profiles`).
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('comfort_model, accounts!inner(user_id)')
      .eq('id', profileId)
      .maybeSingle();

    const account = profile?.accounts as unknown as { user_id: string } | undefined;
    if (!profile || account?.user_id !== user.id) return resolveComfort(null, null);

    const personal = (profile.comfort_model as ComfortModel | undefined) ?? null;
    return resolveComfort(personal, null);
  } catch {
    return resolveComfort(null, null);
  }
}
