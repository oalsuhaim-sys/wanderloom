import { isTripFinished } from '@/lib/client-portal-trip-phase';
import { buildItineraryPortalPath } from '@/lib/itinerary-client-crm';

export type ClientItineraryBridge = {
  id: string;
  slug: string;
  title: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  totalCost: number;
  viewUrl: string;
};

const ISO_DATE_RE = /\d{4}-\d{2}-\d{2}/g;

/** يستخرج كل تواريخ ISO من نص dates القديم بغض النظر عن الفاصل (→ أو - أو غيره) */
function extractIsoDates(dates: unknown): string[] {
  if (dates == null) return [];
  const raw = String(dates).trim();
  if (!raw) return [];
  return raw.match(ISO_DATE_RE) ?? [];
}

function parseLegacyDatesEnd(dates: unknown): string | null {
  const found = extractIsoDates(dates);
  if (found.length === 0) return null;
  return found.length >= 2 ? found[found.length - 1] : found[0];
}

function parseLegacyDatesStart(dates: unknown): string | null {
  const found = extractIsoDates(dates);
  return found[0] ?? null;
}

export function resolveItineraryEndDate(row: Record<string, unknown>): string | null {
  if (row.end_date != null && String(row.end_date).trim()) {
    return String(row.end_date).slice(0, 10);
  }
  const legacyEnd = parseLegacyDatesEnd(row.dates);
  if (legacyEnd) return legacyEnd;
  return parseLegacyDatesStart(row.dates);
}

export function resolveItineraryStartDate(row: Record<string, unknown>): string | null {
  if (row.start_date != null && String(row.start_date).trim()) {
    return String(row.start_date).slice(0, 10);
  }
  const legacyStart = parseLegacyDatesStart(row.dates);
  if (legacyStart) return legacyStart;
  return parseLegacyDatesEnd(row.dates);
}

export function resolveItineraryPublicSlug(row: Record<string, unknown>): string {
  const id = String(row.id ?? '').trim();
  // Hard identity for Magic Links: numeric itineraries.id
  if (/^\d+$/.test(id)) return id;
  const magic = String(row.magic_link_id ?? '').trim();
  return magic || id;
}

