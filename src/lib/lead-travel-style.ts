/**
 * Canonical lead.travel_style values after DB standardization.
 * Legacy strings (Group Trip Onboarding, Register Interest, …) normalize via helpers.
 */
export const LEAD_TRAVEL_STYLES = ['Group', 'Private'] as const;

export type LeadTravelStyle = (typeof LEAD_TRAVEL_STYLES)[number];

export function isLeadTravelStyle(raw: unknown): raw is LeadTravelStyle {
  return raw === 'Group' || raw === 'Private';
}

/** Normalize DB / legacy values → Group | Private | null */
export function normalizeLeadTravelStyle(raw: unknown): LeadTravelStyle | null {
  if (isLeadTravelStyle(raw)) return raw;
  const s = String(raw ?? '')
    .trim()
    .normalize('NFKC');
  if (!s) return null;

  if (
    s === 'Group' ||
    /^group(\s+trip)?(\s+onboarding)?$/i.test(s) ||
    /جماع|قروب|group/i.test(s)
  ) {
    return 'Group';
  }

  if (
    s === 'Private' ||
    /private|vip|فرد|خاص|register\s*interest|session\s*registration|trip\s*log/i.test(s)
  ) {
    return 'Private';
  }

  return null;
}

export function isGroupTravelStyle(raw: unknown): boolean {
  return normalizeLeadTravelStyle(raw) === 'Group';
}

export function isPrivateTravelStyle(raw: unknown): boolean {
  return normalizeLeadTravelStyle(raw) === 'Private';
}
