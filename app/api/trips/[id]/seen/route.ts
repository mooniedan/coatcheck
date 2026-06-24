import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/supabase/auth';
import { callerAccountId } from '@/lib/supabase/family';

export const runtime = 'nodejs';

// POST /api/trips/[id]/seen — mark a trip as seen (now). Called by the trip detail page once
// the trip's weather is available, so the Trips nav badge clears for it. Idempotent.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const accountId = await callerAccountId(auth.user.id);
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('trips')
    .update({ seen_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId);
  if (error) {
    console.error('POST /api/trips/[id]/seen failed:', error);
    return NextResponse.json({ error: 'Could not mark seen' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
