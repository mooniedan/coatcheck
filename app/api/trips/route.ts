import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/supabase/auth';
import { normalizeLocation, isValidIsoDate } from '@/lib/location';

export const runtime = 'nodejs';

// Saved trips for the signed-in account. Service_role client after an ownership check, per the
// project's mutation convention.
//   GET   /api/trips                                    → list (newest first)
//   POST  /api/trips  { location, startDate, endDate }  → create

const TRIP_COLS = 'id, location, start_date, end_date, created_at, seen_at';

async function ownerAccountId(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from('accounts').select('id').eq('user_id', userId).maybeSingle();
  return data?.id ?? null;
}

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const accountId = await ownerAccountId(auth.user.id);
  if (!accountId) return NextResponse.json({ trips: [] });

  const admin = createAdminClient();
  const { data } = await admin
    .from('trips')
    .select(TRIP_COLS)
    .eq('account_id', accountId)
    .order('start_date', { ascending: true });

  return NextResponse.json({ trips: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  let body: { location?: unknown; startDate?: unknown; endDate?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const location = normalizeLocation(body.location);
  if (!location) return NextResponse.json({ error: 'Valid location required' }, { status: 400 });
  if (!isValidIsoDate(body.startDate) || !isValidIsoDate(body.endDate)) {
    return NextResponse.json({ error: 'Valid start and end dates required' }, { status: 400 });
  }
  if (body.endDate < body.startDate) {
    return NextResponse.json({ error: 'End date is before start date' }, { status: 400 });
  }

  const accountId = await ownerAccountId(auth.user.id);
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('trips')
    .insert({
      account_id: accountId,
      location,
      start_date: body.startDate,
      end_date: body.endDate,
    })
    .select(TRIP_COLS)
    .single();

  if (error) {
    console.error('POST /api/trips insert failed:', error);
    return NextResponse.json({ error: 'Could not create trip' }, { status: 500 });
  }
  return NextResponse.json({ trip: data });
}
