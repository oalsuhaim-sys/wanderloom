/** Wanderloom official gold — explicit hex (never default Tailwind orange). */
export const BRAND_GOLD = {
  DEFAULT: '#9C7A3C',
  HOVER: '#826533',
  BG: '#9C7A3C',
  ACCENT: '#9C7A3C',
  LIGHT: '#F4EFE6',
  LIGHT_SOFT: '#EFE6D4',
  LIGHT_BORDER: '#E0D0A8',
  MUTED_BG: '#F4EFE6',
  TEXT: '#6A5329',
  TEXT_DARK: '#3A2E17',
  BORDER: '#E0D0A8',
  ON_GOLD: '#F4EFE6',
  BADGE_TEXT: '#6A5329',
} as const;

/** Dark emerald — headings and primary text hierarchy. */
export const BRAND_OLIVE = {
  HEADING: '#1C2E3A',
  LABEL: '#1C2E3A',
} as const;

export const BRAND_GOLD_BUTTON_CLASS =
  'font-extrabold shadow-sm transition-all hover:opacity-90';

export const BRAND_GOLD_CALLOUT_CLASS =
  'border text-xs font-semibold leading-relaxed';

export const BRAND_GOLD_TAG_CLASS = 'border text-xs font-extrabold';

export const BRAND_OLIVE_HEADING_CLASS = 'font-extrabold';
export const BRAND_OLIVE_LABEL_CLASS = 'font-extrabold';

export const brandGoldButtonStyle = {
  backgroundColor: BRAND_GOLD.DEFAULT,
  color: BRAND_GOLD.ON_GOLD,
} as const;

export const brandGoldBadgeStyle = {
  backgroundColor: BRAND_GOLD.MUTED_BG,
  borderColor: BRAND_GOLD.LIGHT_BORDER,
  color: BRAND_GOLD.BADGE_TEXT,
} as const;

export const brandGoldCalloutStyle = {
  backgroundColor: BRAND_GOLD.MUTED_BG,
  borderColor: BRAND_GOLD.LIGHT_BORDER,
  color: BRAND_GOLD.BADGE_TEXT,
} as const;

export const brandOliveHeadingStyle = {
  color: BRAND_OLIVE.HEADING,
} as const;

export const brandOliveLabelStyle = {
  color: BRAND_OLIVE.LABEL,
} as const;
