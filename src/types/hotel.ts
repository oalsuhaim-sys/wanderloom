/**
 * تصنيف الفندق في CRM — هيكلة للموظف (اقتراحات دقيقة للعميل).
 * القيم في عمود `hotels.category` في Supabase.
 */
export type HotelCategory =
  | 'ultra_luxury'
  | 'boutique_design'
  | 'apartments_luxe'
  | 'smart_choice';

/** قيم قديمة قبل الترحيل (للعرض الاحتياطي فقط) */
export type LegacyHotelCategory = 'boutique' | 'four_star' | 'five_star' | 'ryokan';

export type HotelRow = {
  id: string;
  name: string;
  country: string;
  city: string;
  category: HotelCategory | LegacyHotelCategory | string;
  booking_url: string | null;
  notes: string | null;
  manager_name: string | null;
  /** رقم الهاتف / واتساب الأساسي */
  contact_number: string | null;
  /** بريد التواصل الأساسي (يُعرض في عمود التواصل) */
  email: string | null;
  /** رقم واتساب اختياري إن اختلف عن contact_number */
  whatsapp?: string | null;
  created_at: string;
};
