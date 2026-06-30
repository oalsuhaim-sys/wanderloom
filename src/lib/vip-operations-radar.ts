import {
  filterUpcomingAnniversaries,
  filterUpcomingBirthdays,
  formatBirthdayDisplayDate,
  type AnniversaryRadarClient,
  type BirthdayRadarClient,
} from '@/lib/birthday-radar';
import { buildClientInterestSuggestions } from '@/lib/client-interest-destinations';
import { parseTravelDnaForm } from '@/lib/clientsTravelDna';
import { parseDatesField } from '@/lib/itinerary-builder-model';
import {
  buildSupplierRequestWhatsAppMessage,
  collectActiveSupplierRequests,
  supplierRequestDisplayName,
  supplierRequestStatusLabel,
  supplierServiceTypeLabel,
} from '@/lib/supplier-requests';
import {
  buildSupplierContactUrl,
  normalizePreferredApp,
} from '@/lib/supplier-contact';
import {
  buildClientVipTierMap,
  resolveVipTierFromClientRow,
  type VipSpendingTier,
} from '@/lib/vip-spending-tier';
import { parseDaysDataFromRow, parsePreTripServices, type PreTripService } from '@/lib/public-itinerary';

export type RadarCardKind =
  | 'active_trip'
  | 'supplier_payment'
  | 'supplier_pending'
  | 'interest_suggestion'
  | 'hotel_dna'
  | 'medical_consult'
  | 'memory_vault'
  | 'anniversary'
  | 'birthday'
  | 'passport_expiry';

export type RadarActionCard = {
  id: string;
  kind: RadarCardKind;
  title: string;
  tagLabel: string;
  tagClassName: string;
  icon: string;
  clientName: string;
  /** شارة VIP التلقائية من إجمالي المصروف */
  clientVipTier?: VipSpendingTier;
  details: string[];
  urgency: number;
  /** نص جاهز للنسخ إلى الحافظة */
  copyText?: string;
  /** رابط اجتماع زوم / استشارة */
  zoomUrl?: string;
  /** رابط واتساب جاهز */
  whatsappUrl?: string;
  /** نص ثانوي لواتساب (مفاجأة فندق / بطاقة تهنئة) */
  secondaryWhatsappUrl?: string;
  secondaryWhatsappLabel?: string;
  tripTitle?: string;
  vaultLink?: string;
  /** نسبة تقدّم الرحلة النشطة (0–100) */
  progressPercent?: number;
  /** رابط إجراء داخلي (CRM) */
  actionUrl?: string;
  actionLabel?: string;
};

const MEDICAL_KEYWORDS =
  /طب|طبي|استشارة|zoom|زوم|كوري|عيادة|clinic|medical|consult|doctor|دكتور/i;
const ZOOM_URL = /zoom\.us|meet\.google|teams\.microsoft/i;

function parseLocalDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function todayNorm(referenceDate: Date): Date {
  const t = new Date(referenceDate);
  t.setHours(0, 0, 0, 0);
  return t;
}

