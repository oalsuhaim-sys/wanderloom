import type { DayWeatherApiPayload } from '@/app/api/weather/route';
import { parseTravelDnaForm } from '@/lib/clientsTravelDna';

/** تقدير مدة النشاط من نص transit_duration (عربي/إنجليزي) */
export function parseTransitDurationHours(text: string): number {
  const raw = text.trim().toLowerCase();
  if (!raw) return 0;

  const hourMatch =
    raw.match(/(\d+(?:[.,]\d+)?)\s*(?:ساعة|ساعات|hour|hours|hr|h)\b/) ??
    raw.match(/(\d+(?:[.,]\d+)?)\s*h\b/);
  if (hourMatch) {
    const n = Number(hourMatch[1].replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  const minMatch =
    raw.match(/(\d+(?:[.,]\d+)?)\s*(?:دقيقة|دقائق|min|mins|minute|minutes|m)\b/) ??
    raw.match(/(\d+(?:[.,]\d+)?)\s*m\b/);
  if (minMatch) {
    const n = Number(minMatch[1].replace(',', '.'));
    return Number.isFinite(n) ? n / 60 : 0;
  }

  const bare = Number(raw.replace(',', '.'));
  if (Number.isFinite(bare) && bare > 0) {
    return bare <= 12 ? bare : bare / 60;
  }

  return 0;
}

export type DayPacingInput = {
  transit_duration?: string;
  kind?: string;
};

const DEFAULT_VISIT_HOURS = 2;
const TRANSPORT_VISIT_HOURS = 0.25;
export const PACING_WARN_THRESHOLD_HOURS = 8;

/** إجمالي ساعات اليوم: زيارة لكل محطة + انتقالات */
export function estimateDayActivityHours(activities: DayPacingInput[]): number {
  const stops = activities.filter((a) => a.kind !== 'transport');
  if (stops.length === 0) return 0;

  let total = 0;
  activities.forEach((act, index) => {
    if (act.kind === 'transport') {
      total += TRANSPORT_VISIT_HOURS;
      return;
    }
    if (index > 0) {
      total += parseTransitDurationHours(act.transit_duration ?? '');
    }
    total += DEFAULT_VISIT_HOURS;
  });

  return Math.round(total * 10) / 10;
}

export function isDayPacingStrenuous(
  totalHours: number,
  maxHours: number = PACING_WARN_THRESHOLD_HOURS,
): boolean {
  return totalHours > maxHours;
}

export type ClientProfilePrefs = {
  type: 'عائلة' | 'شباب' | 'رياضي';
  wakeUpTime: string;
  activityLevel: 'خفيف' | 'متوسط' | 'عالي';
};

/** سقف ساعات اليوم حسب نوع العميل */
export function getMaxHoursForClientType(type: ClientProfilePrefs['type']): number {
  if (type === 'عائلة') return 5;
  if (type === 'شباب') return 8;
  return 10;
}

export function compassBadgesFromPrefs(prefs: ClientProfilePrefs): string[] {
  return [
    `👥 ${prefs.type}`,
    `⏰ استيقاظ مفضل: ${prefs.wakeUpTime}`,
    `⚡ نشاط: ${prefs.activityLevel}`,
  ];
}

function parseTimeToMinutes(time: string): number | null {
  const m = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** هل يبدأ النشاط الأول قبل وقت الاستيقاظ المفضل؟ */
export function isActivityBeforeClientWakeUp(
  activityStartTime: string,
  wakeUpTime: string,
): boolean {
  const start = parseTimeToMinutes(activityStartTime);
  const wake = parseTimeToMinutes(wakeUpTime);
  if (start == null || wake == null) return false;
  return start < wake;
}

export type SupabaseClientCompassRow = {
  id?: number | string;
  name?: string | null;
  dietary?: string | null;
  dietary_preferences?: string | null;
  secret_notes?: string | null;
  activity_level?: string | null;
  travel_dna?: unknown;
  flight_preferences?: string | null;
  hotel_preferences?: string | null;
};

const WAKE_UP_OPTIONS = ['07:00', '09:00', '10:00', '11:00'] as const;

function snapWakeUpTime(raw: string): ClientProfilePrefs['wakeUpTime'] {
  const m = raw.trim().match(/(\d{1,2}):(\d{2})/);
  if (!m) return '09:00';
  const candidate = `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
  if ((WAKE_UP_OPTIONS as readonly string[]).includes(candidate)) {
    return candidate as ClientProfilePrefs['wakeUpTime'];
  }
  const hour = Number(m[1]);
  if (hour < 8) return '07:00';
  if (hour < 10) return '09:00';
  if (hour < 11) return '10:00';
  return '11:00';
}

function normalizeActivityLevel(raw: string): ClientProfilePrefs['activityLevel'] {
  const s = raw.trim().toLowerCase();
  if (s.includes('خفيف') || s.includes('low') || s.includes('light')) return 'خفيف';
  if (s.includes('عالي') || s.includes('high') || s.includes('intense')) return 'عالي';
  if (s.includes('متوسط') || s.includes('medium') || s.includes('moderate')) return 'متوسط';
  return 'متوسط';
}

function normalizeClientType(raw: string): ClientProfilePrefs['type'] {
  const s = raw.trim().toLowerCase();
  if (s.includes('رياض') || s.includes('athlete') || s.includes('sport')) return 'رياضي';
  if (s.includes('شباب') || s.includes('youth') || s.includes('young')) return 'شباب';
  if (s.includes('عائ') || s.includes('family') || s.includes('kids')) return 'عائلة';
  return 'شباب';
}

function inferClientTypeFromText(text: string): ClientProfilePrefs['type'] | null {
  if (!text.trim()) return null;
  const s = text.trim().toLowerCase();
  if (s.includes('رياض') || s.includes('athlete') || s.includes('sport')) return 'رياضي';
  if (s.includes('شباب') || s.includes('youth')) return 'شباب';
  if (s.includes('عائ') || s.includes('family') || s.includes('kids')) return 'عائلة';
  return null;
}

/** تحويل صف العميل من Supabase إلى تفضيلات البوصلة والشارات */
export function mapSupabaseClientToProfilePrefs(row: SupabaseClientCompassRow): ClientProfilePrefs {
  const dna = parseTravelDnaForm(row.travel_dna);
  const dnaObj =
    row.travel_dna && typeof row.travel_dna === 'object' && !Array.isArray(row.travel_dna)
      ? (row.travel_dna as Record<string, unknown>)
      : {};

  const combined = [
    row.secret_notes,
    row.dietary,
    row.dietary_preferences,
    dna.secret_notes,
    dna.food_allergies,
  ]
    .filter(Boolean)
    .join(' ');

  const typeRaw = String(
    dnaObj.client_type ?? dnaObj.group_type ?? dnaObj.traveler_type ?? '',
  );
  const wakeRaw = String(dnaObj.wake_up_time ?? dnaObj.wakeUpTime ?? dnaObj.preferred_wake ?? '');
  const activityRaw = String(
    row.activity_level ?? dnaObj.activity_level ?? dnaObj.activityLevel ?? dnaObj.pacing ?? '',
  );

  const inferredType = inferClientTypeFromText(typeRaw || combined);
  const inferredActivity = activityRaw
    ? normalizeActivityLevel(activityRaw)
    : normalizeActivityLevel(combined);

  return {
    type: inferredType ?? normalizeClientType(typeRaw || 'شباب'),
    wakeUpTime: wakeRaw ? snapWakeUpTime(wakeRaw) : snapWakeUpTime(combined),
    activityLevel: inferredActivity,
  };
}

export function extraCompassBadgesFromClient(row: SupabaseClientCompassRow): string[] {
  const badges: string[] = [];
  const dietary = (row.dietary ?? row.dietary_preferences ?? '').trim();
  if (dietary) badges.push(`🥦 ${dietary}`);

  const activity = (row.activity_level ?? '').trim();
  if (activity) badges.push(`⚡ ${activity}`);

  const flight = row.flight_preferences?.trim();
  if (flight) badges.push(`✈️ ${flight}`);

  const hotel = row.hotel_preferences?.trim();
  if (hotel) badges.push(`🏨 ${hotel}`);

  const secret = row.secret_notes?.trim();
  if (secret) {
    badges.push(`🔒 ${secret.length > 52 ? `${secret.slice(0, 49)}…` : secret}`);
  }

  const dna = parseTravelDnaForm(row.travel_dna);
  if (dna.drink_coffee.trim()) badges.push(`☕ ${dna.drink_coffee.trim()}`);
  if (dna.hotel_style.trim() && !hotel) badges.push(`🏨 ${dna.hotel_style.trim()}`);

  return badges;
}

/** طقس حي عبر مسار API الداخلي (OpenWeatherMap عند توفر المفتاح) */
export async function fetchDestinationWeather(
  city: string,
  _date?: string,
): Promise<DayWeatherApiPayload | null> {
  const q = city.trim();
  if (!q) return null;

  try {
    const res = await fetch(`/api/weather?city=${encodeURIComponent(q)}`);
    if (!res.ok) return null;
    return (await res.json()) as DayWeatherApiPayload;
  } catch {
    return null;
  }
}

export function formatWeatherBadgeLabel(payload: DayWeatherApiPayload): string {
  const emoji =
    payload.icon === 'rain'
      ? '🌧️'
      : payload.icon === 'clear'
        ? '☀️'
        : payload.icon === 'snow'
          ? '❄️'
          : payload.icon === 'storm'
            ? '⛈️'
            : '🌤️';
  return `${emoji} ${payload.city}: ${payload.temp}°م ${payload.condition}`;
}

/** نص طقس تجريبي حسب المدينة — placeholder حتى ربط API */
export function mockDayWeatherLabel(city: string, dayIndex = 0): string {
  const c = city.trim() || 'الوجهة';
  const samples = [
    { temp: 22, desc: 'مشمس' },
    { temp: 18, desc: 'غائم جزئياً' },
    { temp: 26, desc: 'حار معتدل' },
    { temp: 14, desc: 'ماطر خفيف' },
  ];
  const pick = samples[dayIndex % samples.length]!;
  return `🌤️ ${c}: ${pick.temp}°م ${pick.desc}`;
}

export const MOCK_VIP_PREFERENCE_BADGES = [
  '🥦 نباتي',
  '🌙 يفضل الأنشطة المسائية',
  '♿ يحتاج كرسي متحرك',
] as const;
