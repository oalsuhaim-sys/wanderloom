/** تصنيفات VIP المعتمدة — تُخزَّن كما هي في عمود experiences.category */
export const VIP_EXPERIENCE_CATEGORIES = [
  'أزياء / VIP',
  'طعام / VIP',
  'أدرينالين / شتوي',
  'طعام / طبيعة',
  'تراث وثقافة',
  'استرخاء ونقاهة',
  'مغامرة وإثارة',
  'تسوق وفخامة',
  'طبيعة واستكشاف',
  'عروض وحفلات',
  'أنشطة بحرية',
  'تجارب محلية',
  'فن ومتاحف',
  'رياضة وحركة',
] as const;

export type ExperienceCategory = (typeof VIP_EXPERIENCE_CATEGORIES)[number];

/** قيم قديمة في بيانات البذور — للعرض فقط */
const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  cooking: 'طهي',
  heritage: 'تراث',
  shopping: 'تسوق',
  relaxation: 'استرخاء',
};

export function experienceCategoryLabel(category: string): string {
  const trimmed = category?.trim() ?? '';
  if (!trimmed) return '—';
  if ((VIP_EXPERIENCE_CATEGORIES as readonly string[]).includes(trimmed)) return trimmed;
  if (LEGACY_CATEGORY_LABELS[trimmed]) return LEGACY_CATEGORY_LABELS[trimmed];
  return trimmed;
}

export function isKnownExperienceCategory(category: string): category is ExperienceCategory {
  const trimmed = category?.trim() ?? '';
  return (VIP_EXPERIENCE_CATEGORIES as readonly string[]).includes(trimmed);
}

export type ExperienceRow = {
  id: string;
  title: string;
  country: string;
  city: string;
  category: string;
  description: string;
  detail_url: string | null;
  booking_url?: string | null;
  created_at: string;
};