function daysUntilDate(iso: string, today: Date): number | null {
  const target = parseLocalDate(iso);
  if (!target) return null;
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function daysSinceDate(iso: string, today: Date): number | null {
  const diff = daysUntilDate(iso, today);
  return diff == null ? null : -diff;
}

function tripDayCount(row: Record<string, unknown>): number {
  const { days } = parseDaysDataFromRow(row.days_data);
  return days.length > 0 ? days.length : 7;
}

export function resolveTripDateRange(row: Record<string, unknown>): { start: string; end: string } | null {
  const startFromCol =
    row.start_date != null && String(row.start_date).trim()
      ? String(row.start_date).slice(0, 10)
      : '';
  const endFromCol =
    row.end_date != null && String(row.end_date).trim() ? String(row.end_date).slice(0, 10) : '';

  if (startFromCol) {
    return {
      start: startFromCol,
      end:
        endFromCol ||
        (() => {
          const d = new Date(startFromCol);
          d.setDate(d.getDate() + Math.max(tripDayCount(row) - 1, 0));
          return d.toISOString().slice(0, 10);
        })(),
    };
  }

  const parsed = parseDatesField(row.dates);
  if (!parsed.from) return null;

  const end =
    parsed.to ||
    (() => {
      const d = new Date(parsed.from);
      d.setDate(d.getDate() + Math.max(tripDayCount(row) - 1, 0));
      return d.toISOString().slice(0, 10);
    })();

  return { start: parsed.from, end };
}

function resolveItineraryClientName(row: Record<string, unknown>): string {
  const rawClients = row.clients;
  const joined = Array.isArray(rawClients)
    ? (rawClients[0] as Record<string, unknown> | undefined)
    : (rawClients as Record<string, unknown> | null | undefined);
  const fromJoin = String(joined?.name ?? '').trim();
  if (fromJoin) return fromJoin;
  return String(row.customer_name ?? row.title ?? 'عميل').trim() || 'عميل';
}

function resolveJoinedClient(row: Record<string, unknown>): Record<string, unknown> | null {
  const rawClients = row.clients;
  if (Array.isArray(rawClients)) {
    const first = rawClients[0];
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null;
  }
  if (rawClients && typeof rawClients === 'object') {
    return rawClients as Record<string, unknown>;
  }
  return null;
}

function resolveItineraryClientVipTier(
  row: Record<string, unknown>,
  tierMap: Map<string, VipSpendingTier>,
): VipSpendingTier {
  const client = resolveJoinedClient(row);
  if (client) return resolveVipTierFromClientRow(client);
  const cid = row.client_id != null ? String(row.client_id) : '';
  if (cid && tierMap.has(cid)) return tierMap.get(cid)!;
  return 'gold';
}

function firstHotelName(row: Record<string, unknown>): string {
  const raw = row.hotel_details;
  let items: unknown[] = [];
  if (Array.isArray(raw)) items = raw;
  else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) items = parsed;
    } catch {
      /* ignore */
    }
  }
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const name = String((item as Record<string, unknown>).name ?? '').trim();
    if (name) return name;
  }
  return 'الفندق';
}

function extractDnaPrefs(client: Record<string, unknown> | null): {
  coffee: string;
  pillows: string;
} {
  const dna = parseTravelDnaForm(client?.travel_dna);
  const coffee = dna.drink_coffee.trim() || 'قهوة VIP المفضّلة';
  const pillows =
    String(client?.hotel_preferences ?? '').trim() ||
    dna.hotel_style.trim() ||
    'وسائد فاخرة';
  return { coffee, pillows };
}

function buildHotelRequestMessage(
  hotelName: string,
  clientName: string,
  coffee: string,
  pillows: string,
  daysUntil: number,
): string {
  const arrival =
    daysUntil === 1 ? 'بعد يوم واحد' : daysUntil === 2 ? 'بعد يومين' : `بعد ${daysUntil} أيام`;
  return `مرحباً فندق ${hotelName}، لدينا عميل VIP واصل ${arrival} باسم ${clientName}، يرجى تجهيز ${coffee} و${pillows} في غرفته عند الوصول.`;
}

function isMedicalService(service: PreTripService): boolean {
  const blob = `${service.title} ${service.note} ${service.phone}`.trim();
  if (MEDICAL_KEYWORDS.test(blob)) return true;
  return ZOOM_URL.test(service.location_url);
}

function isWithinNext48Hours(datetimeRaw: string, now: Date): boolean {
  if (!datetimeRaw.trim()) return false;
  const appt = new Date(datetimeRaw);
  if (Number.isNaN(appt.getTime())) return false;
  const diffMs = appt.getTime() - now.getTime();
  return diffMs >= 0 && diffMs <= 48 * 60 * 60 * 1000;
}

