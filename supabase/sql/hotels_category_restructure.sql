-- ترحيل تصنيفات الفنادق إلى الهيكل الجديد (للموظفين).
-- نفّذ بعد وجود جدول hotels. يحدّث الصفوف ثم يستبدل قيد الـ CHECK.

-- تعيين مؤقت: القيم القديمة → الجديدة (راجع الصفوف حسب معرفتك بالمورد).
UPDATE public.hotels SET category = 'ultra_luxury' WHERE category = 'five_star';
UPDATE public.hotels SET category = 'boutique_design' WHERE category IN ('boutique', 'ryokan');
UPDATE public.hotels SET category = 'smart_choice' WHERE category = 'four_star';

-- أي قيمة غير متوقعة تبقى — راجعها يدوياً قبل الخطوة التالية إن لزم

ALTER TABLE public.hotels DROP CONSTRAINT IF EXISTS hotels_category_check;

ALTER TABLE public.hotels ADD CONSTRAINT hotels_category_check
  CHECK (category IN (
    'ultra_luxury',
    'boutique_design',
    'apartments_luxe',
    'smart_choice'
  ));

COMMENT ON COLUMN public.hotels.category IS
  'ultra_luxury | boutique_design | apartments_luxe | smart_choice';
