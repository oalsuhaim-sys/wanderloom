export type PartnerKind = 'leader' | 'expert' | 'celebrity';

export type PartnerApplicationStatus = 'pending' | 'approved' | 'rejected';

export type PartnerApplication = {
  id: number | string;
  partner_kind: PartnerKind;
  name: string;
  email: string | null;
  phone: string | null;
  languages: string | null;
  experience_years: number | null;
  preferred_destinations: string | null;
  platforms: string | null;
  follower_count: number | null;
  bio: string | null;
  status: PartnerApplicationStatus;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export const PARTNER_KIND_LABELS: Record<PartnerKind, string> = {
  leader: 'ليدر',
  expert: 'خبير وجهة',
  celebrity: 'مشهور / مؤثر',
};

export const PARTNER_KIND_EMOJI: Record<PartnerKind, string> = {
  leader: '🚀',
  expert: '🧭',
  celebrity: '🌟',
};

/** أنواع الشراكة المفتوحة عبر النموذج العام (بدون مؤثرين — يُضافون يدوياً من CRM) */
export const PUBLIC_PARTNER_KINDS: PartnerKind[] = ['leader', 'expert'];

export const PUBLIC_PARTNER_KIND_LABELS: Record<'leader' | 'expert', string> = {
  leader: 'قائد رحلات 🚀',
  expert: 'خبير وجهات 🧭',
};

export function normalizePartnerKind(raw: unknown): PartnerKind | null {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'leader' || value === 'ليدر') return 'leader';
  if (value === 'expert' || value === 'خبير') return 'expert';
  if (value === 'celebrity' || value === 'مشهور' || value === 'مؤثر') return 'celebrity';
  return null;
}

export function partnerKindLabel(kind: PartnerKind): string {
  return `${PARTNER_KIND_EMOJI[kind]} ${PARTNER_KIND_LABELS[kind]}`;
}
