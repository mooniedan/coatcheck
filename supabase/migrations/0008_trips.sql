-- Coat Check — saved trips.
-- A trip is just a place + a date range; the clothing for each day is derived live from the
-- forecast (never stored). Account-scoped (not localStorage) so the iOS/Android/wearable
-- clients all see the same saved trips.
create table trips (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  location    jsonb not null,        -- ResolvedLocation { name, latitude, longitude, country?, ... }
  start_date  date not null,
  end_date    date not null,
  created_at  timestamptz not null default now()
);
create index trips_account_idx on trips (account_id);

-- RLS on; no anon/auth policies. Every access goes through Route Handlers using the
-- service_role key, scoped to the signed-in user's account (same convention as profiles).
alter table trips enable row level security;
