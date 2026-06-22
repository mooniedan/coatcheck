-- Coat Check — enforce the app's union types at the database level.
-- The TS types (Cohort / Verdict / Category / relationship / role) are exact unions, but the
-- columns are plain `text`, so the DB would accept a typo the engine then silently ignores.
-- These CHECK constraints make the DB reject bad values. Existing rows already conform.

alter table accounts
  add constraint accounts_cohort_chk check (cohort in ('alpha', 'beta', 'ga'));

alter table profiles
  add constraint profiles_relationship_chk
  check (relationship in ('self', 'partner', 'child', 'other'));

alter table clothing_items
  add constraint clothing_items_category_chk
  check (category in ('Tops', 'Bottoms', 'Outerwear', 'Accessories'));

alter table feedback
  add constraint feedback_cohort_chk check (cohort in ('alpha', 'beta', 'ga'));

alter table feedback
  add constraint feedback_verdict_chk
  check (verdict in ('too_cold', 'too_hot', 'just_right'));

alter table baselines
  add constraint baselines_cohort_chk check (cohort in ('alpha', 'beta', 'ga'));

alter table admin_emails
  add constraint admin_emails_role_chk check (role in ('admin', 'superadmin'));
