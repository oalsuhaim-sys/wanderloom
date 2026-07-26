-- رابط Google Maps الحقيقي لذكرى العميل (محطة / نشاط)
alter table public.client_memories
  add column if not exists map_url text;

comment on column public.client_memories.map_url is
  'رابط Google Maps المباشر للمحطة/المكان — لا يُستبدل ببحث نصي عام';
