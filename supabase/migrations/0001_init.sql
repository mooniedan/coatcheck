-- Coat Check — initial schema
-- Run in the Supabase SQL Editor (EU-region project).
-- Design notes:
--   * All MUTATIONS go through Next.js Route Handlers using the SERVICE_ROLE key
--     (bypasses RLS). The browser anon key is read-only.
--   * RLS is ON everywhere. Anon may SELECT only genuinely public config
--     (clothing_items, the active cohort baselines). Accounts/profiles/feedback are private.
--   * Personalization is layered: a profile's comfort_model overrides the cohort baseline,
--     which overrides the hard-coded generic defaults in lib/catalog.ts.

create extension if not exists "pgcrypto";

-- Idempotent: safe to re-run during setup (drops in FK-dependency order).
drop table if exists feedback       cascade;
drop table if exists baselines      cascade;
drop table if exists profiles       cascade;
drop table if exists accounts       cascade;
drop table if exists clothing_items cascade;

-- ============================================================ ACCOUNTS
-- One row per Google identity. cohort governs which baseline new profiles start from.
create table accounts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  email      text,
  cohort     text not null default 'alpha',   -- alpha | beta | ga
  created_at timestamptz not null default now()
);

-- ============================================================ PROFILES (family members)
create table profiles (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  display_name  text not null,
  relationship  text not null default 'other', -- self | partner | child | other
  comfort_model jsonb not null default '{"offsetC":0}'::jsonb,  -- learned per-wearer offset (°C)
  created_at    timestamptz not null default now()
);
create index profiles_account_idx on profiles (account_id);

-- ============================================================ CLOTHING CATALOG (public)
-- Mirrors lib/catalog.ts. Generic feels-like bands (°C); overlapping bands enable layering.
create table clothing_items (
  id            text primary key,
  name          text not null,
  category      text not null,                 -- Tops | Bottoms | Outerwear | Accessories
  min_temp_c    integer not null,
  max_temp_c    integer not null,
  requires_rain boolean not null default false,
  requires_wind boolean not null default false,
  icon          text
);

-- ============================================================ FEEDBACK (the learning signal)
create table feedback (
  id                   uuid primary key default gen_random_uuid(),
  profile_id           uuid not null references profiles(id) on delete cascade,
  cohort               text not null,          -- denormalized for the aggregation job
  feels_like_c         double precision not null,
  conditions           jsonb not null,         -- the WeatherSnapshot at recommendation time
  recommended_item_ids text[] not null default '{}',
  verdict              text not null,          -- too_cold | too_hot | just_right
  server_ts            timestamptz not null default now()  -- authoritative
);
create index feedback_profile_idx on feedback (profile_id);
create index feedback_cohort_idx  on feedback (cohort);

-- ============================================================ BASELINES (versioned, per cohort)
-- Output of the Phase 3 aggregation job: alpha → beta baseline, alpha+beta → GA baseline.
create table baselines (
  id          uuid primary key default gen_random_uuid(),
  cohort      text not null,                   -- the cohort this baseline is FOR
  version     integer not null,
  thresholds  jsonb not null,                  -- e.g. { "offsetC": -0.5 } or per-category tuning
  computed_at timestamptz not null default now(),
  unique (cohort, version)
);

-- ============================================================ RLS
alter table accounts       enable row level security;
alter table profiles       enable row level security;
alter table clothing_items enable row level security;
alter table feedback       enable row level security;
alter table baselines      enable row level security;

-- Anon (browser) may read public config only.
create policy "anon read clothing" on clothing_items for select to anon using (true);
create policy "anon read baselines" on baselines    for select to anon using (true);

-- No anon/auth write policies, and none for accounts/profiles/feedback: every access to
-- personal data goes through Route Handlers using the service_role key (bypasses RLS),
-- which scope each query to the signed-in user's account.
