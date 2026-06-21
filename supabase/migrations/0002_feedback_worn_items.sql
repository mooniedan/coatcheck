-- Coat Check — capture what the wearer actually wore that felt comfortable.
-- When a recommendation is reported "too cold" / "too hot", the user can optionally tell us
-- which items felt right instead. This is a stronger learning signal than the verdict alone
-- (it removes guesswork the next time conditions are comparable).
alter table feedback
  add column if not exists worn_item_ids text[] not null default '{}';
