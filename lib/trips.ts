// Columns selected for a saved trip — shared by the /api/trips routes so the projection
// (notably the seen_at addition) can't drift between them.
export const TRIP_COLS = 'id, location, start_date, end_date, created_at, seen_at';
