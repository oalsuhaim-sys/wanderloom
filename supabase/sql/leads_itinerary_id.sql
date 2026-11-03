-- Links a trip request (leads) to the itinerary matched from the requests board.
alter table public.leads
  add column if not exists itinerary_id bigint references public.itineraries (id) on delete set null;

create index if not exists leads_itinerary_id_idx
  on public.leads (itinerary_id);

comment on column public.leads.itinerary_id is
  'مسار مرتبط بالطلب. تملأه لوحة الطلبات عند التطابق بالمعرّف أو العميل أو الاسم.';
