-- Coat Check — closed-testing waitlist.
-- Visitors without an account can leave their email to be added when beta testing opens.
-- Writes go through the /api/beta Route Handler (service_role); no anon policies.
create table if not exists beta_signups (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  source     text,
  created_at timestamptz not null default now()
);

alter table beta_signups enable row level security;
