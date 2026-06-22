import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/auth';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/admin/invites { emails: string[], allowed?: boolean }
//   allowed=true  (default) → allow-list emails (invite a tester / approve a waitlist signup).
//   allowed=false           → revoke (move an invited tester back to the waitlist).
// Admin + superadmin. Upsert so a brand-new email is created and an existing row is flipped.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as { emails?: string[]; allowed?: boolean };
  const allowed = body.allowed ?? true;
  const emails = (body.emails ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter((e) => EMAIL_RE.test(e) && e.length <= 254);
  if (emails.length === 0) {
    return NextResponse.json({ error: 'No valid emails' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const rows = emails.map((email) =>
      allowed
        ? { email, allowed: true, source: 'invite', approved_at: new Date().toISOString() }
        : { email, allowed: false, approved_at: null }
    );
    const { error } = await admin.from('beta_signups').upsert(rows, { onConflict: 'email' });
    if (error) throw error;
    return NextResponse.json({ ok: true, count: emails.length });
  } catch (err) {
    console.error('POST /api/admin/invites failed:', err);
    return NextResponse.json({ error: 'Could not update the allowlist' }, { status: 500 });
  }
}
