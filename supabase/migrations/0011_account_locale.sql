-- Coat Check — per-account language preference (i18n).
-- Stored on the account (like home_location) so it loads on open and future native/wearable
-- clients can read the same preference and apply their own translations. Null = follow the
-- browser language. Values are app-controlled (e.g. 'en', 'nb').
alter table accounts add column if not exists locale text;
