/** Wanderloom luxury gold — explicit hex (never default Tailwind orange). */
export const BRAND_GOLD = {
  DEFAULT: '#C5A059',
  HOVER: '#B38E46',
  BG: '#C5A059',
  ACCENT: '#D4AF37',
  LIGHT: '#FDFBF7',
  LIGHT_SOFT: '#F7F0E1',
  LIGHT_BORDER: '#E8D2A7',
  MUTED_BG: '#FDFBF7',
  TEXT: '#8C6D23',
  TEXT_DARK: '#4A3910',
  BORDER: '#E8D2A7',
  ON_GOLD: '#0F172A',
  BADGE_TEXT: '#8C6D23',
} as const;

/** Deep olive green — headings and primary text hierarchy. */
export const BRAND_OLIVE = {
  HEADING: '#1c382b',
  LABEL: '#234737',
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
