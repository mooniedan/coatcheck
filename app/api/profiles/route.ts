import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const runtime = 'nodejs';

// When Supabase isn't configured there's no auth — behave as "not signed in".
const signInRequired = () => NextResponse.json({ error: 'Sign in required' }, { status: 401 });

// Family profiles for the signed-in account. All mutations use the service_role client
// after verifying ownership.
//   GET    /api/profiles                       → list
//   POST   /api/profiles  { displayName, relationship }   → create
//   DELETE /api/profiles?id=...                → remove (cannot remove the last/self profile)

async function ownerAccountId(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from('accounts').select('id').eq('user_id', userId).maybeSingle();
  return data?.id ?? null;
}

export async function GET() {
  if (!isSupabaseConfigured()) return signInRequired();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  const accountId = await ownerAccountId(user.id);
  if (!accountId) return NextResponse.json({ profiles: [] });

  const admin = createAdminClient();
  const { data } = await admin
    .from('profiles')
    .select('id, display_name, relationship, comfort_model')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true });

  return NextResponse.json({ profiles: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) return signInRequired();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  const body = (await request.json()) as { displayName?: string; relationship?: string };
  const displayName = body.displayName?.trim();
  if (!displayName) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const accountId = await ownerAccountId(user.id);
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .insert({
      account_id: accountId,
      display_name: displayName,
      relationship: body.relationship ?? 'other',
    })
    .select('id, display_name, relationship, comfort_model')
    .single();

  if (error) {
    console.error('POST /api/profiles insert failed:', error);
    return NextResponse.json({ error: 'Could not create profile' }, { status: 500 });
  }
  return NextResponse.json({ profile: data });
}

export async function DELETE(request: NextRequest) {
  if (!isSupabaseConfigured()) return signInRequired();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const accountId = await ownerAccountId(user.id);
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 });

  const admin = createAdminClient();
  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId);
  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: 'Cannot remove the last profile' }, { status: 400 });
  }

  const { error } = await admin
    .from('profiles')
    .delete()
    .eq('id', id)
    .eq('account_id', accountId);
  if (error) {
    console.error('DELETE /api/profiles failed:', error);
    return NextResponse.json({ error: 'Could not remove profile' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
