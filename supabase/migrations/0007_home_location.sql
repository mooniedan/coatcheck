-- Coat Check — per-account "home" location.
-- The place the app falls back to on open when the device's current location isn't readable
-- (geolocation denied/unavailable). Stored as the resolved location JSON (name, coords,
-- country) so the client can re-fetch the forecast and label it without a geocode round-trip.
-- Account-scoped (not localStorage) so future iOS/Android/wearable clients share the same home.
alter table accounts add column if not exists home_location jsonb;
