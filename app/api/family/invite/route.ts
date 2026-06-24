import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/supabase/auth';
import { ensureCallerFamily } from '@/lib/supabase/family';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/family/invite { email }
// Any member may invite (ADR/grill Q4). Allow-lists the email so the invitee can sign in
// (ADR-0002) and records a pending family_invites row. The invitee accepts via /api/family/accept
// after signing in with that email. Out-of-band notification (no email is sent).
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const caller = await ensureCallerFamily(auth.user.id);
  if (!caller) return NextResponse.json({ error: 'No account' }, { status: 400 });

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    // Already a member of this family? (compare against members' account emails)
    const { data: memberRows } = await admin
      .from('family_members')
      .select('accounts!inner(email)')
      .eq('family_id', caller.familyId);
    const alreadyMember = (memberRows ?? []).some(
      (m) => (m.accounts as unknown as { email: string | null })?.email?.toLowerCase() === email
    );
    if (alreadyMember) {
      return NextResponse.json({ error: 'That email is already in your family' }, { status: 400 });
    }

    // Grant app access (ADR-0002), mirroring the admin allowlist upsert.
    const { error: allowErr } = await admin
      .from('beta_signups')
      .upsert(
        { email, allowed: true, source: 'family', approved_at: new Date().toISOString() },
        { onConflict: 'email' }
      );
    if (allowErr) throw allowErr;

    // Record the pending invite (idempotent: skip if one already exists for this family+email;
    // the unique index on (family_id, lower(email)) is the race backstop).
    const { data: dup } = await admin
      .from('family_invites')
      .select('id')
      .eq('family_id', caller.familyId)
      .eq('email', email)
      .maybeSingle();
    if (!dup) {
      const { error: invErr } = await admin
        .from('family_invites')
        .insert({ family_id: caller.familyId, email, invited_by: caller.accountId });
      if (invErr) throw invErr;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/family/invite failed:', err);
    return NextResponse.json({ error: 'Could not send invite' }, { status: 500 });
  }
}

// DELETE /api/family/invite?id=... — cancel a pending invite (any member of its family).
// Leaves the email's app-access allowlist untouched (revoking beta access is a separate concern).
export async function DELETE(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const caller = await ensureCallerFamily(auth.user.id);
  if (!caller) return NextResponse.json({ error: 'No account' }, { status: 400 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('family_invites')
    .delete()
    .eq('id', id)
    .eq('family_id', caller.familyId);
  if (error) {
    console.error('DELETE /api/family/invite failed:', error);
    return NextResponse.json({ error: 'Could not cancel invite' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