function formatAppointmentTime(datetimeRaw: string): string {
  const appt = new Date(datetimeRaw);
  if (Number.isNaN(appt.getTime())) return datetimeRaw;
  return appt.toLocaleString('ar-SA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function waUrl(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  const encoded = encodeURIComponent(text);
  if (digits.length >= 8) return `https://wa.me/${digits}?text=${encoded}`;
  return `https://wa.me/?text=${encoded}`;
}

function buildVaultLink(row: Record<string, unknown>, origin: string): string {
  const slug = String(row.magic_link_id ?? row.id ?? '').trim();
  const base = origin.replace(/\/$/, '');
  return `${base}/itinerary/${encodeURIComponent(slug)}`;
}

function todayIsoLocal(referenceDate: Date): string {
  return referenceDate.toLocaleDateString('en-CA');
}

function isActiveOnDate(range: { start: string; end: string }, todayIso: string): boolean {
  return range.start <= todayIso && todayIso <= range.end;
}

function calculateTripProgress(start: string, end: string, todayIso: string): number {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const todayMs = new Date(todayIso).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  const passed = todayMs - startMs;
  const total = endMs - startMs;
  return Math.min(Math.max((passed / total) * 100, 0), 100);
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    confirmed: 'مؤكّدة',
    active: 'نشطة',
    sent: 'مُرسلة',
    draft: 'مسودة',
    archived: 'مؤرشفة',
  };
  return map[status.toLowerCase()] ?? status;
}

function buildActiveTripCards(
  itineraries: Record<string, unknown>[],
  today: Date,
  tierMap: Map<string, VipSpendingTier>,
): RadarActionCard[] {
  const todayIso = todayIsoLocal(today);
  const cards: RadarActionCard[] = [];

  for (const row of itineraries) {
    const range = resolveTripDateRange(row);
    if (!range || !isActiveOnDate(range, todayIso)) continue;

    const clientName = resolveItineraryClientName(row);
    const client = resolveJoinedClient(row);
    const phone = String(client?.phone_wa ?? '').trim();
    const destination = String(row.destination ?? '').trim();
    const tripTitle = String(row.title ?? row.destination ?? 'رحلة نشطة').trim() || 'رحلة نشطة';
    const status = String(row.status ?? 'active').trim() || 'active';
    const progress = Math.round(calculateTripProgress(range.start, range.end, todayIso));

    const waText = `أهلاً أستاذ ${clientName}، نتمنى أن تكون رحلتك ممتعة! نحن معك على الرادار لأي مساعدة تحتاجها.`;

    const details = [
      destination ? `📍 ${destination}` : `✈️ ${tripTitle}`,
      `📅 ${range.start} → ${range.end}`,
      `📊 التقدّم: ${progress}%`,
      `🏷️ ${statusLabel(status)}`,
    ];

    cards.push({
      id: `active-${row.id}`,
      kind: 'active_trip',
      title: 'رحلة نشطة حالياً ✈️',
      tagLabel: 'مباشر',
      tagClassName: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      icon: '✈️',
      clientName,
      clientVipTier: resolveItineraryClientVipTier(row, tierMap),
      details,
      urgency: -1,
      progressPercent: progress,
      tripTitle,
      whatsappUrl: waUrl(phone, waText),
    });
  }

  return cards;
}

function buildInterestSuggestionCards(
  clients: Record<string, unknown>[],
  preferences: Array<{ client_id: string | number; interests?: unknown }>,
  tierMap: Map<string, VipSpendingTier>,
): RadarActionCard[] {
  const suggestions = buildClientInterestSuggestions({ clients, preferences });

  return suggestions.map((s) => ({
    id: `interest-${s.clientId}-${s.category}`,
    kind: 'interest_suggestion' as const,
    title: `اقتراح ذكي · ${s.categoryLabel}`,
    tagLabel: 'اهتمامات',
    tagClassName: 'border-indigo-200 bg-indigo-50 text-indigo-900',
    icon: '💡',
    clientName: s.clientName,
    clientVipTier: tierMap.get(String(s.clientId)) ?? 'gold',
    details: [
      `اقترح لـ ${s.clientName} رحلة إلى ${s.cityListAr}`,
      `🏷️ اهتمام: ${s.categoryLabel}`,
    ],
    urgency: 5,
    actionUrl: `/crm/clients/${s.clientId}`,
    actionLabel: 'فتح ملف العميل',
  }));
}

