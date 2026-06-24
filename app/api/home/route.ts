import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import type { ResolvedLocation } from '@/lib/types';

export const runtime = 'nodejs';

// PUT /api/home  { location: ResolvedLocation | null }
// Saves (or clears, when location is null) the signed-in account's "home" location — the
// open-on-launch fallback when the device's current location isn't readable. Mutates via the
// service_role client (RLS-bypassing), per the project's mutation convention, after verifying
// the caller owns the account.
export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: { location?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Normalize: null clears the home; otherwise keep only the fields we render/re-fetch with,
  // and require finite coordinates so a bad payload can't poison the auto-load.
  const home = normalizeLocation(body.location);
  if (body.location != null && !home) {
    return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: account } = await admin
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 });

    const { error } = await admin
      .from('accounts')
      .update({ home_location: home })
      .eq('id', account.id);
    if (error) throw error;

    return NextResponse.json({ ok: true, home_location: home });
  } catch (err) {
    console.error('PUT /api/home failed:', err);
    return NextResponse.json({ error: 'Could not save home' }, { status: 502 });
  }
}

function normalizeLocation(input: unknown): ResolvedLocation | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const latitude = Number(o.latitude);
  const longitude = Number(o.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (typeof o.name !== 'string' || !o.name) return null;
  return {
    name: o.name,
    latitude,
    longitude,
    country: typeof o.country === 'string' ? o.country : undefined,
    countryCode: typeof o.countryCode === 'string' ? o.countryCode : undefined,
    admin1: typeof o.admin1 === 'string' ? o.admin1 : undefined,
  };
}
