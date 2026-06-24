import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/supabase/auth';
import { ensureCallerFamily } from '@/lib/supabase/family';

export const runtime = 'nodejs';

// POST /api/family/accept
// Accept the pending invite for the caller's email and move them into the inviting family.
// - If the caller is the SOLE member of their current family (the common case — a fresh
//   family-of-one), their profiles MERGE into the target family (no data loss), then the empty
//   old family is deleted.
// - If the caller was in a SHARED family, it's a clean detach (Q6): profiles stay behind for the
//   remaining members; if the caller was owner, ownership transfers to the oldest other member.
export async function POST() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const caller = await ensureCallerFamily(auth.user.id);
  if (!caller) return NextResponse.json({ error: 'No account' }, { status: 400 });
  const email = (auth.user.email ?? '').toLowerCase();
  if (!email) return NextResponse.json({ error: 'No email' }, { status: 400 });

  try {
    const admin = createAdminClient();

    const { data: invite } = await admin
      .from('family_invites')
      .select('id, family_id')
      .eq('email', email)
      .neq('family_id', caller.familyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!invite) return NextResponse.json({ error: 'No pending invite' }, { status: 404 });

    const target = invite.family_id as string;
    const oldFamily = caller.familyId;

    const { count: oldCount } = await admin
      .from('family_members')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', oldFamily);

    if ((oldCount ?? 0) <= 1) {
      // Sole member → merge profiles into the target family, then delete the empty old family.
      await admin.from('profiles').update({ family_id: target }).eq('family_id', oldFamily);
      await admin
        .from('family_members')
        .update({ family_id: target, role: 'member' })
        .eq('account_id', caller.accountId);
      await admin.from('family_invites').delete().eq('id', invite.id);
      await admin.from('families').delete().eq('id', oldFamily);
    } else {
      // Shared old family → clean detach: leave profiles behind; hand off ownership if needed.
      if (caller.role === 'owner') {
        const { data: heir } = await admin
          .from('family_members')
          .select('id')
          .eq('family_id', oldFamily)
          .neq('account_id', caller.accountId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (heir) await admin.from('family_members').update({ role: 'owner' }).eq('id', heir.id);
      }
      await admin
        .from('family_members')
        .update({ family_id: target, role: 'member' })
        .eq('account_id', caller.accountId);
      await admin.from('family_invites').delete().eq('id', invite.id);
    }

    return NextResponse.json({ ok: true, family_id: target });
  } catch (err) {
    console.error('POST /api/family/accept failed:', err);
    return NextResponse.json({ error: 'Could not join family' }, { status: 500 });
  }
}
