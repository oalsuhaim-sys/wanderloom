import type { SeasonKey } from '@/lib/destination-advisor-data';

export type PosterSeasonTheme = {
  name: string;
  emoji: string;
  badgeBg: string;
  overlayGradient: string;
  accentText: string;
  borderGlow: string;
  /** Season pill accent (header bar) */
  headerPill: string;
  /** Subtle gradient tint for bottom white panel */
  bottomTint: string;
  /** Soft watermark opacity layer (icon uses `emoji`) */
  watermarkBgTint: string;
  /** Watermark leaf accent color class */
  watermarkAccent: string;
  /** Warm glassmorphism panel for editorial bottom card */
  glassBg: string;
  /** Floating leaf / icon tint */
  leafAccent: string;
  priceAccent: string;
  includesCheck: string;
};

export const SEASON_THEMES: Record<SeasonKey, PosterSeasonTheme> = {
  autumn: {
    name: 'الخريف',
    emoji: '🍁',
    badgeBg: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
    overlayGradient: 'from-amber-950/90 via-orange-950/60 to-transparent',
    accentText: 'text-amber-400',
    borderGlow: 'border-amber-500/30',
    headerPill: 'text-amber-300 border-amber-500/30',
    bottomTint: 'from-amber-50/30 via-white to-white',
    watermarkBgTint: 'from-amber-100/40 via-white to-amber-50/20',
    watermarkAccent: 'text-amber-600/80',
    glassBg:
      'bg-gradient-to-br from-amber-50/95 via-orange-50/90 to-amber-100/80 backdrop-blur-lg border-amber-200/60',
    leafAccent: 'text-amber-600/25',
    priceAccent: 'text-[#d97706]',
    includesCheck: 'text-emerald-700',
  },
  winter: {
    name: 'الشتاء',
    emoji: '❄️',
    badgeBg: 'bg-sky-500/20 text-sky-200 border-sky-500/40',
    overlayGradient: 'from-slate-950/90 via-sky-950/60 to-transparent',
    accentText: 'text-sky-300',
    borderGlow: 'border-sky-500/30',
    headerPill: 'text-sky-300 border-sky-500/30',
    bottomTint: 'from-sky-50/30 via-white to-white',
    watermarkBgTint: 'from-sky-100/40 via-white to-blue-50/20',
    watermarkAccent: 'text-sky-500/80',
    glassBg:
      'bg-gradient-to-br from-sky-50/95 via-blue-50/90 to-slate-100/80 backdrop-blur-lg border-sky-200/60',
    leafAccent: 'text-sky-500/25',
    priceAccent: 'text-sky-800',
    includesCheck: 'text-sky-700',
  },
  spring: {
    name: 'الربيع',
    emoji: '🌸',
    badgeBg: 'bg-rose-500/20 text-rose-200 border-rose-500/40',
    overlayGradient: 'from-rose-950/90 via-pink-950/60 to-transparent',
    accentText: 'text-pink-300',
    borderGlow: 'border-rose-500/30',
    headerPill: 'text-rose-300 border-rose-500/30',
    bottomTint: 'from-rose-50/30 via-white to-white',
    watermarkBgTint: 'from-rose-100/40 via-white to-pink-50/20',
    watermarkAccent: 'text-pink-500/80',
    glassBg:
      'bg-gradient-to-br from-rose-50/95 via-pink-50/90 to-stone-100/80 backdrop-blur-lg border-rose-200/60',
    leafAccent: 'text-rose-500/25',
    priceAccent: 'text-rose-700',
    includesCheck: 'text-emerald-700',
  },
  summer: {
    name: 'الصيف',
    emoji: '☀️',
    badgeBg: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/40',
    overlayGradient: 'from-blue-950/90 via-cyan-950/60 to-transparent',
    accentText: 'text-yellow-400',
    borderGlow: 'border-yellow-500/30',
    headerPill: 'text-yellow-300 border-yellow-500/30',
    bottomTint: 'from-cyan-50/30 via-white to-white',
    watermarkBgTint: 'from-yellow-100/40 via-white to-orange-50/20',
    watermarkAccent: 'text-amber-500/80',
    glassBg:
      'bg-gradient-to-br from-yellow-50/95 via-amber-50/90 to-orange-100/80 backdrop-blur-lg border-yellow-200/60',
    leafAccent: 'text-amber-500/25',
    priceAccent: 'text-amber-800',
    includesCheck: 'text-emerald-700',
  },
};

export type SeasonWatermarkConfig = {
  icon: string;
  accentColor: string;
  bgGradient: string;
};

export const SEASON_WATERMARKS: Record<SeasonKey, SeasonWatermarkConfig> = (
  ['autumn', 'winter', 'spring', 'summer'] as SeasonKey[]
).reduce(
  (acc, key) => {
    acc[key] = {
      icon: SEASON_THEMES[key].emoji,
      accentColor: SEASON_THEMES[key].watermarkAccent,
      bgGradient: SEASON_THEMES[key].watermarkBgTint,
    };
    return acc;
  },
  {} as Record<SeasonKey, SeasonWatermarkConfig>,
);

export const POSTER_SEASON_OPTIONS: Array<{ value: SeasonKey; label: string }> = (
  ['autumn', 'winter', 'spring', 'summer'] as SeasonKey[]
).map((key) => ({
  value: key,
  label: `${SEASON_THEMES[key].emoji} ${SEASON_THEMES[key].name}`,
}));

/** Infer season from a JS Date month (0-indexed). Defaults to autumn. */
export function inferSeasonFromMonth(month: number | null | undefined): SeasonKey {
  if (month == null || month < 0 || month > 11) return 'autumn';
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

/** Infer season from yyyy-mm-dd trip start date. */
export function inferSeasonFromDateInput(value: string | null | undefined): SeasonKey {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return 'autumn';
  const [, monthStr] = trimmed.split('-');
  const month = Number(monthStr);
  if (!Number.isFinite(month) || month < 1 || month > 12) return 'autumn';
  return inferSeasonFromMonth(month - 1);
}

export function resolvePosterSeason(
  explicit: SeasonKey | null | undefined,
  tripStartDate?: string | null,
): SeasonKey {
  if (explicit && explicit in SEASON_THEMES) return explicit;
  return inferSeasonFromDateInput(tripStartDate);
}