function buildSupplierRequestCards(
  itineraries: Record<string, unknown>[],
  tierMap: Map<string, VipSpendingTier>,
): RadarActionCard[] {
  const cards: RadarActionCard[] = [];

  for (const row of itineraries) {
    if (row.is_template === true) continue;

    const clientName = resolveItineraryClientName(row);
    const tripTitle = String(row.title ?? row.destination ?? 'رحلة VIP').trim() || 'رحلة VIP';
    const tripDates = parseDatesField(row.dates);
    const dateLabel =
      tripDates.from && tripDates.to
        ? `${tripDates.from} → ${tripDates.to}`
        : tripDates.from || tripDates.to || '';

    for (const request of collectActiveSupplierRequests(row)) {
      if (request.status === 'paid' || request.status === 'cancelled') continue;

      if (request.status === 'pending_reply') {
        const supplierName = supplierRequestDisplayName(request);
        cards.push({
          id: `supplier-pending-${row.id}-${request.id}`,
          kind: 'supplier_pending',
          title: 'متابعة رد المورد ⏳',
          tagLabel: 'بانتظار الرد',
          tagClassName: 'border-amber-300 bg-amber-50 text-amber-900',
          icon: '🟡',
          clientName,
          clientVipTier: resolveItineraryClientVipTier(row, tierMap),
          details: [
            `🏢 المورد: ${supplierName}`,
            `📌 نوع الخدمة: ${supplierServiceTypeLabel(request.service_type)}`,
            `📅 التاريخ: ${request.service_date || '—'}`,
            request.details ? `📋 ${request.details}` : null,
            `✈️ ${tripTitle}`,
          ].filter((line): line is string => Boolean(line)),
          urgency: 2,
          whatsappUrl: buildSupplierContactUrl({
            app: normalizePreferredApp(request.preferred_app),
            phone: request.supplierPhone,
            message: buildSupplierRequestWhatsAppMessage(request, {
              clientName,
              destination: tripTitle,
              tripDates: dateLabel,
            }),
          }),
          actionUrl: `/crm/itineraries/${row.id}/edit`,
          actionLabel: 'تحديث الحالة',
        });
        continue;
      }

      if (request.status === 'confirmed_unpaid') {
        const supplierName = supplierRequestDisplayName(request);
        cards.push({
          id: `supplier-pay-${row.id}-${request.id}`,
          kind: 'supplier_payment',
          title: `دفعة مستحقة للمورد: ${supplierName}`,
          tagLabel: 'دفعة معلقة',
          tagClassName: 'border-red-300 bg-red-50 text-red-900',
          icon: '🔴',
          clientName,
          clientVipTier: resolveItineraryClientVipTier(row, tierMap),
          details: [
            `📌 ${supplierServiceTypeLabel(request.service_type)}`,
            `📅 ${request.service_date || '—'}`,
            request.details ? `📋 ${request.details}` : '💳 بانتظار السداد للمورد',
            `✈️ ${tripTitle}`,
            supplierRequestStatusLabel(request.status),
          ],
          urgency: 1,
          actionUrl: `/crm/itineraries/${row.id}/edit`,
          actionLabel: 'تحديث الحالة',
        });
      }
    }
  }

  return cards;
}

function buildHotelDnaCards(
  itineraries: Record<string, unknown>[],
  today: Date,
  tierMap: Map<string, VipSpendingTier>,
): RadarActionCard[] {
  const cards: RadarActionCard[] = [];

  for (const row of itineraries) {
    const range = resolveTripDateRange(row);
    if (!range) continue;

    const daysUntil = daysUntilDate(range.start, today);
    if (daysUntil !== 1 && daysUntil !== 2) continue;

    const client = resolveJoinedClient(row);
    const clientName = resolveItineraryClientName(row);
    const hotelName = firstHotelName(row);
    const { coffee, pillows } = extractDnaPrefs(client);
    const copyText = buildHotelRequestMessage(hotelName, clientName, coffee, pillows, daysUntil);

    cards.push({
      id: `hotel-${row.id}`,
      kind: 'hotel_dna',
      title: 'تنسيق استقبال الفندق ☕',
      tagLabel: 'فندق + DNA',
      tagClassName: 'border-amber-200 bg-amber-50 text-amber-900',
      icon: '🛏️',
      clientName,
      clientVipTier: resolveItineraryClientVipTier(row, tierMap),
      details: [
        `🏨 ${hotelName}`,
        `☕ ${coffee}`,
        `🛋️ ${pillows}`,
        daysUntil === 1 ? '⏰ الوصول غداً' : '⏰ الوصول بعد يومين',
      ],
      urgency: daysUntil,
      copyText,
    });
  }

  return cards;
}

