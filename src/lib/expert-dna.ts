export type ExpertDnaProfile = {
  /** أسلوب ترتيب المسارات */
  routingStyle: string;
  /** المميزات التنافسية */
  uniqueAdvantages: string;
  /** التوافق مع احتياج الشركة */
  companyAlignment: string;
  /** ملاحظات إضافية */
  notes: string;
  /** آخر تحديث من النموذج العام */
  submittedAt: string | null;
};

export const EMPTY_EXPERT_DNA: ExpertDnaProfile = {
  routingStyle: '',
  uniqueAdvantages: '',
  companyAlignment: '',
  notes: '',
  submittedAt: null,
};

export const EXPERT_ROUTING_STYLE_OPTIONS = [
  'Relaxed Luxury — فخامة هادئة',
  'Fast-paced — إيقاع سريع',
  'Cultural Immersion — انغماس ثقافي',
  'Adventure Soft — مغامرة ناعمة',
  'Family-first — عائلي أولاً',
  'Food & Lifestyle — طعام ولايف ستايل',
  'Mixed / Adaptive — مرن حسب العميل',
] as const;

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

export function parseExpertDnaProfile(raw: unknown): ExpertDnaProfile {
  const obj = asRecord(raw);
  return {
    routingStyle: pickText(obj, [
      'routingStyle',
      'routing_style',
      'itinerary_style',
      'tripStyle',
      'trip_style',
      'working_style',
    ]),
    uniqueAdvantages: pickText(obj, [
      'uniqueAdvantages',
      'unique_advantages',
      'advantages',
      'competitiveAdvantage',
      'competitive_advantage',
    ]),
    companyAlignment: pickText(obj, [
      'companyAlignment',
      'company_alignment',
      'company_needs',
      'agencyRequirements',
      'agency_requirements',
    ]),
    notes: pickText(obj, ['notes', 'extra_notes', 'strengths', 'excellence_areas']),
    submittedAt: pickText(obj, ['submittedAt', 'submitted_at']) || null,
  };
}

export function serializeExpertDnaProfile(
  dna: Partial<ExpertDnaProfile>,
  options?: { markSubmitted?: boolean },
): Record<string, unknown> {
  const base = parseExpertDnaProfile(dna);
  return {
    routing_style: base.routingStyle.trim(),
    unique_advantages: base.uniqueAdvantages.trim(),
    company_alignment: base.companyAlignment.trim(),
    notes: base.notes.trim(),
    submitted_at: options?.markSubmitted
      ? new Date().toISOString()
      : base.submittedAt,
  };
}

export function expertDnaSharePath(expertId: string): string {
  return `/partner-dna/experts/${encodeURIComponent(expertId)}`;
}

export function expertCrmProfilePath(expertId: string): string {
  return `/crm/partners-directory/profile?id=${encodeURIComponent(expertId)}&type=experts`;
}
