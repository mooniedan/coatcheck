import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/beta { email } → add the visitor to the closed-testing waitlist.
// Idempotent (upsert on email). Writes use the service_role client.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  // No backend configured (e.g. before .env.local) — acknowledge so the flow still works.
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, stored: false });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('beta_signups')
    .upsert({ email, source: 'web' }, { onConflict: 'email' });

  if (error) {
    return NextResponse.json({ error: 'Could not save right now. Please try again.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, stored: true });
}
