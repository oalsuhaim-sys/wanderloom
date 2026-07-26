-- travel_dna (jsonb) هو مصدر travel_dna_json لميزة التطابق البشري — لا عمود إضافي مطلوب
comment on column public.clients.travel_dna is
  'travel_dna_json — DNA السياحي: interests، مقعد الطيران، طعام، فندق، نشاط، إلخ. يُستخدم في Fellowship Matching.';
