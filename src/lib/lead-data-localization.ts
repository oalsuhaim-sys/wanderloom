/** ترجمة القيم الإنجليزية الخام من نموذج «سجّل رحلتك» إلى عربية للعرض في CRM */

const LEAD_VALUE_AR: Record<string, string> = {
  // الميزانية
  economical: 'اقتصادية أنيقة',
  moderate: 'متوسطة مريحة',
  comfortable: 'مرتفعة للراحة والتجربة',
  premium: 'فاخرة بلا سقف تقريبي',

  // الاهتمامات
  anime: 'أنمي وثقافة بوب',
  history: 'تاريخ وحضارة',
  nature: 'طبيعة ومناظر',
  kpop: 'كيبوب وكدراما',
  shopping: 'تسوق وموضة',
  seasonal_festivals: 'فعاليات ومهرجانات موسمية',
  adventure_local: 'أنشطة مغامرات وتجارب محلية',
  workshops_crafts: 'ورش عمل وحرف يدوية',
  spa_wellness: 'استجمام وسبا',
  photo_tours: 'جولات تصوير فوتوغرافي',

  // وتيرة اليوم
  calm: 'هادئ',
  medium: 'متوسط',
  active: 'نشيط',

  // المشي
  low: 'خفيف',
  high: 'جاهز لمشي أطول',

  // بدء اليوم
  early: 'مبكر',
  mid: 'متوسط',
  late: 'متأخر',

  // الطعام
  halal: 'حلال',
  seafood: 'بحري',
  vegetarian: 'نباتي',
  flex: 'مرن / بدون قيود صارمة',

  // الإقامة
  boutique: 'بوتيك',
  star4: '4 نجوم',
  star5: '5 نجوم',
  ryokan: 'ريوكان',

  // مصدر التعارف (legacy form codes + leads.lead_source)
  instagram: 'إنستغرام',
  instagram_reel: 'إنستغرام',
  tiktok: 'تيك توك',
  snap: 'سناب شات',
  snapchat: 'سناب شات',
  friend: 'توصية من معارف',
  referral: 'توصية من عميل',
  google: 'بحث / جوجل',
  website: 'الموقع الإلكتروني',
  event: 'فعالية أو لقاء',
  other: 'أخرى',

  // أسلوب الرحلة (canonical)
  Group: 'جماعية',
  Private: 'خاصة',

  // نوع النموذج
  trip_log: 'سجّل رحلتك',
  contact: 'تواصل',
  group_trip: 'رحلة جماعية',
};

export function translateLeadData(key: string | null | undefined): string {
  const raw = String(key ?? '').trim();
  if (!raw) return '—';
  if (raw.startsWith('أخرى:') || raw.startsWith('أخرى')) return raw;
  return LEAD_VALUE_AR[raw] ?? raw;
}

export function translateLeadList(values: string[] | null | undefined): string {
  if (!values?.length) return '—';
  return values.map((v) => translateLeadData(v)).join(' · ');
}
