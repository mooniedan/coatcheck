-- Coat Check — invite-only allowlist.
-- A beta_signups row with allowed=true is an invited tester (may sign in and use the app).
-- allowed=false is the waitlist: public /beta signups AND people who tried to sign in without
-- an invite. Admins approve waitlist entries (individually or in bulk) to flip allowed=true.
alter table beta_signups add column if not exists allowed boolean not null default false;

-- approved_at / approved_by: light audit of when/by whom an email was let in.
alter table beta_signups add column if not exists approved_at timestamptz;

create index if not exists beta_signups_allowed_idx on beta_signups (allowed);
