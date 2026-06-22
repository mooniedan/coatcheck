import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/auth';
import type { Cohort } from '@/lib/types';

export const runtime = 'nodejs';

const COHORTS: Cohort[] = ['alpha', 'beta', 'ga'];

// PATCH /api/admin/accounts { accountId, cohort } → move a tester between cohorts.
// Superadmin/admin only.
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as { accountId?: string; cohort?: Cohort };
  if (!body.accountId || !body.cohort || !COHORTS.includes(body.cohort)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from('accounts')
      .update({ cohort: body.cohort })
      .eq('id', body.accountId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/accounts failed:', err);
    return NextResponse.json({ error: 'Could not update cohort' }, { status: 500 });
  }
}
