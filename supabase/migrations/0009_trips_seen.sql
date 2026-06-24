-- Coat Check — trip "seen" marker for the Trips nav badge.
-- Set when the user opens a trip whose weather is available. The badge counts trips that now
-- have a forecast (dates within the ~16-day horizon) but haven't been seen since — i.e. a trip
-- you saved for far-off dates that the forecast has just reached. (A precursor to native push.)
alter table trips add column if not exists seen_at timestamptz;
