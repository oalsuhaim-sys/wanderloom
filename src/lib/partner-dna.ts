/** بصمة الشريك — leaders / experts / celebrities */

export type PartnerDnaType = 'leaders' | 'experts' | 'celebrities';

export type PartnerDnaProfile = {
  /** المهارات والرخص التخصصية لقائد الرحلة */
  specialSkills: string[];
  /** أنماط الرحلات المفضلة لقائد الرحلة */
  preferredStyles: string[];
  /** الوجهات المعتمدة من قائمة Wanderloom */
  approvedDestinations: string[];
  /** أنماط تصميم المسار المختارة */
  routingStyles: string[];
  /** نقاط قوة خبير الوجهة في ترتيب الفعاليات */
  activityStrengths: string[];
  /** أسلوبك في إدارة/تصميم الرحلات */
  tripStyle: string;
  /** الوجهات أو الفئات التي تبدع فيها */
  strengths: string;
  /** ما الذي يميزك عن غيرك؟ */
  competitiveAdvantage: string;
  /** متطلباتك الخاصة من الشركة */
  agencyRequirements: string;
  submittedAt: string | null;
};

export const EMPTY_PARTNER_DNA: PartnerDnaProfile = {
  specialSkills: [],
  preferredStyles: [],
  approvedDestinations: [],
  routingStyles: [],
  activityStrengths: [],
  tripStyle: '',
  strengths: '',
  competitiveAdvantage: '',
  agencyRequirements: '',
  submittedAt: null,
};

export const PARTNER_TABLE_BY_TYPE: Record<PartnerDnaType, string> = {
  leaders: 'leaders',
  experts: 'experts',
  celebrities: 'celebrities',
};

export function parsePartnerDnaType(raw: unknown): PartnerDnaType | null {
  const t = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (t === 'leaders' || t === 'leader') return 'leaders';
  if (t === 'experts' || t === 'expert') return 'experts';
  if (t === 'celebrities' || t === 'celebrity') return 'celebrities';
  return null;
}

