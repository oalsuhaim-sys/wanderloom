export const LEAD_SOURCE_VALUES = [
  'instagram_reel',
  'website',
  'tiktok',
  'snapchat',
  'referral',
  'google',
  'other',
] as const;

export type LeadSource = (typeof LEAD_SOURCE_VALUES)[number];

export const LEAD_SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'instagram_reel', label: 'انستغرام' },
  { value: 'website', label: 'الموقع الإلكتروني' },
  { value: 'referral', label: 'توصية من عميل' },
  { value: 'tiktok', label: 'تيك توك' },
  { value: 'snapchat', label: 'سناب شات' },
  { value: 'google', label: 'بحث جوجل' },
  { value: 'other', label: 'أخرى' },
];

export const LEAD_SOURCE_SELECT_CLASS =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-100 dark:focus:ring-[#D4AF37]';

export function leadSourceLabel(value: string | null | undefined): string {
  if (!value) return '—';
  const match = LEAD_SOURCE_OPTIONS.find((o) => o.value === value);
  return match?.label ?? value;
}

export function normalizeLeadSource(raw: unknown): LeadSource | '' {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  return LEAD_SOURCE_VALUES.includes(s as LeadSource) ? (s as LeadSource) : '';
}

/**
 * Map public trip-form `source` select values → `leads.lead_source`.
 * Accepts both legacy short codes (instagram, snap, friend) and canonical values.
 */
export function mapTripFormSourceToLeadSource(raw: unknown): LeadSource | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!s) return null;

  const aliases: Record<string, LeadSource> = {
    instagram: 'instagram_reel',
    instagram_reel: 'instagram_reel',
    ig: 'instagram_reel',
    tiktok: 'tiktok',
    snap: 'snapchat',
    snapchat: 'snapchat',
    friend: 'referral',
    referral: 'referral',
    google: 'google',
    website: 'website',
    event: 'other',
    other: 'other',
    session_registration: 'other',
    register_interest: 'website',
  };

  if (aliases[s]) return aliases[s];
  return LEAD_SOURCE_VALUES.includes(s as LeadSource) ? (s as LeadSource) : null;
}
