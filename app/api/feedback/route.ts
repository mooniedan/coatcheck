import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/supabase/auth';
import { ensureCallerFamily, profileInFamily } from '@/lib/supabase/family';
import { applyFeedback } from '@/lib/thresholds';
import type { ComfortModel, Verdict, WeatherSnapshot } from '@/lib/types';

export const runtime = 'nodejs';

const VERDICTS: Verdict[] = ['too_cold', 'too_hot', 'just_right'];

interface FeedbackBody {
  profileId: string;
  verdict: Verdict;
  weather: WeatherSnapshot;
  recommendedItemIds: string[];
  // Optional: what the wearer actually wore that felt comfortable (set when correcting a
  // too_cold / too_hot verdict). A stronger learning signal than the verdict alone.
  wornItemIds?: string[];
}

// POST /api/feedback → record a verdict and nudge the profile's comfort model.
// Requires a signed-in user who owns the profile. All writes use the service_role client.
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const body = (await request.json()) as Partial<FeedbackBody>;
  if (!body.profileId || !body.verdict || !VERDICTS.includes(body.verdict) || !body.weather) {
    return NextResponse.json({ error: 'Invalid feedback payload' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    // Verify the profile is in the signed-in user's family (ADR-0001).
    const caller = await ensureCallerFamily(user.id);
    const { data: profile } = await admin
      .from('profiles')
      .select('id, comfort_model, family_id, account_id')
      .eq('id', body.profileId)
      .maybeSingle();

    if (!caller || !profile || !profileInFamily(profile, caller)) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Persist the feedback row (cohort denormalized for the Phase 3 aggregation job — the
    // recording member's cohort).
    const { error: insertError } = await admin.from('feedback').insert({
      profile_id: body.profileId,
      cohort: caller.cohort,
      feels_like_c: body.weather.feelsLikeC,
      conditions: body.weather,
      recommended_item_ids: body.recommendedItemIds ?? [],
      worn_item_ids: body.wornItemIds ?? [],
      verdict: body.verdict,
    });
    if (insertError) throw insertError;

    // Nudge the profile's comfort model. Surface a failure here too — otherwise the learned
    // offset silently never changes while the client is told the feedback was saved.
    const current = (profile.comfort_model as ComfortModel | null) ?? { offsetC: 0 };
    const updated = applyFeedback(current, body.verdict);
    const { error: updateError } = await admin
      .from('profiles')
      .update({ comfort_model: updated })
      .eq('id', body.profileId);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true, comfort: updated });
  } catch (err) {
    console.error('POST /api/feedback failed:', err);
    return NextResponse.json({ error: 'Could not save feedback' }, { status: 500 });
  }
}
