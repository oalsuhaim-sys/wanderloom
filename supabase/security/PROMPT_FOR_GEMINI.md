أنت تعمل على موقع Wanderloom (Next.js على Vercel: wanderloom-travel.vercel.app) وقاعدة بيانات Supabase (المشروع: mkbfanmzhuxreztrafel). قبل أن تكمل، اقرأ هذا الملخص لتغييرات أجراها Claude على قاعدة البيانات صباح 7 أكتوبر 2026 (بتوقيت الرياض). لم يغيّر Claude أي ملف من كود الموقع المنشور.

## 1) تغيير أمني (مُطبَّق — الساعة 7:48 صباحاً) — migration: security_tier1_safe_hardening
سحبُ صلاحيات من دور الزائر `anon` فقط. دور `authenticated` (لوحة الـ CRM بعد تسجيل الدخول) و`service_role` لم يتغيّرا إطلاقاً:
- سحب TRUNCATE وREFERENCES وTRIGGER من anon على كل جداول public.
- سحب DELETE من anon على كل الجداول، **ما عدا**: itineraries وmarketing_ai_prompts وmarketing_calendar وmarketing_human_scripts وsession_registrations وgroup_members.
- employees: سحب INSERT وUPDATE وDELETE من anon (القراءة ما زالت متاحة).
- memory_vault وinfluencers: سحب كل الصلاحيات من anon.
- قراءة anon محصورة بأعمدة محددة:
  - hotels: id, name, country, city, category
  - experts: id, name
  - leaders: id, name, referral_code, status, languages, destinations, experience_years
- سحب EXECUTE على get_or_create_client_id من anon وpublic.
- العروض (views) distinct_countries وdistinct_cities وglobal_destinations صارت security_invoker = true.
- ضبط search_path = public لأربع دوال.

**التحقق:** سجلات Postgres بعد التطبيق لا تحوي أي خطأ «permission denied» من الموقع. لو احتجت تتراجع عنه: ملف `supabase/security/2026-10-07_phase1_rollback.sql` في فرع `security/phase1-lockdown` يعيد كل السياسات والصلاحيات كما كانت حرفياً.

## 2) إضافة أعمدة (مُطبَّقة — حوالي الساعة 8:05 صباحاً) — migration: schema_sync_missing_columns
أعمدة كان الكود يطلبها وتسبب أخطاء 400. الأعمدة **ما زالت موجودة** لأن تنفيذ التراجع أُلغي، وكلها فارغة (لم يُكتب فيها شيء):
- leads.preferred_trip_id (text) + index
- leads.client_id (uuid, FK → clients.id on delete set null) + index
- clients.intake_automated_at (timestamptz)، clients.dna_link_sent_at (timestamptz)
- group_trips.leader_id (uuid)، group_trips.leader_name (text)
- countries.sort_order (integer not null default 0)
- invoices.trip_title (text not null default '')

**احتمال مرتبط بعطل صفحة /crm/radar:** قبل هذه الإضافة كانت بعض الاستعلامات تفشل ويعمل الكود الاحتياطي (fallback). بعدها صارت تنجح، فقد يصل الكود إلى مسارات لم تكن تُنفَّذ. للتراجع (بلا فقدان بيانات لأن الأعمدة فارغة):
```sql
drop index if exists public.leads_preferred_trip_id_idx;
drop index if exists public.leads_client_id_idx;
alter table public.leads drop column if exists preferred_trip_id, drop column if exists client_id;
alter table public.clients drop column if exists intake_automated_at, drop column if exists dna_link_sent_at;
alter table public.group_trips drop column if exists leader_id, drop column if exists leader_name;
alter table public.countries drop column if exists sort_order;
alter table public.invoices drop column if exists trip_title;
```

## 3) ما لم يُطبَّق
`2026-10-07_wave2_full_lockdown_DRAFT.sql` (تفعيل RLS على كل الجداول) مسودة فقط ولم تُنفَّذ. لا تطبّقها قبل نقل قراءات صفحات العملاء إلى الخادم.

## 4) المطلوب منك الآن
1. افتح https://wanderloom-travel.vercel.app/crm/radar مع أدوات المطوّر (Console) واقرأ رسالة الخطأ الفعلية في JavaScript. «This page couldn't load» شاشة عامة تخفي الخطأ الحقيقي.
2. إذا كان الخطأ مرتبطاً بأحد الأعمدة في البند 2، فإما أن تصلح الكود ليتعامل مع القيم الجديدة، أو تنفّذ SQL التراجع أعلاه.
3. أخطاء «column does not exist» موجودة في السجلات من قبل اليوم وما زالت تظهر. الكود يطلب أعمدة غير موجودة في القاعدة:
   - clients.radar_fulfillment_status
   - leads.birth_date
   - group_members: notes, birth_date, preferences, group_trip_id
   - itineraries.quote_id
   - client_trips.created_at
   - experts.full_name

   وجدولان غير موجودين: partner_applications وcustomers. ويوجد استعلام group_members يضمّن group_trips(...) دون علاقة (foreign key) بين الجدولين، فيرجع 400.
4. مشكلة أنواع: معرّفات clients وleaders وexperts في القاعدة من نوع uuid، والكود في مواضع كثيرة يحوّلها بـ Number(...). ظهر في السجلات طلب `PATCH /clients?id=eq.NaN`، و`parseGroupTripLeaderIdForDb` يرجع null دائماً.
5. فرع main على GitHub (oalsuhaim-sys/wanderloom) آخر تحديث له 17 سبتمبر. تأكد من أي نسخة يُنشر الموقع، حتى لا تضيع تعديلاتك أو تعديلات غيرك.
6. لا تُرجِع صلاحيات anon المسحوبة في البند 1. كانت تسمح لأي زائر بحذف العملاء أو منح نفسه صلاحية المدير، ولا يحتاجها أي جزء من الموقع.
