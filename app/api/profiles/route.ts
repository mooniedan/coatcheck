import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/supabase/auth';

export const runtime = 'nodejs';

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
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const accountId = await ownerAccountId(auth.user.id);
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
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as { displayName?: string; relationship?: string };
  const displayName = body.displayName?.trim();
  if (!displayName) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const accountId = await ownerAccountId(auth.user.id);
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
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const accountId = await ownerAccountId(auth.user.id);
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
