'use client';

// Super-admin dashboard: manage admin grants, tester cohorts, the invite allowlist, and the
// waitlist (non-invite signups). All data + mutations are gated server-side (requireAdmin /
// requireSuperadmin); this page renders a "not authorized" state otherwise.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import type {
  AdminAccount,
  AdminGrant,
  AdminOverviewResponse,
  BetaSignup,
  Cohort,
  MeResponse,
} from '@/lib/types';

const COHORTS: Cohort[] = ['alpha', 'beta', 'ga'];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

type Status = 'loading' | 'denied' | 'ready';

export default function AdminPage() {
  const [status, setStatus] = useState<Status>('loading');
  const [myEmail, setMyEmail] = useState<string | null>(null);
  const [isSuper, setIsSuper] = useState(false);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [admins, setAdmins] = useState<AdminGrant[]>([]);
  const [signups, setSignups] = useState<BetaSignup[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const me = (await fetch('/api/me').then((r) => r.json())) as MeResponse;
    const role = me.user?.role;
    setMyEmail(me.user?.email ?? null);
    setIsSuper(role === 'superadmin');
    if (role !== 'admin' && role !== 'superadmin') {
      setStatus('denied');
      return;
    }
    const res = await fetch('/api/admin/overview');
    if (!res.ok) {
      setStatus('denied');
      return;
    }
    const data = (await res.json()) as AdminOverviewResponse;
    setAccounts(data.accounts ?? []);
    setAdmins(data.admins ?? []);
    setSignups(data.signups ?? []);
    setStatus('ready');
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const waitlist = signups.filter((s) => !s.allowed);
  const accountEmails = new Set(accounts.map((a) => (a.email ?? '').toLowerCase()));
  const invitedPending = signups.filter((s) => s.allowed && !accountEmails.has(s.email));

  async function changeCohort(account: AdminAccount, cohort: Cohort) {
    const prev = account.cohort;
    setAccounts((list) => list.map((a) => (a.id === account.id ? { ...a, cohort } : a)));
    const res = await fetch('/api/admin/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: account.id, cohort }),
    });
    if (!res.ok) setAccounts((list) => list.map((a) => (a.id === account.id ? { ...a, cohort: prev } : a)));
  }

  async function invite(emails: string[]) {
    if (emails.length === 0) return;
    setBusy(true);
    const res = await fetch('/api/admin/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails }),
    });
    if (res.ok) await load();
    setBusy(false);
  }

  async function addAdmin(email: string, role: string) {
    setBusy(true);
    const res = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    if (res.ok) await load();
    setBusy(false);
  }

  async function removeAdmin(email: string) {
    setBusy(true);
    const res = await fetch(`/api/admin/admins?email=${encodeURIComponent(email)}`, {
      method: 'DELETE',
    });
    if (res.ok) await load();
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-4 py-6 sm:py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-medium tracking-tight text-on-surface sm:text-3xl">Admin</h1>
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          ← Home
        </Link>
      </header>

      {status === 'loading' && <p className="text-on-surface-variant">Loading…</p>}
      {status === 'denied' && (
        <div className="rounded-2xl border border-outline-variant bg-surface-low px-5 py-6 text-on-surface-variant">
          You don’t have access to this page. It’s available to admins only.
        </div>
      )}

      {status === 'ready' && (
        <>
          <Testers accounts={accounts} onCohort={changeCohort} />
          <Waitlist waitlist={waitlist} busy={busy} onApprove={invite} />
          <Invited invited={invitedPending} />
          {isSuper && (
            <Admins admins={admins} myEmail={myEmail} busy={busy} onAdd={addAdmin} onRemove={removeAdmin} />
          )}
        </>
      )}
    </main>
  );
}

function Section({ title, count, children }: { title: string; count?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-medium text-on-surface">{title}</h2>
        {count && <span className="text-sm text-on-surface-variant">{count}</span>}
      </div>
      {children}
    </section>
  );
}

const listClass =
  'divide-y divide-outline-variant overflow-hidden rounded-2xl border border-outline-variant bg-surface';