function asRecord(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function pickText(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = obj[key];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}

function pickTextArray(obj: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    const text = String(value ?? '').trim();
    if (text) {
      return text.split(/[,،]/).map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

export function parsePartnerDnaProfile(raw: unknown): PartnerDnaProfile {
  const obj = asRecord(raw);
  return {
    specialSkills: pickTextArray(obj, [
      'specialSkills',
      'special_skills',
      'skills',
      'certifications',
    ]),
    preferredStyles: pickTextArray(obj, [
      'preferredStyles',
      'preferred_styles',
      'preferredTripStyles',
      'preferred_trip_styles',
    ]),
    approvedDestinations: pickTextArray(obj, [
      'approvedDestinations',
      'approved_destinations',
      'specialtyDestinations',
      'specialty_destinations',
      'destinations',
      'specialty_regions',
    ]),
    routingStyles: pickTextArray(obj, [
      'routingStyles',
      'routing_styles',
      'routingStyle',
      'routing_style',
    ]),
    activityStrengths: pickTextArray(obj, [
      'activityStrengths',
      'activity_strengths',
      'curationStrengths',
      'curation_strengths',
    ]),
    tripStyle: pickText(obj, [
      'tripStyle',
      'trip_style',
      'workingStyle',
      'working_style',
      'routingStyle',
      'routing_style',
      'itinerary_style',
    ]),
    strengths: pickText(obj, [
      'strengths',
      'excellenceAreas',
      'excellence_areas',
      'notes',
      'extra_notes',
    ]),
    competitiveAdvantage: pickText(obj, [
      'competitiveAdvantage',
      'competitive_advantage',
      'uniqueAdvantages',
      'unique_advantages',
      'advantages',
    ]),
    agencyRequirements: pickText(obj, [
      'agencyRequirements',
      'agency_requirements',
      'companyAlignment',
      'company_alignment',
      'company_needs',
    ]),
    submittedAt: pickText(obj, ['submittedAt', 'submitted_at']) || null,
  };
}

export function serializePartnerDnaProfile(
  dna: Partial<PartnerDnaProfile>,
  options?: { markSubmitted?: boolean },
): Record<string, unknown> {
  const base = parsePartnerDnaProfile(dna);
  return {
    special_skills: base.specialSkills,
    preferred_styles: base.preferredStyles,
    approved_destinations: base.approvedDestinations,
    specialty_destinations: base.approvedDestinations,
    routing_style: base.routingStyles,
    routing_styles: base.routingStyles,
    activity_strengths: base.activityStrengths,
    trip_style: base.tripStyle.trim(),
    strengths: base.strengths.trim(),
    competitive_advantage: base.competitiveAdvantage.trim(),
    agency_requirements: base.agencyRequirements.trim(),
    submitted_at: options?.markSubmitted
      ? new Date().toISOString()
      : base.submittedAt,
  };
}

export function partnerDnaHasContent(dna: PartnerDnaProfile): boolean {
  return Boolean(
    dna.specialSkills.length ||
      dna.preferredStyles.length ||
      dna.approvedDestinations.length ||
      dna.routingStyles.length ||
      dna.activityStrengths.length ||
      dna.tripStyle ||
      dna.strengths ||
      dna.competitiveAdvantage ||
      dna.agencyRequirements,
  );
}

/** هل يوجد محتوى فعلي في dna_profile (بعد التجاهل للمفاتيح الفارغة و timestamps) */
export function isPartnerDnaRawFilled(raw: unknown): boolean {
  return partnerDnaHasContent(parsePartnerDnaProfile(raw));
}

export type PartnerDnaDisplayEntry = {
  key: string;
  label: string;
  value: string | string[];
};

/** قائمة عرض مرتبة بعناوين عربية لحقول البصمة المعبأة */
export function partnerDnaDisplayEntries(
  raw: unknown,
): PartnerDnaDisplayEntry[] {
  const dna = parsePartnerDnaProfile(raw);
  const entries: PartnerDnaDisplayEntry[] = [
    {
      key: 'specialSkills',
      label: 'المهارات والرخص التخصصية',
      value: dna.specialSkills,
    },
    {
      key: 'preferredStyles',
      label: 'أنماط الرحلات المفضلة',
      value: dna.preferredStyles,
    },
    {
      key: 'approvedDestinations',
      label: 'الوجهات المعتمدة',
      value: dna.approvedDestinations,
    },
    {
      key: 'routingStyles',
      label: 'أسلوب تصميم المسارات',
      value: dna.routingStyles,
    },
    {
      key: 'activityStrengths',
      label: 'نقاط القوة في الفعاليات',
      value: dna.activityStrengths,
    },
    {
      key: 'tripStyle',
      label: 'أسلوب إدارة/تصميم الرحلات',
      value: dna.tripStyle,
    },
    {
      key: 'strengths',
      label: 'الوجهات أو الفئات التي يبدع فيها',
      value: dna.strengths,
    },
    {
      key: 'competitiveAdvantage',
      label: 'الميزة التنافسية',
      value: dna.competitiveAdvantage,
    },
    {
      key: 'agencyRequirements',
      label: 'متطلبات من الشركة',
      value: dna.agencyRequirements,
    },
  ];
  return entries.filter((entry) =>
    Array.isArray(entry.value)
      ? entry.value.length > 0
      : entry.value.trim().length > 0,
  );
}

export const PARTNER_ROUTING_STYLE_OPTIONS = [
  { id: 'relaxed', label: 'فخامة هادئة' },
  { id: 'fast-paced', label: 'إيقاع سريع' },
  { id: 'cultural', label: 'انغماس ثقافي' },
  { id: 'adventure', label: 'مغامرة ناعمة' },
  { id: 'family-first', label: 'عائلي أولاً' },
  { id: 'food-lifestyle', label: 'طعام ولايف ستايل' },
  { id: 'adaptive', label: 'مرن حسب العميل' },
] as const;

export const LEADER_SPECIAL_SKILL_OPTIONS = [
  'مدرب يوجا 🧘‍♀️',
  'مدرب غوص 🤿',
  'تصوير احترافي 📸',
  'إسعافات أولية 🚑',
  'مرشد جبلي ⛰️',
  'أخرى',
] as const;

export const LEADER_PREFERRED_STYLE_OPTIONS = [
  'رحلات فاخرة واسترخاء (VIP) ✨',
  'مغامرات ونشاطات حركية 🏄‍♂️',
  'ثقافية وتاريخية 🏛️',
  'طبيعة وتخييم ⛺',
] as const;

export const EXPERT_ROUTING_STYLE_OPTIONS = [
  'فاخر ومخصص (VIP) 💎',
  'استرخاء وهدوء (Slow Travel) ☕',
  'إيقاع سريع ومزدحم 🏃‍♂️',
  'توازن بين الراحة والنشاط ⚖️',
  'اقتصادي وعملي 🎒',
] as const;

export const EXPERT_ACTIVITY_STRENGTH_OPTIONS = [
  'حجوزات مطاعم حصرية (Michelin/VIP) 🍽️',
  'أماكن سرية وغير مطروقة (Hidden Gems) 🗺️',
  'تجارب ثقافية محلية 🏺',
  'تنسيق مواصلات دقيق 🚗',
  'أنشطة مغامرات 🧗',
] as const;

export function partnerDnaSharePath(type: PartnerDnaType, id: string): string {
  return `/partner-dna/${type}/${encodeURIComponent(id)}`;
}

export function partnerCrmProfilePath(type: PartnerDnaType, id: string): string {
  return `/crm/partners-directory/profile?id=${encodeURIComponent(id)}&type=${type}`;
}

export function partnerTypeLabel(type: PartnerDnaType): string {
  if (type === 'leaders') return 'قائد رحلات';
  if (type === 'experts') return 'خبير وجهات';
  return 'مشهور / مؤثر';
}
