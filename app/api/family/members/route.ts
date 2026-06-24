import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/supabase/auth';
import { ensureCallerFamily } from '@/lib/supabase/family';

export const runtime = 'nodejs';

// DELETE /api/family/members?accountId=... — remove a member, or leave (self).
// Clean detach (Q6): the removed account moves to a fresh family-of-one (a new default 'self'
// is created on their next /api/me); the family keeps its profiles for the remaining members.
// Permission: leaving yourself is always allowed; removing someone else is owner-only. The sole
// member can't leave/remove (there's no shared family to detach from).
export async function DELETE(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const caller = await ensureCallerFamily(auth.user.id);
  if (!caller) return NextResponse.json({ error: 'No account' }, { status: 400 });

  const accountId = new URL(request.url).searchParams.get('accountId');
  if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 });

  const removingSelf = accountId === caller.accountId;
  if (!removingSelf && caller.role !== 'owner') {
    return NextResponse.json({ error: 'Only the owner can remove members' }, { status: 403 });
  }

  try {
    const admin = createAdminClient();

    const { data: target } = await admin
      .from('family_members')
      .select('id, account_id, role')
      .eq('family_id', caller.familyId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (!target) return NextResponse.json({ error: 'Not a member' }, { status: 404 });

    const { count } = await admin
      .from('family_members')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', caller.familyId);
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: 'You are the only member' }, { status: 400 });
    }

    // If the departing member is the owner, hand ownership to the oldest remaining member.
    if (target.role === 'owner') {
      const { data: heir } = await admin
        .from('family_members')
        .select('id')
        .eq('family_id', caller.familyId)
        .neq('account_id', accountId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (heir) await admin.from('family_members').update({ role: 'owner' }).eq('id', heir.id);
    }

    // Move the departing account to a fresh family-of-one (profiles stay with the old family).
    const { data: fam } = await admin.from('families').insert({}).select('id').single();
    if (!fam) throw new Error('family create failed');
    await admin
      .from('family_members')
      .update({ family_id: fam.id, role: 'owner' })
      .eq('id', target.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/family/members failed:', err);
    return NextResponse.json({ error: 'Could not update members' }, { status: 500 });
  }
}
