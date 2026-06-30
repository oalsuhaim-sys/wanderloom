export const LEAD_SOURCE_VALUES = [
  'instagram_reel',
  'tiktok',
  'snapchat',
  'referral',
  'google',
  'other',
] as const;

export type LeadSource = (typeof LEAD_SOURCE_VALUES)[number];

export const LEAD_SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'instagram_reel', label: 'انستقرام - ريلز / بوست' },
  { value: 'tiktok', label: 'تيك توك' },
  { value: 'snapchat', label: 'سناب شات' },
  { value: 'referral', label: 'توصية من عميل سابق (VIP Referral)' },
  { value: 'google', label: 'بحث جوجل' },
  { value: 'other', label: 'أخرى' },
];

export const LEAD_SOURCE_SELECT_CLASS =
  'w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-800 transition-colors focus:border-[#cda04c] focus:outline-none focus:ring-1 focus:ring-[#cda04c]';

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
