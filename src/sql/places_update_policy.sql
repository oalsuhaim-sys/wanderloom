-- Run in Supabase SQL Editor after enabling RLS on `places` if needed.
-- Example:
--   ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_update_places" ON public.places FOR UPDATE USING (true);
