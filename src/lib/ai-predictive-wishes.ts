import { parseDnaInterests, parseTravelDnaForm } from '@/lib/clientsTravelDna';

export const PREDICTIVE_WISH_SIGNATURE_AR =
  'بناءً على الطقس المتوقع يوم 15 أكتوبر، نقترح تعديل مسار العميل ليزور مقهى الهانوك الساعة 4:15 مساءً بدلاً من الصباح، لأن زاوية سقوط الشمس على الحديقة ستكون مثالية للتأمل والقهوة المقطرة.';

export type PredictiveWishContext = {
  clientRow?: Record<string, unknown> | null;
  interests?: string[];
  destination?: string;
  tripDateFrom?: string;
  tripDateTo?: string;
  activeDayLabel?: string;
};

export type PredictiveWishAdjustment = {
  placeName: string;
  category: string;
  city: string;
  suggestedTime: string;
  poeticNote: string;
};

export type PredictiveWishSuggestion = {
  bodyAr: string;
  contextLine: string;
  dnaEcho: string;
  weatherNote: string;
  goldenHourNote: string;
  seasonNote: string;
  adjustment: PredictiveWishAdjustment;
};

export type AiItinerarySuggestion = {
  title: string;
  time: string;
  ai_reasoning: string;
  type: 'cafe' | 'nature' | 'culture' | 'action';
};

function pickText(raw: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!raw) return '';
  for (const k of keys) {
    const v = raw[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function monthFromIso(date: string): number | null {
  const m = /^(\d{4})-(\d{2})/.exec(date.trim());
  if (!m) return null;
  const month = Number(m[2]);
  return Number.isFinite(month) ? month : null;
}

function formatArabicMonthDay(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date.trim());
  if (!m) return '';
  const months = [
    '',
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
  ];
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!months[month]) return '';
  return `${day} ${months[month]}`;
}

export function arabicMonthNameFromIso(date: string): string {
  const month = monthFromIso(date);
  const names = [
    '',
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
  ];
  if (!month || !names[month]) return 'موسم السفر';
  return names[month];
}

function inferSeason(month: number | null): string {
  if (!month) return 'موسم السفر';
  if (month >= 3 && month <= 5) return 'ربيع هادئ';
  if (month >= 6 && month <= 8) return 'صيف دافئ';
  if (month >= 9 && month <= 11) return 'خريف ذهبي';
  return 'شتاء أنيق';
}

function readsQuietCoffeeDna(client: Record<string, unknown> | null | undefined): string {
  const dna = parseTravelDnaForm(client?.travel_dna);
  const drink = pickText(client ?? {}, ['favorite_drink']) || dna.drink_coffee;
  const activity = pickText(client ?? {}, ['dna_activity_level']);
  const hotel = dna.hotel_style;

  const bits: string[] = [];
  if (activity.includes('استرخاء') || hotel.includes('هاد') || /quiet|calm/i.test(activity)) {
    bits.push('يحب الهدوء');
  }
  if (/قهوة|coffee|drip|مقطرة|لاتيه|اسبريسو/i.test(drink)) {
    bits.push('القهوة المقطرة');
  } else if (drink) {
    bits.push(drink);
  }

  const interests = [...parseDnaInterests(pickText(client ?? {}, ['dna_interests']))];
  if (interests.some((i) => /فن|ثقافة|طبيعة/i.test(i))) {
    bits.push('لحظات تأملية');
  }

  return bits.length ? bits.join(' · ') : 'ذوق راقٍ · لحظات هادئة';
}

function resolveTripCity(destination: string): string {
  const d = destination.trim();
  if (!d) return 'سيول';
  if (/سيول|seoul/i.test(d)) return 'سيول';
  const first = d.split(/[،,|/]/)[0]?.trim();
  return first || d;
}

function resolveTripDateLabel(ctx: PredictiveWishContext): string {
  const from = ctx.tripDateFrom?.trim() ?? '';
  const label = formatArabicMonthDay(from);
  if (label) return label;
  return '15 أكتوبر';
}