function buildMedicalCards(
  itineraries: Record<string, unknown>[],
  now: Date,
  tierMap: Map<string, VipSpendingTier>,
): RadarActionCard[] {
  const cards: RadarActionCard[] = [];

  for (const row of itineraries) {
    const services = parsePreTripServices(row.pre_trip_services);
    const clientName = resolveItineraryClientName(row);
    const client = resolveJoinedClient(row);
    const phone = String(
      client?.phone_wa ?? row.customer_phone ?? '',
    ).trim();

    for (const [index, service] of services.entries()) {
      if (!isMedicalService(service)) continue;
      if (!isWithinNext48Hours(service.datetime, now)) continue;

      const clinicName =
        service.title.trim() ||
        service.note.trim() ||
        service.phone.trim() ||
        'عيادة / استشارة';
      const zoomUrl = service.location_url.trim() || undefined;
      const apptLabel = formatAppointmentTime(service.datetime);

      const notifyText = `أهلاً ${clientName}، تذكير بموعد الاستشارة الطبية (${clinicName}) — ${apptLabel}. فريق Wanderloom معك 💚`;

      cards.push({
        id: `medical-${row.id}-${index}`,
        kind: 'medical_consult',
        title: 'موعد استشارة طبية كورية 🏥',
        tagLabel: 'استشارة طبية',
        tagClassName: 'border-sky-200 bg-sky-50 text-sky-900',
        icon: '🩺',
        clientName,
        clientVipTier: resolveItineraryClientVipTier(row, tierMap),
        details: [`👨‍⚕️ ${clinicName}`, `🕐 ${apptLabel}`],
        urgency: 0,
        zoomUrl,
        whatsappUrl: waUrl(phone, notifyText),
      });
    }
  }

  return cards;
}

function buildMemoryVaultCards(
  itineraries: Record<string, unknown>[],
  today: Date,
  origin: string,
  tierMap: Map<string, VipSpendingTier>,
): RadarActionCard[] {
  const cards: RadarActionCard[] = [];

  for (const row of itineraries) {
    const range = resolveTripDateRange(row);
    if (!range) continue;

    const daysSince = daysSinceDate(range.end, today);
    if (daysSince !== 1) continue;

    const clientName = resolveItineraryClientName(row);
    const tripTitle = String(row.title ?? row.destination ?? 'رحلة VIP').trim() || 'رحلة VIP';
    const client = resolveJoinedClient(row);
    const phone = String(
      client?.phone_wa ?? '',
    ).trim();
    const vaultLink = buildVaultLink(row, origin);

    const waText = [
      `أهلاً ${clientName} ✨`,
      '',
      `شكراً لاختيارك Wanderloom — نأمل أن تكون رحلة «${tripTitle}» قد أسعدتك.`,
      '',
      'جهّزنا لك صندوق ذكرياتك الرقمي:',
      `🔗 ${vaultLink}`,
      '',
      'نتطلع لرحلتك القادمة! 🌍',
    ].join('\n');

    cards.push({
      id: `vault-${row.id}`,
      kind: 'memory_vault',
      title: 'تجهيز وإرسال صندوق الذكريات ✨',
      tagLabel: 'Vault',
      tagClassName: 'border-violet-200 bg-violet-50 text-violet-900',
      icon: '📸',
      clientName,
      clientVipTier: resolveItineraryClientVipTier(row, tierMap),
      details: [`✈️ ${tripTitle}`, '📅 انتهت الرحلة أمس'],
      urgency: 1,
      vaultLink,
      whatsappUrl: waUrl(phone, waText),
    });
  }

  return cards;
}

