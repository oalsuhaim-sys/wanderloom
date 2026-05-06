/**
 * الدول والمدن الحصرية لدليل الوجهات في CRM — منفصلة عن TRIP_DESTINATIONS (نموذج الحجز العام).
 */

export type CrmGuideCityDef = {
  readonly id: string;
  readonly labelAr: string;
};

export type CrmGuideCountryDef = {
  readonly id: string;
  readonly labelAr: string;
  readonly cities: readonly CrmGuideCityDef[];
};

export const CRM_DESTINATIONS_GUIDE = [
  {
    id: 'japan',
    labelAr: 'اليابان',
    cities: [
      { id: 'tokyo', labelAr: 'طوكيو' },
      { id: 'kyoto', labelAr: 'كيوتو' },
      { id: 'osaka', labelAr: 'أوساكا' },
      { id: 'okinawa', labelAr: 'جزر أوكيناوا' },
      { id: 'hokkaido', labelAr: 'هوكايدو' },
    ],
  },
  {
    id: 'korea',
    labelAr: 'كوريا الجنوبية',
    cities: [
      { id: 'seoul', labelAr: 'سيول' },
      { id: 'busan', labelAr: 'بوسان' },
      { id: 'jeju', labelAr: 'جزيرة جيجو' },
    ],
  },
  {
    id: 'china',
    labelAr: 'الصين',
    cities: [
      { id: 'beijing', labelAr: 'بكين' },
      { id: 'shanghai', labelAr: 'شانغهاي' },
      { id: 'guangzhou', labelAr: 'كوانزو' },
    ],
  },
  {
    id: 'canada',
    labelAr: 'كندا',
    cities: [
      { id: 'toronto', labelAr: 'تورونتو' },
      { id: 'vancouver', labelAr: 'فانكوفر' },
      { id: 'montreal', labelAr: 'مونتريال' },
    ],
  },
  {
    id: 'south_africa',
    labelAr: 'جنوب أفريقيا',
    cities: [
      { id: 'cape_town', labelAr: 'كيب تاون' },
      { id: 'johannesburg', labelAr: 'جوهانسبرغ' },
    ],
  },
  {
    id: 'germany',
    labelAr: 'ألمانيا',
    cities: [
      { id: 'berlin', labelAr: 'برلين' },
      { id: 'munich', labelAr: 'ميونخ' },
      { id: 'frankfurt', labelAr: 'فرانكفورت' },
    ],
  },
  {
    id: 'spain',
    labelAr: 'إسبانيا',
    cities: [
      { id: 'madrid', labelAr: 'مدريد' },
      { id: 'barcelona', labelAr: 'برشلونة' },
      { id: 'malaga', labelAr: 'ملقا / الأندلس' },
    ],
  },
  {
    id: 'italy',
    labelAr: 'إيطاليا',
    cities: [
      { id: 'rome', labelAr: 'روما' },
      { id: 'milan', labelAr: 'ميلانو' },
      { id: 'venice', labelAr: 'فينيسيا' },
      { id: 'florence', labelAr: 'فلورنسا' },
    ],
  },
  {
    id: 'france',
    labelAr: 'فرنسا',
    cities: [
      { id: 'paris', labelAr: 'باريس' },
      { id: 'nice', labelAr: 'نيس' },
      { id: 'cannes', labelAr: 'كان' },
    ],
  },
  {
    id: 'uk',
    labelAr: 'المملكة المتحدة',
    cities: [
      { id: 'london', labelAr: 'لندن' },
      { id: 'edinburgh', labelAr: 'إدنبرة' },
      { id: 'manchester', labelAr: 'مانشستر' },
    ],
  },
  {
    id: 'usa',
    labelAr: 'أمريكا',
    cities: [
      { id: 'new_york', labelAr: 'نيويورك' },
      { id: 'los_angeles', labelAr: 'لوس أنجلوس' },
      { id: 'miami', labelAr: 'ميامي' },
      { id: 'orlando', labelAr: 'أورلاندو' },
    ],
  },
  {
    id: 'portugal',
    labelAr: 'البرتغال',
    cities: [
      { id: 'lisbon', labelAr: 'لشبونة' },
      { id: 'porto', labelAr: 'بورتو' },
      { id: 'algarve', labelAr: 'إقليم الغارف' },
      { id: 'azores', labelAr: 'جزر الآزور' },
      { id: 'madeira', labelAr: 'جزيرة ماديرا' },
    ],
  },
  {
    id: 'belgium',
    labelAr: 'بلجيكا',
    cities: [
      { id: 'brussels', labelAr: 'بروكسل' },
      { id: 'bruges', labelAr: 'بروج' },
    ],
  },
  {
    id: 'netherlands',
    labelAr: 'هولندا',
    cities: [
      { id: 'amsterdam', labelAr: 'أمستردام' },
      { id: 'rotterdam', labelAr: 'روتردام' },
      { id: 'hague', labelAr: 'لاهاي' },
    ],
  },
  {
    id: 'czech',
    labelAr: 'التشيك',
    cities: [
      { id: 'prague', labelAr: 'براغ' },
      { id: 'karlovy_vary', labelAr: 'كارلوفي فاري' },
    ],
  },
  {
    id: 'poland',
    labelAr: 'بولندا',
    cities: [
      { id: 'warsaw', labelAr: 'وارسو' },
      { id: 'krakow', labelAr: 'كراكوف' },
    ],
  },
  {
    id: 'austria',
    labelAr: 'النمسا',
    cities: [
      { id: 'vienna', labelAr: 'فيينا' },
      { id: 'salzburg', labelAr: 'سالزبورغ' },
      { id: 'zell_am_see', labelAr: 'زيلامسي' },
    ],
  },
  {
    id: 'sweden',
    labelAr: 'السويد',
    cities: [
      { id: 'stockholm', labelAr: 'ستوكهولم' },
      { id: 'gothenburg', labelAr: 'غوتنبرغ' },
    ],
  },
  {
    id: 'russia',
    labelAr: 'روسيا',
    cities: [
      { id: 'moscow', labelAr: 'موسكو' },
      { id: 'saint_petersburg', labelAr: 'سانت بطرسبرغ' },
    ],
  },
  {
    id: 'hungary',
    labelAr: 'المجر',
    cities: [{ id: 'budapest', labelAr: 'بودابست' }],
  },
  {
    id: 'switzerland',
    labelAr: 'سويسرا',
    cities: [
      { id: 'geneva', labelAr: 'جنيف' },
      { id: 'interlaken', labelAr: 'إنترلاكن' },
      { id: 'zermatt', labelAr: 'زيرمات' },
    ],
  },
] as const satisfies readonly CrmGuideCountryDef[];

export type CrmGuideCountryId = (typeof CRM_DESTINATIONS_GUIDE)[number]['id'];

export function getCrmGuideCountryById(id: string): CrmGuideCountryDef | undefined {
  return CRM_DESTINATIONS_GUIDE.find((c) => c.id === id);
}
