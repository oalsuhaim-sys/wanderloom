-- Wanderloom: add visit_time to itinerary stop stations
-- Correct table: itinerary_stops (NOT itinerary_stations)
-- Nested under itinerary_days; primary live data also lives in itineraries.days_data JSONB stops.

-- 1) Relational stops table (legacy / nested CRM reads)
ALTER TABLE public.itinerary_stops
  ADD COLUMN IF NOT EXISTS visit_time text;

COMMENT ON COLUMN public.itinerary_stops.visit_time IS
  'Scheduled client visit time (HH:MM). Preferred over legacy time_slot.';

-- 2) Optional: keep time_slot for backward compatibility if it already exists.
--    New CRM writes set BOTH visit_time and time_slot to the same value.
-- ALTER TABLE public.itinerary_stops ADD COLUMN IF NOT EXISTS time_slot text;

-- 3) days_data JSONB (source of truth for most trips):
--    Each stop object under days_data[*].stops / itinerary_stops should include:
--    { "place_name": "...", "visit_time": "10:00", "time_slot": "10:00", ... }
--    No SQL migration required for JSONB — the app writes visit_time on save.
