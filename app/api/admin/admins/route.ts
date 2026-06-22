import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSuperadmin } from '@/lib/supabase/auth';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['admin', 'superadmin'];

// POST /api/admin/admins { email, role } → grant an elevated role. Superadmin only.
export async function POST(request: NextRequest) {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as { email?: string; role?: string };
  const email = body.email?.trim().toLowerCase();
  const role = body.role ?? 'admin';
  if (!email || !EMAIL_RE.test(email) || !ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from('admin_emails')
      .upsert({ email, role }, { onConflict: 'email' });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/admin/admins failed:', err);
    return NextResponse.json({ error: 'Could not add admin' }, { status: 500 });
  }
}

// DELETE /api/admin/admins?email=... → revoke a grant. Superadmin only.
// Guards against removing your own grant (so you can't lock yourself out).
export async function DELETE(request: NextRequest) {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
  if (email === (auth.user.email ?? '').toLowerCase()) {
    return NextResponse.json({ error: 'You can’t remove your own access.' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from('admin_emails').delete().eq('email', email);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/admins failed:', err);
    return NextResponse.json({ error: 'Could not remove admin' }, { status: 500 });
  }
}
