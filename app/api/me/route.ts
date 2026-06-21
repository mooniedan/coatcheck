import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const runtime = 'nodejs';

// GET /api/me → { user, account, profiles } for the signed-in visitor, or { user: null }.
// First call after sign-in provisions an account (cohort defaults to 'alpha' for now) and a
// default "self" profile from the Google display name. Provisioning uses the service_role
// client (RLS-bypassing) inside this handler, per the project's mutation convention.
export async function GET() {
  // Supabase not configured yet — treat the visitor as signed out so the home page renders.
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ user: null, account: null, profiles: [] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ user: null, account: null, profiles: [] });

  try {
    const admin = createAdminClient();

    // Ensure an account exists for this Google identity.
    let { data: account } = await admin
      .from('accounts')
      .select('id, email, cohort')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!account) {
      const inserted = await admin
        .from('accounts')
        .insert({ user_id: user.id, email: user.email })
        .select('id, email, cohort')
        .single();
      account = inserted.data;
    }

    // Ensure a default profile exists.
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, display_name, relationship, comfort_model')
      .eq('account_id', account!.id)
      .order('created_at', { ascending: true });

    if (profiles && profiles.length === 0) {
      const name =
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split('@')[0] ??
        'Me';
      const created = await admin
        .from('profiles')
        .insert({ account_id: account!.id, display_name: name, relationship: 'self' })
        .select('id, display_name, relationship, comfort_model')
        .single();
      return NextResponse.json({
        user: { id: user.id, email: user.email },
        account,
        profiles: created.data ? [created.data] : [],
      });
    }

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      account,
      profiles: profiles ?? [],
    });
  } catch (err) {
    // Database not migrated yet — return the user so the UI still renders.
    const message = err instanceof Error ? err.message : 'Account lookup failed';
    return NextResponse.json({
      user: { id: user.id, email: user.email },
      account: null,
      profiles: [],
      warning: message,
    });
  }
}
