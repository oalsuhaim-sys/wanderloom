-- مركز التسويق — جداول AI / الإنتاج البشري / التقويم / الهوية
-- نفّذ في Supabase SQL Editor قبل تشغيل scripts/seedMarketingData.mjs

-- ─── AI Prompts ─────────────────────────────────────────────────────────────
create table if not exists public.marketing_ai_prompts (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'local'
    check (category in ('seasonal', 'local', 'shareable')),
  campaign text not null default '',
  visual_prompt text not null default '',
  caption text not null default '',
  hashtags text not null default '',
  status text not null default 'جاهز للتوليد',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_ai_prompts_sort_idx
  on public.marketing_ai_prompts (sort_order, created_at);

-- ─── Human Scripts ──────────────────────────────────────────────────────────
create table if not exists public.marketing_human_scripts (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  platform text not null default 'Instagram',
  hook text not null default '',
  shot_list text[] not null default '{}',
  voiceover_script text not null default '',
  carousel_structure text not null default '',
  status text not null default 'بانتظار التصوير',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_human_scripts_sort_idx
  on public.marketing_human_scripts (sort_order, created_at);

-- ─── Content Calendar ───────────────────────────────────────────────────────
create table if not exists public.marketing_calendar (
  id uuid primary key default gen_random_uuid(),
  month_week text not null default '',
  topic text not null default '',
  format text not null default 'Reel',
  platform text not null default 'Instagram',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_calendar_sort_idx
  on public.marketing_calendar (sort_order, created_at);

-- ─── Brand Identity (صف واحد slug=default) ──────────────────────────────────
create table if not exists public.brand_identity (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique default 'default',
  slogan text not null default 'واندرلوم: تفصيل لا تنظيم',
  ai_scarf_prompt_rule text not null default
    'featuring a prominent custom luxury branded silk scarf integrated elegantly into the shot, quiet luxury aesthetic, highly detailed, cinematic lighting',
  brand_colors text not null default
    'الخلفية: #FDFBF7 · النص: #111111 · Royal Olive: #1e3f20 · Gold: #cda04c · خط Tajawal · أسلوب Quiet Luxury — مساحات بيضاء، ظلال ناعمة، بدون ازدحام بصري.',
  updated_at timestamptz not null default now()
);

insert into public.brand_identity (slug, slogan, ai_scarf_prompt_rule, brand_colors)
values (
  'default',
  'واندرلوم: تفصيل لا تنظيم',
  'featuring a prominent custom luxury branded silk scarf integrated elegantly into the shot, quiet luxury aesthetic, highly detailed, cinematic lighting',
  'الخلفية: #FDFBF7 · النص: #111111 · Royal Olive: #1e3f20 · Gold: #cda04c · خط Tajawal · أسلوب Quiet Luxury — مساحات بيضاء، ظلال ناعمة، بدون ازدحام بصري.'
)
on conflict (slug) do nothing;

-- ─── RLS (CRM — anon/authenticated كبقية الجداول) ───────────────────────────
alter table public.marketing_ai_prompts enable row level security;
alter table public.marketing_human_scripts enable row level security;
alter table public.marketing_calendar enable row level security;
alter table public.brand_identity enable row level security;

drop policy if exists "marketing_ai_prompts_crm_all" on public.marketing_ai_prompts;
create policy "marketing_ai_prompts_crm_all"
  on public.marketing_ai_prompts for all
  to anon, authenticated
  using (true) with check (true);

drop policy if exists "marketing_human_scripts_crm_all" on public.marketing_human_scripts;
create policy "marketing_human_scripts_crm_all"
  on public.marketing_human_scripts for all
  to anon, authenticated
  using (true) with check (true);

drop policy if exists "marketing_calendar_crm_all" on public.marketing_calendar;
create policy "marketing_calendar_crm_all"
  on public.marketing_calendar for all
  to anon, authenticated
  using (true) with check (true);

drop policy if exists "brand_identity_crm_all" on public.brand_identity;
create policy "brand_identity_crm_all"
  on public.brand_identity for all
  to anon, authenticated
  using (true) with check (true);

-- ─── بذور أولية (فقط إذا الجداول فارغة) ────────────────────────────────────
insert into public.marketing_ai_prompts (category, campaign, visual_prompt, caption, hashtags, status, sort_order)
select * from (values
  (
    'local'::text,
    'طوكيو - الجانب المظلم والمضيء',
    'Cinematic night shot of Tokyo neon streets, hidden izakaya alleyway, moody atmosphere, 8k resolution, photorealistic --ar 16:9',
    'تظن أنك شفت طوكيو؟ الجانب المخفي من العاصمة لا ينام... اكتشف معنا الأزقة التي لا توجد في قوائم السياح المعتادة. 🇯🇵✨',
    '#طوكيو_واندرلوم #سياحة_فاخرة #اليابان_للنخبة',
    'جاهز للتوليد',
    1
  ),
  (
    'local'::text,
    'سيول - عبق التاريخ والقهوة',
    'Elegant Korean Hanok cafe in Bukchon village during autumn, golden hour lighting, luxurious aesthetic, highly detailed --ar 4:5',
    'في سيول، التاريخ لا يُقرأ في الكتب فقط، بل يُعاش في فنجان قهوة داخل قرية ''بوكتشون'' التاريخية. هل أنت جاهز لتجربة السفر عبر الزمن؟ 🇰🇷☕',
    '#سيول_كوريا #هانوك #واندرلوم',
    'تم الرفع',
    2
  )
) as seed(category, campaign, visual_prompt, caption, hashtags, status, sort_order)
where not exists (select 1 from public.marketing_ai_prompts limit 1);

insert into public.marketing_human_scripts (title, platform, hook, shot_list, voiceover_script, status, sort_order)
select * from (values
  (
    'ريلز: كيف تختار مسارك في اليابان',
    'Instagram & TikTok',
    'اليابان مو بس طوكيو وأوساكا.. الاختيار الغلط بيكلفك متعة رحلتك!',
    array[
      'ثانية 1-3: لقطة سريعة لخريطة اليابان مع تأشير على مناطق غير معروفة.',
      'ثانية 4-8: لقطة من قطار الشينكانسن الفاخر من الداخل.',
      'ثانية 9-15: لقطة للعميل وهو يتأمل في حديقة كيوتو.'
    ]::text[],
    'كثير يسافرون اليابان ويحصرون نفسهم في المدن المزدحمة. إذا كنت تبحث عن الهدوء والفخامة، مسار هوكايدو أو جبال الألب اليابانية هو خيارك الأول. في واندرلوم، نفصل مسارك على مقاس ذوقك.',
    'بانتظار التصوير',
    1
  ),
  (
    'بيع الشعور - السفر الفاخر',
    'TikTok',
    'متى آخر مرة سافرت ورجعت مرتاح فعلاً؟ مو محتاج إجازة بعد الإجازة؟',
    array[
      'لقطة قريبة (B-roll) لقهوة مختصة في المطار.',
      'لقطة لسيارة VIP تنتظر العميل عند باب الفندق.'
    ]::text[],
    'السفر التقليدي يستنزف طاقتك في التخطيط والضياع. السفر مع واندرloom يعني أن كل تفصيلة محسوبة لراحتك المطلقة.',
    'جاري المونتاج',
    2
  )
) as seed(title, platform, hook, shot_list, voiceover_script, status, sort_order)
where not exists (select 1 from public.marketing_human_scripts limit 1);

insert into public.marketing_calendar (month_week, topic, format, platform, sort_order)
select * from (values
  ('الأسبوع الأول', 'وعي: ليه لازم تصمم رحلتك؟', 'Reel', 'Instagram', 1),
  ('الأسبوع الثاني', 'استعراض مسار: طوكيو VIP', 'Carousel', 'Instagram', 2),
  ('الأسبوع الثالث', 'تريند: مقارنة بين تنظيمنا والتنظيم العادي', 'TikTok Video', 'TikTok', 3)
) as seed(month_week, topic, format, platform, sort_order)
where not exists (select 1 from public.marketing_calendar limit 1);

-- ترقية: تصنيفات عربية + نوع الوسائط لحملات AI
alter table public.marketing_ai_prompts
  add column if not exists media_type text not null default 'فيديو';

alter table public.marketing_ai_prompts
  drop constraint if exists marketing_ai_prompts_category_check;

alter table public.marketing_ai_prompts
  alter column category set default 'أخرى';

update public.marketing_ai_prompts
set category = 'أخرى'
where category in ('seasonal', 'local', 'shareable');

update public.marketing_ai_prompts
set media_type = 'فيديو'
where media_type is null or trim(media_type) = '';