function buildAnniversaryCards(
  clients: AnniversaryRadarClient[],
  tierMap: Map<string, VipSpendingTier>,
): RadarActionCard[] {
  return clients.map((client) => {
    const daysLabel =
      client.daysUntilAnniversary === 0
        ? 'اليوم! 💝'
        : client.daysUntilAnniversary === 1
          ? 'باقي يوم واحد'
          : `باقي ${client.daysUntilAnniversary} أيام`;

    const surpriseText = `أهلاً ${client.name}، فريق Wanderloom يهنئك مسبقاً بذكرى زواجكم السعيدة! 💍 نود ترتيب مفاجأة فاخرة لكم — هل تفضلون بطاقة تهنئة من الفندق أم هدية خاصة؟`;
    const cardText = `أهلاً ${client.name}، بمناسبة ذكرى زواجكم القادمة، يسعدنا إرسال بطاقة تهنئة فاخرة من Wanderloom 💌`;

    return {
      id: `anniversary-${client.id}`,
      kind: 'anniversary' as const,
      title: 'ذكرى زواج العميل 💝',
      tagLabel: 'ذكرى زواج',
      tagClassName: 'border-rose-200 bg-rose-50 text-rose-900',
      icon: '💍',
      clientName: client.name,
      clientVipTier: tierMap.get(String(client.id)) ?? 'gold',
      details: [daysLabel],
      urgency: client.daysUntilAnniversary,
      whatsappUrl: waUrl(client.phone_wa, surpriseText),
      secondaryWhatsappUrl: waUrl(client.phone_wa, cardText),
      secondaryWhatsappLabel: 'بطاقة تهنئة فاخرة 💌',
    };
  });
}

function buildBirthdayCards(
  clients: BirthdayRadarClient[],
  tierMap: Map<string, VipSpendingTier>,
): RadarActionCard[] {
  return clients.map((client) => {
    const daysLabel =
      client.daysUntilBirthday === 0
        ? 'اليوم! 🎁'
        : client.daysUntilBirthday === 1
          ? 'غداً 🎁'
          : `بعد ${client.daysUntilBirthday} أيام`;

    const waText = `أهلاً ${client.name}، فريق Wanderloom يهنئك مسبقاً بعيد ميلادك ويتمنى لك يوماً سعيداً! 🎁`;

    return {
      id: `birthday-${client.id}`,
      kind: 'birthday' as const,
      title: 'عيد ميلاد العميل 🎂',
      tagLabel: 'عيد ميلاد',
      tagClassName: 'border-[#D4AF37]/40 bg-[#FEFDF9] text-[#1E2720]',
      icon: '🎂',
      clientName: client.name,
      clientVipTier: tierMap.get(String(client.id)) ?? 'gold',
      details: [`🎂 ${formatBirthdayDisplayDate(client.birth_date)}`, daysLabel],
      urgency: client.daysUntilBirthday,
      whatsappUrl: waUrl(client.phone_wa, waText),
    };
  });
}

const PASSPORT_WARNING_DAYS = 180;

function resolveClientDisplayName(client: Record<string, unknown>): string {
  return String(client.name ?? 'عميل').trim() || 'عميل';
}

function resolveClientPhone(client: Record<string, unknown>): string {
  return String(client.phone_wa ?? '').trim();
}

