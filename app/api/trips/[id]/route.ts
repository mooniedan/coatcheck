import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/supabase/auth';
import { callerAccountId } from '@/lib/supabase/family';
import { TRIP_COLS } from '@/lib/trips';
import { normalizeLocation, isValidIsoDate } from '@/lib/location';

export const runtime = 'nodejs';

// A single saved trip, scoped to the signed-in account.
//   GET    /api/trips/[id]                                   → fetch one
//   PATCH  /api/trips/[id]  { location?, startDate?, endDate? } → edit fields
//   DELETE /api/trips/[id]                                   → remove


export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const accountId = await callerAccountId(auth.user.id);
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 });

  const admin = createAdminClient();
  const { data } = await admin
    .from('trips')
    .select(TRIP_COLS)
    .eq('id', id)
    .eq('account_id', accountId)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  return NextResponse.json({ trip: data });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  let body: { location?: unknown; startDate?: unknown; endDate?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.location !== undefined) {
    const location = normalizeLocation(body.location);
    if (!location) return NextResponse.json({ error: 'Valid location required' }, { status: 400 });
    update.location = location;
  }
  if (body.startDate !== undefined) {
    if (!isValidIsoDate(body.startDate))
      return NextResponse.json({ error: 'Valid start date required' }, { status: 400 });
    update.start_date = body.startDate;
  }
  if (body.endDate !== undefined) {
    if (!isValidIsoDate(body.endDate))
      return NextResponse.json({ error: 'Valid end date required' }, { status: 400 });
    update.end_date = body.endDate;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const accountId = await callerAccountId(auth.user.id);
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 });

  const admin = createAdminClient();
  // Fetch first so a one-sided date edit is validated against the trip's other date before
  // we persist — avoids ever writing an inverted range.
  const { data: existing } = await admin
    .from('trips')
    .select('start_date, end_date')
    .eq('id', id)
    .eq('account_id', accountId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const start = (update.start_date as string) ?? existing.start_date;
  const end = (update.end_date as string) ?? existing.end_date;
  if (end < start) {
    return NextResponse.json({ error: 'End date is before start date' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('trips')
    .update(update)
    .eq('id', id)
    .eq('account_id', accountId)
    .select(TRIP_COLS)
    .single();

  if (error) {
    console.error('PATCH /api/trips/[id] failed:', error);
    return NextResponse.json({ error: 'Could not update trip' }, { status: 500 });
  }
  return NextResponse.json({ trip: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const accountId = await callerAccountId(auth.user.id);
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from('trips').delete().eq('id', id).eq('account_id', accountId);
  if (error) {
    console.error('DELETE /api/trips/[id] failed:', error);
    return NextResponse.json({ error: 'Could not remove trip' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