/** إجمالي تكلفة المسار — لا تستخدم أعمدة الدفع هنا أبداً. */
export function resolveItineraryCost(row: Record<string, unknown>): number {
  for (const key of [
    'total_estimated_cost',
    'grand_total',
    'total_price',
    'total_budget',
    'total_cost',
    'price',
  ] as const) {
    const raw = row[key];
    if (raw == null || raw === '') continue;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

/** ما تم دفعه على المسار (spent / amount_paid). */
export function resolveItineraryPaid(row: Record<string, unknown>): number {
  for (const key of ['amount_paid', 'paid_amount', 'spent_amount'] as const) {
    const raw = row[key];
    if (raw == null || raw === '') continue;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

/**
 * رحلة نشطة أو قادمة — end_date >= اليوم.
 * بدون end_date نستخدم start_date كبديل؛ وبدون أي تاريخ لا تُعد قادمة
 * (لا نعرض بانر «رحلتك القادمة» لرحلة مجهولة التواريخ).
 */
export function isItineraryActiveOrUpcoming(
  endDate: string | null | undefined,
  startDate?: string | null,
  now: Date = new Date(),
): boolean {
  const effectiveEnd = endDate?.trim() || startDate?.trim() || null;
  if (!effectiveEnd) return false;
  return !isTripFinished(effectiveEnd, now);
}

function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isCurrentlyInProgress(
  startDate: string | null,
  endDate: string | null,
  now: Date = new Date(),
): boolean {
  const today = todayIso(now);
  const start = startDate?.trim() || null;
  const end = endDate?.trim() || start;
  if (!end) return false;
  if (isTripFinished(end, now)) return false;
  if (start && start > today) return false;
  return true;
}

function statusRank(status: unknown): number {
  const s = String(status ?? '').trim().toLowerCase();
  if (s === 'active' || s === 'confirmed' || s.includes('نشط')) return 0;
  if (s === 'sent' || s === 'approved') return 1;
  if (s === 'draft' || s === 'template') return 4;
  if (s === 'archived' || s.includes('أرشف')) return 5;
  return 2;
}

function compareItineraryIds(a: string, b: string): number {
  const aId = Number(a);
  const bId = Number(b);
  if (Number.isFinite(aId) && Number.isFinite(bId)) return bId - aId;
  return b.localeCompare(a);
}

export function mapRowToItineraryBridge(row: Record<string, unknown>): ClientItineraryBridge {
  const id = String(row.id ?? '').trim();
  const slug = resolveItineraryPublicSlug(row);
  const destination =
    String(row.destination ?? '').trim() ||
    String(row.title ?? '').trim() ||
    'وجهتك';
  const title = String(row.title ?? '').trim() || destination;
  return {
    id,
    slug,
    title,
    destination,
    startDate: resolveItineraryStartDate(row),
    endDate: resolveItineraryEndDate(row),
    totalCost: resolveItineraryCost(row),
    viewUrl: buildItineraryPortalPath({
      itinerarySlug: slug,
      clientId: row.client_id as string | number | null | undefined,
      itineraryId: id,
    }),
  };
}

/** أقرب مسار حالي/قادم — يفضّل الرحلة الجارية ثم الأقرب مستقبلاً ثم الأحدث إنشاءً */
export function pickActiveOrUpcomingItinerary(
  rows: Record<string, unknown>[],
  now: Date = new Date(),
): ClientItineraryBridge | null {
  const today = todayIso(now);
  const eligible = rows
    .map((row) => {
      const bridge = mapRowToItineraryBridge(row);
      return { row, bridge, status: row.status };
    })
    .filter(({ bridge }) => isItineraryActiveOrUpcoming(bridge.endDate, bridge.startDate, now))
    .filter(({ bridge }) => bridge.slug.length > 0)
    .filter(({ status }) => statusRank(status) < 5);

  if (eligible.length === 0) return null;

  eligible.sort((a, b) => {
    const aInProgress = isCurrentlyInProgress(a.bridge.startDate, a.bridge.endDate, now);
    const bInProgress = isCurrentlyInProgress(b.bridge.startDate, b.bridge.endDate, now);
    if (aInProgress !== bInProgress) return aInProgress ? -1 : 1;

    const aStatus = statusRank(a.status);
    const bStatus = statusRank(b.status);
    if (aStatus !== bStatus) return aStatus - bStatus;

    const aStart = a.bridge.startDate ?? '9999-12-31';
    const bStart = b.bridge.startDate ?? '9999-12-31';
    const aFuture = aStart >= today;
    const bFuture = bStart >= today;
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    if (aFuture && bFuture && aStart !== bStart) return aStart.localeCompare(bStart);

    return compareItineraryIds(a.bridge.id, b.bridge.id);
  });

  return eligible[0]?.bridge ?? null;
}

const CLIENT_ITINERARY_ROW_SELECT =
  'id, title, destination, magic_link_id, start_date, end_date, dates, is_template, customer_name, client_id, status';

/** ترتيب حسب تاريخ البداية (الأحدث أولاً) ثم id */
export function sortItinerariesNewestFirst(
  bridges: ClientItineraryBridge[],
): ClientItineraryBridge[] {
  return [...bridges].sort((a, b) => {
    const aKey = a.startDate ?? a.endDate ?? '0000-01-01';
    const bKey = b.startDate ?? b.endDate ?? '0000-01-01';
    if (aKey !== bKey) return bKey.localeCompare(aKey);
    const aId = Number(a.id);
    const bId = Number(b.id);
    if (Number.isFinite(aId) && Number.isFinite(bId)) return bId - aId;
    return b.id.localeCompare(a.id);
  });
}

export function mapClientItineraryRows(
  rows: Record<string, unknown>[],
): ClientItineraryBridge[] {
  return rows
    .filter((row) => row.is_template !== true)
    .map((row) => mapRowToItineraryBridge(row))
    .filter((bridge) => bridge.slug.length > 0);
}

/** يقسّم مسارات العميل إلى نشط/قادم وسابق */
export function partitionClientItineraries(
  rows: Record<string, unknown>[],
  now: Date = new Date(),
): {
  activeTrip: ClientItineraryBridge | null;
  pastTrips: ClientItineraryBridge[];
  allTrips: ClientItineraryBridge[];
} {
  const allTrips = sortItinerariesNewestFirst(mapClientItineraryRows(rows));
  const activeTrip = pickActiveOrUpcomingItinerary(rows, now);
  const activeId = activeTrip?.id ?? null;

  const pastTrips = allTrips.filter((trip) => {
    if (activeId && trip.id === activeId) return false;
    const effectiveEnd = trip.endDate?.trim() || trip.startDate?.trim() || null;
    // Undated trips still belong in the archive (not the “upcoming” banner)
    if (!effectiveEnd) return true;
    return isTripFinished(effectiveEnd, now);
  });

  // Archive fallback: if nothing finished yet, still list non-active trips
  const archiveTrips =
    pastTrips.length > 0
      ? pastTrips
      : allTrips.filter((trip) => !(activeId && trip.id === activeId));

  return { activeTrip, pastTrips: archiveTrips, allTrips };
}

export { CLIENT_ITINERARY_ROW_SELECT };

export function itineraryBridgeFromPublicTrip(input: {
  id: string | number;
  magicLinkId?: string | null;
  title?: string;
  destination?: string;
  startDate?: string | null;
  endDate?: string | null;
}): ClientItineraryBridge | null {
  const rawId = String(input.id ?? '').trim();
  // معرّف اصطناعي من بوابة الملف الشخصي (client-…) — ليس مساراً حقيقياً
  if (rawId.startsWith('client-')) return null;
  const slug = String(input.magicLinkId ?? input.id ?? '').trim();
  if (!slug || slug.startsWith('client-')) return null;
  const endDate = input.endDate?.trim().slice(0, 10) || null;
  const startDate = input.startDate?.trim().slice(0, 10) || null;
  if (!isItineraryActiveOrUpcoming(endDate, startDate)) return null;

  const destination = String(input.destination ?? '').trim() || 'وجهتك';
  const numericId = /^\d+$/.test(rawId) ? rawId : null;
  return {
    id: String(input.id),
    slug: numericId || slug,
    title: String(input.title ?? '').trim() || destination,
    destination,
    startDate,
    endDate,
    totalCost: 0,
    viewUrl: buildItineraryPortalPath({
      itinerarySlug: numericId || slug,
      itineraryId: numericId || rawId,
    }),
  };
}
