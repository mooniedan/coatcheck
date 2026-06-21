-- Coat Check — elevated roles, granted by email.
-- An account's role is resolved from this table at sign-in / provisioning (see /api/me).
-- Granting by email lets us seed an admin before that person has ever signed in (their
-- auth.users row / account doesn't exist yet).
create table if not exists admin_emails (
  email      text primary key,
  role       text not null default 'admin',  -- admin | superadmin
  created_at timestamptz not null default now()
);

alter table admin_emails enable row level security;
-- No anon/auth policies: read via the service_role client in Route Handlers only.

-- Seed the project owner as super admin.
insert into admin_emails (email, role) values ('mooniedan@gmail.com', 'superadmin')
  on conflict (email) do update set role = excluded.role;
