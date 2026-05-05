-- Run in Supabase SQL Editor. Enable RLS on `events` first if you rely on policies:
--   ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_update_events" ON events FOR UPDATE USING (true);

CREATE POLICY "public_write_events" ON events FOR INSERT WITH CHECK (true);
