import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/auth';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/admin/invites { emails: string[] } → allow-list one or more emails (invite a new
// tester, or approve waitlist signups — same operation: set allowed=true). Admin + superadmin.
// Upsert so a brand-new email is created as allowed, and an existing waitlist row is flipped.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as { emails?: string[] };
  const emails = (body.emails ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter((e) => EMAIL_RE.test(e) && e.length <= 254);
  if (emails.length === 0) {
    return NextResponse.json({ error: 'No valid emails' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const rows = emails.map((email) => ({
      email,
      allowed: true,
      source: 'invite',
      approved_at: new Date().toISOString(),
    }));
    const { error } = await admin.from('beta_signups').upsert(rows, { onConflict: 'email' });
    if (error) throw error;
    return NextResponse.json({ ok: true, count: emails.length });
  } catch (err) {
    console.error('POST /api/admin/invites failed:', err);
    return NextResponse.json({ error: 'Could not update the allowlist' }, { status: 500 });
  }
}
