import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/supabase/auth';
import { ensureCallerFamily } from '@/lib/supabase/family';

export const runtime = 'nodejs';

// GET /api/family → the caller's family: members (with emails + roles) and pending invites.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const caller = await ensureCallerFamily(auth.user.id);
  if (!caller) return NextResponse.json({ error: 'No account' }, { status: 400 });

  const admin = createAdminClient();
  const { data: memberRows } = await admin
    .from('family_members')
    .select('account_id, role, created_at, accounts!inner(email)')
    .eq('family_id', caller.familyId)
    .order('created_at', { ascending: true });

  const members = (memberRows ?? []).map((m) => ({
    account_id: m.account_id as string,
    email: (m.accounts as unknown as { email: string | null })?.email ?? null,
    role: m.role as string,
    is_self: m.account_id === caller.accountId,
  }));

  const { data: invites } = await admin
    .from('family_invites')
    .select('id, email')
    .eq('family_id', caller.familyId)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    family_id: caller.familyId,
    role: caller.role,
    members,
    invites: invites ?? [],
  });
}
