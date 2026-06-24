import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/supabase/auth';
import { ensureCallerFamily, profileScopeFilter } from '@/lib/supabase/family';

export const runtime = 'nodejs';

// Family profiles for the signed-in account. Scoped to the caller's FAMILY (ADR-0001), so all
// members see/manage the same profiles. All mutations use the service_role client.
//   GET    /api/profiles                       → list (the family's profiles)
//   POST   /api/profiles  { displayName, relationship }   → create
//   DELETE /api/profiles?id=...                → remove (cannot remove the last profile)

const PROFILE_COLS = 'id, display_name, relationship, comfort_model';

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const caller = await ensureCallerFamily(auth.user.id);
  if (!caller) return NextResponse.json({ profiles: [] });

  const admin = createAdminClient();
  const { data } = await admin
    .from('profiles')
    .select(PROFILE_COLS)
    .or(profileScopeFilter(caller))
    .order('created_at', { ascending: true });

  return NextResponse.json({ profiles: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as { displayName?: string; relationship?: string };
  const displayName = body.displayName?.trim();
  if (!displayName) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const caller = await ensureCallerFamily(auth.user.id);
  if (!caller) return NextResponse.json({ error: 'No account' }, { status: 400 });

  const admin = createAdminClient();
  // account_id is still NOT NULL during the additive transition; set both.
  const { data, error } = await admin
    .from('profiles')
    .insert({
      account_id: caller.accountId,
      family_id: caller.familyId,
      display_name: displayName,
      relationship: body.relationship ?? 'other',
    })
    .select(PROFILE_COLS)
    .single();

  if (error) {
    console.error('POST /api/profiles insert failed:', error);
    return NextResponse.json({ error: 'Could not create profile' }, { status: 500 });
  }
  return NextResponse.json({ profile: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const caller = await ensureCallerFamily(auth.user.id);
  if (!caller) return NextResponse.json({ error: 'No account' }, { status: 400 });

  const admin = createAdminClient();
  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .or(profileScopeFilter(caller));
  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: 'Cannot remove the last profile' }, { status: 400 });
  }

  const { error } = await admin
    .from('profiles')
    .delete()
    .eq('id', id)
    .or(profileScopeFilter(caller));
  if (error) {
    console.error('DELETE /api/profiles failed:', error);
    return NextResponse.json({ error: 'Could not remove profile' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
