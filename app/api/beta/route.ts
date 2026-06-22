import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254; // RFC 5321 max

// Best-effort in-memory rate limit: 5 requests / minute per IP. Per-instance only (resets on
// cold start, not shared across serverless instances) — a first layer against casual spam.
// A durable limit (Upstash/Redis) is the real fix if abuse becomes a problem.
const RATE_MAX = 5;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_MAX;
}

// POST /api/beta { email } → add the visitor to the closed-testing waitlist.
// Idempotent (upsert on email). Writes use the service_role client.
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests. Try again shortly.' }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
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