function buildPassportExpiryCards(
  clients: Record<string, unknown>[],
  itineraries: Record<string, unknown>[],
  today: Date,
  tierMap: Map<string, VipSpendingTier>,
): RadarActionCard[] {
  const cards: RadarActionCard[] = [];

  for (const client of clients) {
    const expiryRaw = client.passport_expiry;
    if (expiryRaw == null || expiryRaw === '') continue;

    const expiryIso = String(expiryRaw).slice(0, 10);
    const daysUntil = daysUntilDate(expiryIso, today);
    if (daysUntil == null) continue;

    const clientId = client.id != null ? String(client.id) : '';
    const clientName = resolveClientDisplayName(client);
    const phone = resolveClientPhone(client);

    const upcomingTrips = itineraries.filter((row) => {
      if (clientId && row.client_id != null && String(row.client_id) !== clientId) return false;
      const range = resolveTripDateRange(row);
      if (!range) return false;
      const tripStart = daysUntilDate(range.start, today);
      return tripStart != null && tripStart >= 0 && tripStart <= 365;
    });

    const tripEndsAfterPassport = upcomingTrips.some((row) => {
      const range = resolveTripDateRange(row);
      if (!range) return false;
      return range.end > expiryIso;
    });

    const expired = daysUntil < 0;
    const soon = daysUntil <= PASSPORT_WARNING_DAYS;
    if (!expired && !soon && !tripEndsAfterPassport) continue;

    const urgency = expired
      ? -daysUntil
      : tripEndsAfterPassport
        ? Math.min(daysUntil, 30)
        : daysUntil;

    const expiryLabel = expired
      ? `⚠️ انتهى الجواز منذ ${Math.abs(daysUntil)} يوم`
      : daysUntil === 0
        ? '⚠️ ينتهي الجواز اليوم'
        : daysUntil <= 30
          ? `⚠️ ينتهي خلال ${daysUntil} يوم`
          : `ينتهي ${expiryIso}`;

    const waText = expired
      ? `أهلاً ${clientName}، نود تذكيركم بتحديث جواز السفر (منتهٍ). فريق Wanderloom جاهز لمساعدتكم في التجديد قبل الرحلة القادمة.`
      : `أهلاً ${clientName}، جواز سفركم ينتهي بتاريخ ${expiryIso}. ننصح بالتجديد قبل السفر — فريق Wanderloom تحت أمركم.`;

    const details = [expiryLabel];
    if (tripEndsAfterPassport) {
      details.push('✈️ رحلة مجدولة بعد تاريخ انتهاء الجواز');
    }

    cards.push({
      id: `passport-${clientId || clientName}`,
      kind: 'passport_expiry',
      title: expired ? 'جواز منتهٍ — إجراء عاجل 🛂' : 'تنبيه انتهاء الجواز 🛂',
      tagLabel: 'جواز السفر',
      tagClassName: expired
        ? 'border-red-300 bg-red-50 text-red-900'
        : 'border-amber-300 bg-amber-50 text-amber-900',
      icon: '🛂',
      clientName,
      clientVipTier: tierMap.get(clientId) ?? resolveVipTierFromClientRow(client),
      details,
      urgency,
      whatsappUrl: waUrl(phone, waText),
      actionUrl: clientId ? `/crm/clients/${clientId}` : undefined,
      actionLabel: 'فتح ملف العميل',
    });
  }

  return cards;
}

export function buildRadarActionCards(input: {
  itineraries: Record<string, unknown>[];
  clients: Record<string, unknown>[];
  clientPreferences?: Array<{ client_id: string | number; interests?: unknown }>;
  referenceDate?: Date;
  origin?: string;
}): RadarActionCard[] {
  const now = input.referenceDate ?? new Date();
  const today = todayNorm(now);
  const origin =
    input.origin ?? (typeof window !== 'undefined' ? window.location.origin : 'https://wanderloom.com');

  const tierMap = buildClientVipTierMap(input.clients);

  const birthdays = filterUpcomingBirthdays(input.clients, 7, today);
  const anniversaries = filterUpcomingAnniversaries(input.clients, 7, today);

  const cards: RadarActionCard[] = [
    ...buildActiveTripCards(input.itineraries, today, tierMap),
    ...buildSupplierRequestCards(input.itineraries, tierMap),
    ...buildPassportExpiryCards(input.clients, input.itineraries, today, tierMap),
    ...buildInterestSuggestionCards(
      input.clients,
      input.clientPreferences ?? [],
      tierMap,
    ),
    ...buildHotelDnaCards(input.itineraries, today, tierMap),
    ...buildMedicalCards(input.itineraries, now, tierMap),
    ...buildMemoryVaultCards(input.itineraries, today, origin, tierMap),
    ...buildAnniversaryCards(anniversaries, tierMap),
    ...buildBirthdayCards(birthdays, tierMap),
  ];

  cards.sort((a, b) => {
    const priority = (k: RadarCardKind) => {
      if (k === 'active_trip') return 0;
      if (k === 'passport_expiry') return 1;
      if (k === 'supplier_payment') return 2;
      if (k === 'supplier_pending') return 3;
      if (k === 'interest_suggestion') return 4;
      return 5;
    };
    const pa = priority(a.kind);
    const pb = priority(b.kind);
    if (pa !== pb) return pa - pb;
    return a.urgency - b.urgency;
  });
  return cards;
}
