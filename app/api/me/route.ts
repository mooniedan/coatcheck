import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveAccess } from '@/lib/supabase/auth';
import { ensureCallerFamily, profileScopeFilter } from '@/lib/supabase/family';
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
    const { role, allowed } = await resolveAccess(user.email);

    // Invite-only gate: only staff or allow-listed emails become testers. Everyone else stays
    // signed in but waitlisted — they explicitly opt in on the /beta page (no silent add here).
    if (!allowed) {
      return NextResponse.json({
        user: { id: user.id, email: user.email, role },
        account: null,
        profiles: [],
        status: 'waitlisted',
      });
    }

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

    // Best-effort: fold in the saved home location + language preference. Done as a separate
    // select so a not-yet-migrated database degrades gracefully rather than failing the lookup.
    let home_location = null;
    let locale = null;
    {
      const { data: prefs } = await admin
        .from('accounts')
        .select('home_location, locale')
        .eq('id', account!.id)
        .maybeSingle();
      home_location = prefs?.home_location ?? null;
      locale = prefs?.locale ?? null;
    }
    const accountWithHome = { ...account!, home_location, locale };

    // Ensure the account has a family (heals accounts provisioned before family sharing) and
    // backfill any profiles created before the API rework that still have a null family_id.
    const caller = await ensureCallerFamily(user.id);
    if (caller) {
      await admin
        .from('profiles')
        .update({ family_id: caller.familyId })
        .eq('account_id', account!.id)
        .is('family_id', null);
    }

    // List the FAMILY's profiles (all members share them — ADR-0001).
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, display_name, relationship, comfort_model')
      .or(caller ? profileScopeFilter(caller) : `account_id.eq.${account!.id}`)
      .order('created_at', { ascending: true });

    // Surface a pending family invite for this email (to a family they're not yet in).
    let pendingFamilyInvite = null;
    if (caller && user.email) {
      const { data: inv } = await admin
        .from('family_invites')
        .select('family_id, invited_by')
        .eq('email', user.email.toLowerCase())
        .neq('family_id', caller.familyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (inv) {
        let invited_by_email: string | null = null;
        if (inv.invited_by) {
          const { data: inviter } = await admin
            .from('accounts')
            .select('email')
            .eq('id', inv.invited_by)
            .maybeSingle();
          invited_by_email = inviter?.email ?? null;
        }
        pendingFamilyInvite = { family_id: inv.family_id, invited_by_email };
      }
    }

    if (profiles && profiles.length === 0) {
      const name =
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split('@')[0] ??
        'Me';
      const created = await admin
        .from('profiles')
        .insert({
          account_id: account!.id,
          family_id: caller?.familyId,
          display_name: name,
          relationship: 'self',
        })
        .select('id, display_name, relationship, comfort_model')
        .single();
      return NextResponse.json({
        user: { id: user.id, email: user.email, role },
        account: accountWithHome,
        profiles: created.data ? [created.data] : [],
        status: 'active',
        pendingFamilyInvite,
      });
    }

    return NextResponse.json({
      user: { id: user.id, email: user.email, role },
      account: accountWithHome,
      profiles: profiles ?? [],
      status: 'active',
      pendingFamilyInvite,
    });
  } catch (err) {
    // Database not migrated yet — return the user so the UI still renders. Log detail
    // server-side; surface only a generic warning (no schema/internal detail to the client).
    console.error('GET /api/me account lookup failed:', err);
    return NextResponse.json({
      user: { id: user.id, email: user.email },
      account: null,
      profiles: [],
      warning: 'Account lookup failed',
    });
  }
}
