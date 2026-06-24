-- Coat Check — family sharing, Phase 1: schema + backfill.
-- See .claude/adr/0001-family-owned-profiles.md and 0002-family-invite-grants-access.md.
--
-- ADDITIVE ON PURPOSE: profiles.account_id is kept (the live app still queries it) and
-- profiles.family_id is nullable, so this migration can land ahead of the API rework without
-- breaking profile creation. A later migration sets family_id NOT NULL and drops account_id
-- once nothing reads it.

-- ============================================================ FAMILIES
-- A family owns profiles; one or more accounts are members (see ADR-0001).
create table families (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Membership: an account belongs to exactly one family (unique account_id).
create table family_members (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  account_id uuid not null unique references accounts(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now()
);
create index family_members_family_idx on family_members (family_id);

-- Pending email-keyed invites (see ADR-0002). Deleted on accept (a family_member is created).
create table family_invites (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  email      text not null,
  invited_by uuid references accounts(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index family_invites_family_email_idx on family_invites (family_id, lower(email));
create index family_invites_email_idx on family_invites (lower(email));

-- ============================================================ PROFILES → FAMILY
-- Profiles now belong to a family. Nullable + account_id retained for the additive transition.
alter table profiles add column family_id uuid references families(id) on delete cascade;
create index profiles_family_idx on profiles (family_id);

-- Backfill: each existing account → a family of one (itself as owner); re-parent its profiles.
do $$
declare
  acct record;
  fam  uuid;
begin
  for acct in select id from accounts loop
    insert into families default values returning id into fam;
    insert into family_members (family_id, account_id, role) values (fam, acct.id, 'owner');
    update profiles set family_id = fam where account_id = acct.id;
  end loop;
end $$;

-- ============================================================ RLS
-- Enable; no anon/auth policies — all access via the service_role API (matches accounts/profiles).
alter table families       enable row level security;
alter table family_members enable row level security;
alter table family_invites enable row level security;