function Testers({
  accounts,
  onCohort,
}: {
  accounts: AdminAccount[];
  onCohort: (a: AdminAccount, c: Cohort) => void;
}) {
  return (
    <Section title="Testers" count={`${accounts.length} account(s)`}>
      {accounts.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          No accounts yet — they appear here once invited people sign in.
        </p>
      ) : (
        <ul className={listClass}>
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-on-surface">{a.email ?? '—'}</span>
                <span className="block text-xs text-on-surface-variant">Joined {fmtDate(a.created_at)}</span>
              </span>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-on-surface-variant">Cohort</span>
                <select
                  value={a.cohort}
                  onChange={(e) => onCohort(a, e.target.value as Cohort)}
                  className="rounded-full border border-outline-variant bg-surface-lowest px-3 py-1.5 font-medium text-on-surface outline-none focus:border-primary"
                >
                  {COHORTS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Waitlist({
  waitlist,
  busy,
  onApprove,
}: {
  waitlist: BetaSignup[];
  busy: boolean;
  onApprove: (emails: string[]) => void;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState('');

  const toggle = (email: string) =>
    setSel((s) => {
      const next = new Set(s);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  const allSelected = waitlist.length > 0 && sel.size === waitlist.length;

  const submitAdd = () => {
    const emails = adding.split(/[\s,]+/).map((e) => e.trim()).filter(Boolean);
    if (emails.length) {
      onApprove(emails);
      setAdding('');
    }
  };

  return (
    <Section title="Waitlist" count={`${waitlist.length} pending`}>
      {/* Invite arbitrary emails directly (creates them allow-listed). */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          placeholder="Invite by email (comma or space separated)…"
          className="flex-1 rounded-full border border-outline-variant bg-surface-lowest px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
        />
        <button
          onClick={submitAdd}
          disabled={busy || !adding.trim()}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary shadow-[var(--md-elev-1)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Invite
        </button>
      </div>

      {waitlist.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No pending signups.</p>
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => setSel(e.target.checked ? new Set(waitlist.map((w) => w.email)) : new Set())}
              />
              Select all
            </label>
            <button
              onClick={() => {
                onApprove([...sel]);
                setSel(new Set());
              }}
              disabled={busy || sel.size === 0}
              className="rounded-full bg-secondary-container px-4 py-1.5 text-sm font-medium text-on-secondary-container transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Add {sel.size || ''} to testing
            </button>
          </div>
          <ul className={listClass}>
            {waitlist.map((w) => (
              <li key={w.email} className="flex items-center justify-between gap-3 px-4 py-3">
                <label className="inline-flex min-w-0 items-center gap-3">
                  <input type="checkbox" checked={sel.has(w.email)} onChange={() => toggle(w.email)} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-on-surface">{w.email}</span>
                    <span className="block text-xs text-on-surface-variant">
                      {w.source ?? 'signup'} · {fmtDate(w.created_at)}
                    </span>
                  </span>
                </label>
                <button
                  onClick={() => onApprove([w.email])}
                  disabled={busy}
                  className="shrink-0 rounded-full border border-outline-variant px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-surface-high disabled:opacity-50"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

function Invited({ invited }: { invited: BetaSignup[] }) {
  if (invited.length === 0) return null;
  return (
    <Section title="Invited (awaiting sign-in)" count={`${invited.length}`}>
      <ul className={listClass}>
        {invited.map((s) => (
          <li key={s.email} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="inline-flex min-w-0 items-center gap-2">
              <Icon name="check" size={15} color="var(--cc-just)" strokeWidth={2.4} />
              <span className="truncate text-sm text-on-surface">{s.email}</span>
            </span>
            <span className="shrink-0 text-xs text-on-surface-variant">
              invited {s.approved_at ? fmtDate(s.approved_at) : ''}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Admins({
  admins,
  myEmail,
  busy,
  onAdd,
  onRemove,
}: {
  admins: AdminGrant[];
  myEmail: string | null;
  busy: boolean;
  onAdd: (email: string, role: string) => void;
  onRemove: (email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('admin');
  return (
    <Section title="Admins" count={`${admins.length}`}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Grant admin by email…"
          className="flex-1 rounded-full border border-outline-variant bg-surface-lowest px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-full border border-outline-variant bg-surface-lowest px-3 py-2.5 text-sm font-medium text-on-surface outline-none focus:border-primary"
        >
          <option value="admin">admin</option>
          <option value="superadmin">superadmin</option>
        </select>
        <button
          onClick={() => {
            if (email.trim()) {
              onAdd(email.trim(), role);
              setEmail('');
            }
          }}
          disabled={busy || !email.trim()}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary shadow-[var(--md-elev-1)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Add
        </button>
      </div>
      <ul className={listClass}>
        {admins.map((a) => {
          const isSelf = a.email === (myEmail ?? '').toLowerCase();
          return (
            <li key={a.email} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm text-on-surface">{a.email}</span>
                <span className="block text-xs text-on-surface-variant">{a.role}</span>
              </span>
              <button
                onClick={() => onRemove(a.email)}
                disabled={busy || isSelf}
                title={isSelf ? 'You can’t remove your own access' : 'Remove'}
                className="shrink-0 rounded-full border border-outline-variant px-3 py-1.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-high disabled:opacity-30"
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
