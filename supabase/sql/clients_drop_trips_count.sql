-- Drop redundant trips_count — single source of truth is clients.total_trips
-- Run in Supabase SQL Editor after deploying the app that only reads total_trips.

alter table if exists public.clients
  drop column if exists trips_count;
