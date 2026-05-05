# قائمة تحقق — CRM و Supabase (Wanderloom)

## 1. البيئة المحلية (`.env.local`)

- [ ] أنشئ الملف في جذر المشروع بجانب `package.json`.
- [ ] عيّن `NEXT_PUBLIC_SUPABASE_URL` و `NEXT_PUBLIC_SUPABASE_ANON_KEY` (من Supabase → Settings → API).
- [ ] أعد تشغيل `npm run dev` بعد أي تعديل على المتغيرات.
- [ ] افتح الصفحة الرئيسية `/` وتأكد أن الرسالة التوضيحية تختفي أو أن بيانات `clients` تظهر عند الاتصال.

## 2. قاعدة البيانات و RLS

- [ ] نفّذ السكربت `supabase/sql/sessions_and_registrations_rls.sql` في SQL Editor (أو عبر Migrations).
- [ ] تأكد من وجود الجدولين `sessions` و `session_registrations` وأعمدتهما كما في السكربت.
- [ ] من تبويب **Table Editor** جرّب إدراج صف يدوياً في `sessions` ثم `session_registrations`.
- [ ] **مهم للإنتاج:** سياسات `anon` الحالية سمحت بـ SELECT/INSERT/UPDATE لتسهيل التطوير؛ راجع تقييدها (مثلاً حسب `auth.uid()` أو نقل الكتابة إلى Route Handlers بمفتاح `service_role`).

## 3. الواجهة والمسارات

- [ ] `/` — يظهر رابط **لوحة CRM** و **جلسات العملاء** و **بوابة المسار**.
- [ ] `/crm` — لوحة التحكم تعمل؛ بدون Supabase تظهر **وضع تجريبي (Demo)**.
- [ ] `/crm/sessions` — جدول + نموذج جلسات؛ بدون Supabase بيانات تجريبية.
- [ ] `/portal/sessions` — بطاقات جلسات + تسجيل؛ بدون Supabase رسالة وضع تجريبي.

## 4. النشر على Vercel

- [ ] أضف نفس متغيرات `NEXT_PUBLIC_*` في إعدادات المشروع على Vercel (Environment Variables).
- [ ] أعد نشر النسخة بعد حفظ المتغيرات.
- [ ] افتح `https://wanderloom-travel.vercel.app/crm` وتأكد من تحميل اللوحة (مع أو بدون بيانات حقيقية).

## 5. اختبار سريع مع Supabase مفعّل

- [ ] من `/crm/sessions` أنشئ جلسة جديدة وتحقق من ظهورها في **Table Editor**.
- [ ] من `/portal/sessions` سجّل بريداً جديداً وتحقق من صف في `session_registrations`.
- [ ] حاول تسجيل نفس البريد لنفس الجلسة مرتين — يفترض أن تفشل بسبب القيد `unique (session_id, client_email)` (سلوك متوقع).

## 6. عند وجود أخطاء شائعة

| العرض | سبب محتمل |
|--------|------------|
| `permission denied for table` | لم تُنفَّذ `GRANT` أو RLS يمنع الدور `anon`. |
| صفر صفوف رغم وجود بيانات | فلتر `date_time >= now()` في بوابة العميل يخفي الجلسات الماضية. |
| لوحة CRM تعرض Demo رغم وجود المفاتيح | فشل طلب `clients`/`events`/`client_trips` — راجع رسالة الخطأ في الشريط الصفراء. |

---

بعد إكمال البنود أعلاه، يُفترض أن يعمل المسار العام للـ CRM على النشر، مع بقاء **وضع Demo** احتياطياً عند غياب الاتصال أو فشله.