/** DNA مضغوط لإرساله إلى OpenAI */
export function buildClientDnaForAi(ctx: PredictiveWishContext): Record<string, unknown> {
  const client = ctx.clientRow ?? {};
  const dna = parseTravelDnaForm(client.travel_dna);
  const interests = [
    ...parseDnaInterests(pickText(client, ['dna_interests'])),
    ...(ctx.interests ?? []),
  ].filter(Boolean);

  return {
    name: pickText(client, ['name', 'full_name']) || 'ضيف Wanderloom',
    interests: [...new Set(interests)].slice(0, 12),
    activity_level: pickText(client, ['dna_activity_level']),
    special_requests: pickText(client, ['dna_special_requests', 'secret_notes']) || dna.secret_notes,
    hotel_preference: pickText(client, ['hotel_preference']) || dna.hotel_style,
    favorite_drink: pickText(client, ['favorite_drink']) || dna.drink_coffee,
    food_allergies: pickText(client, ['food_allergies', 'dietary']) || dna.food_allergies,
    flight_seat: pickText(client, ['flight_seat']) || dna.preferred_seat,
    client_tier: pickText(client, ['client_tier', 'vip_tier']),
  };
}

export function aiActivityTypeLabelAr(type: AiItinerarySuggestion['type']): string {
  if (type === 'cafe') return 'مقهى';
  if (type === 'nature') return 'طبيعة';
  if (type === 'action') return 'نشاط';
  return 'ثقافة';
}

export function aiSuggestionToPlacePayload(
  suggestion: AiItinerarySuggestion,
  destination?: string,
): Record<string, unknown> {
  const city = resolveTripCity(destination ?? '');
  return {
    name: `${suggestion.title}${suggestion.time ? ` (${suggestion.time})` : ''}`,
    category: aiActivityTypeLabelAr(suggestion.type),
    city,
    suggested_time: suggestion.time,
    ai_reasoning: suggestion.ai_reasoning,
    predictive_wish: true,
    ai_generated: true,
    poetic_note: suggestion.ai_reasoning,
    _dragId: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

export function buildPredictiveWishSuggestion(ctx: PredictiveWishContext): PredictiveWishSuggestion {
  const destination = ctx.destination?.trim() || 'سيول، كوريا';
  const city = resolveTripCity(destination);
  const dateLabel = resolveTripDateLabel(ctx);
  const month = monthFromIso(ctx.tripDateFrom ?? '') ?? 10;
  const season = inferSeason(month);
  const dnaEcho = readsQuietCoffeeDna(ctx.clientRow);

  const weatherNote =
    month >= 9 && month <= 11
      ? 'طقس معتدل · سماء صافية · رطوبة منخفضة'
      : 'أجواء لطيفة · ضوء ناعم · نسيم خفيف';

  const goldenHourNote = 'ساعة الذهب ≈ 4:15 مساءً — زاوية شمس مثالية على الحديقة';

  const contextLine = [city, dateLabel, season, ctx.activeDayLabel].filter(Boolean).join(' · ');

  const adjustment: PredictiveWishAdjustment = {
    placeName: `مقهى الهانوك — ${dateLabel}`,
    category: 'مقهى',
    city,
    suggestedTime: '16:15',
    poeticNote: PREDICTIVE_WISH_SIGNATURE_AR,
  };

  return {
    bodyAr: PREDICTIVE_WISH_SIGNATURE_AR,
    contextLine,
    dnaEcho,
    weatherNote,
    goldenHourNote,
    seasonNote: season,
    adjustment,
  };
}

export function predictiveWishToPlacePayload(
  suggestion: PredictiveWishSuggestion,
): Record<string, unknown> {
  const { adjustment } = suggestion;
  return {
    name: `${adjustment.placeName} (${adjustment.suggestedTime})`,
    category: adjustment.category,
    city: adjustment.city,
    suggested_time: adjustment.suggestedTime,
    predictive_wish: true,
    poetic_note: adjustment.poeticNote,
    _dragId: `predictive-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}
