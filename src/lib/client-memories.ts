import type { SupabaseClient } from '@supabase/supabase-js';

import type { ClientItineraryBridge } from '@/lib/client-active-itinerary';
import type { ClientMemory } from '@/lib/client-profile-dashboard';
import { parseCrmClientIdForSave } from '@/lib/itinerary-client-crm';
import { formatTripDateRange } from '@/lib/public-itinerary';

export type ClientMemoryUploadInput = {
  itineraryId?: string | number;
  itinerarySlug?: string | null;
  /** Known client_id from server-rendered itinerary — skips URL re-resolution */
  clientId?: string | number | null;
  file: File;
  locationName?: string | null;
  caption?: string | null;
  /** Explicit Google Maps URL for the station/activity */
  mapUrl?: string | null;
};

export type MemoryUploadDiagnosticStep = {
  step: number;
  label: string;
  detail?: Record<string, unknown>;
};

export type MemoryUploadDiagnostic = {
  urlCode: string;
  steps: MemoryUploadDiagnosticStep[];
  browserRouteData?: Record<string, unknown> | null;
  browserRouteError?: string | null;
  resolvedItineraryId?: string | number | null;
  resolvedClientId?: number | string | null;
  source?: string;
};

export type ClientMemoryLocationGroup = {
  key: string;
  title: string;
  memories: ClientMemory[];
};

export type ClientMemoryJourneyGroup = {
  key: string;
  title: string;
  subtitle: string | null;
  locationGroups: ClientMemoryLocationGroup[];
  memories: ClientMemory[];
};

const MISC_LOCATION_KEY = 'misc-location';
const MISC_LOCATION_TITLE = 'مدينة غير محددة';

function hasUsableMemoryImageUrl(url: string | null | undefined): boolean {
  const trimmed = String(url ?? '').trim();
  if (!trimmed) return false;
  if (/^(null|undefined|none|n\/a)$/i.test(trimmed)) return false;
  return true;
}

function resolveMemoryTripName(
  memory: ClientMemory,
  trip: ClientItineraryBridge | null | undefined,
): string {
  return (
    trip?.title?.trim() ||
    memory.tripName?.trim() ||
    trip?.destination?.trim() ||
    memory.destination?.trim() ||
    ''
  );
}

/** Drop ghost images and orphaned rows that cannot form a real trip album. */
export function filterAlbumEligibleMemories(
  memories: ClientMemory[],
  trips: ClientItineraryBridge[],
): ClientMemory[] {
  const tripById = new Map(trips.map((trip) => [String(trip.id), trip]));

  return memories.filter((memory) => {
    if (!hasUsableMemoryImageUrl(memory.imageUrl)) return false;

    const itineraryId = memory.itineraryId ? String(memory.itineraryId).trim() : '';
    const trip = itineraryId ? tripById.get(itineraryId) : null;
    const tripName = resolveMemoryTripName(memory, trip);

    // Must resolve to a real trip title — never feed "رحلات أخرى"
    if (!tripName) return false;

    return true;
  });
}

/** Level 2: group photos by city (destination), never by place/station. */
function buildLocationGroups(memories: ClientMemory[]): ClientMemoryLocationGroup[] {
  const byCity = new Map<string, ClientMemoryLocationGroup>();

  for (const memory of memories) {
    const city = memory.city?.trim() || memory.destination?.trim() || '';
    const key = city ? `city-${city}` : MISC_LOCATION_KEY;
    const title = city || MISC_LOCATION_TITLE;

    if (!byCity.has(key)) {
      byCity.set(key, { key, title, memories: [] });
    }
    byCity.get(key)!.memories.push(memory);
  }

  const groups = [...byCity.values()];
  groups.sort((a, b) => {
    if (a.key === MISC_LOCATION_KEY) return 1;
    if (b.key === MISC_LOCATION_KEY) return -1;
    return a.title.localeCompare(b.title, 'ar');
  });
  return groups;
}

function coerceClientDbKey(clientId: string | number): number | string {
  const raw = String(clientId ?? '').trim().replace(/^(client-|vip-)/i, '');
  return /^\d+$/.test(raw) ? Number(raw) : raw;
}

function coerceItineraryDbKey(itineraryId: string | number): number | string {
  const raw = String(itineraryId ?? '').trim().replace(/^(client-|vip-)/i, '');
  return /^\d+$/.test(raw) ? Number(raw) : raw;
}

function normalizeItineraryUrlCode(raw: string | number | null | undefined): string {
  return String(raw ?? '').trim();
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidCode(code: string): boolean {
  return UUID_RE.test(code);
}

function isNumericCode(code: string): boolean {
  return /^\d+$/.test(code);
}

function isValidItineraryDbKey(key: number | string | null | undefined): boolean {
  if (key == null || key === '') return false;
  const s = String(key);
  return isNumericCode(s) || isUuidCode(s);
}

/** client_memories.itinerary_id is bigint — only numeric ids can be inserted. */
function coerceItineraryIdForInsert(itineraryId: number | string): number | null {
  if (typeof itineraryId === 'number' && Number.isFinite(itineraryId)) {
    return itineraryId;
  }
  const raw = String(itineraryId).trim();
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

function formatDbInsertError(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}): string {
  return (
    error.message ||
    error.details ||
    error.hint ||
    (error.code ? `code:${error.code}` : '') ||
    'تأكد من مطابقة أعمدة الجدول'
  );
}

/** يستخرج كود المسار من مسار الصفحة — UUID أولاً، ثم القطعة بعد /itinerary/. */
export function extractItineraryCodeFromPath(pathname?: string | null): string {
  const path = String(
    pathname ?? (typeof window !== 'undefined' ? window.location.pathname : ''),
  ).trim();

  const uuidMatch = path.match(
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/,
  );
  if (uuidMatch) return uuidMatch[0];

  const parts = path.split('/').filter(Boolean);
  const itineraryIdx = parts.findIndex((p) => p === 'itinerary');
  if (itineraryIdx >= 0 && parts[itineraryIdx + 1]) {
    return normalizeItineraryUrlCode(parts[itineraryIdx + 1]);
  }

  return '';
}

type ResolvedItineraryLink = {
  itineraryId: number | string;
  clientId: number | null;
};

/** يحلّ id و client_id من كود الرابط — UUID → عمود id، رقم → id، غير ذلك → magic_link_id. */
export async function resolveItineraryIdsFromUrlCode(
  supabase: SupabaseClient,
  urlCode: string,
): Promise<ResolvedItineraryLink | null> {
  const code = normalizeItineraryUrlCode(urlCode);
  if (!code) return null;

  type Row = { id?: unknown; client_id?: unknown };

  async function absorb(row: Row | null): Promise<ResolvedItineraryLink | null> {
    if (row?.id == null || row.id === '') return null;
    const itineraryKey = coerceItineraryDbKey(row.id as string | number);
    if (!isValidItineraryDbKey(itineraryKey)) return null;

    const itineraryId = itineraryKey;
    let clientId: number | null = null;

    if (row.client_id != null && row.client_id !== '') {
      clientId = parseCrmClientIdForSave(row.client_id as string | number);
    }

    // Only re-read itineraries.client_id — never query itinerary_client_members
    if (clientId == null) {
      clientId = await fetchClientIdForItinerary(supabase, itineraryId);
    }

    return { itineraryId, clientId };
  }

  async function lookup(
    column: 'id' | 'magic_link_id' | 'passcode',
    value: string | number,
  ): Promise<ResolvedItineraryLink | null> {
    const { data, error } = await supabase
      .from('itineraries')
      .select('id, client_id, title, magic_link_id')
      .eq(column, value)
      .maybeSingle();
    console.log(`[resolveItineraryIdsFromUrlCode] lookup ${column}=${value}`, {
      data,
      error: error?.message ?? null,
    });
    return absorb(data as Row | null);
  }

  // UUID in URL → try `id` first, then magic_link_id
  if (isUuidCode(code)) {
    const byId = await lookup('id', code);
    if (byId) return byId;
    const byMagic = await lookup('magic_link_id', code);
    if (byMagic) return byMagic;
    return null;
  }

  // Numeric → `id` column
  if (isNumericCode(code)) {
    const byId = await lookup('id', Number(code));
    if (byId) return byId;
  }

  // Short code (VIP-0006 etc.) → magic_link_id, then passcode
  const byMagic = await lookup('magic_link_id', code);
  if (byMagic) return byMagic;

  return lookup('passcode', code.toUpperCase());
}

/** يجلب client_id من itineraries فقط (لا itinerary_client_members). */
export async function fetchClientIdForItinerary(
  supabase: SupabaseClient,
  itineraryId: string | number,
): Promise<number | null> {
  const itineraryKey = coerceItineraryDbKey(itineraryId);
  if (!isValidItineraryDbKey(itineraryKey)) {
    console.warn('[fetchClientIdForItinerary] invalid itinerary key:', itineraryId);
    return null;
  }

  const { data: row, error: rowError } = await supabase
    .from('itineraries')
    .select('id, client_id')
    .eq('id', itineraryKey)
    .maybeSingle();

  if (rowError) {
    console.error('[fetchClientIdForItinerary] itineraries select error:', rowError);
    return null;
  }

  console.log('[fetchClientIdForItinerary] itineraries row:', row);

  if (row?.client_id == null || row.client_id === '') {
    return null;
  }

  return parseCrmClientIdForSave(row.client_id as string | number);
}

/** Browser/server diagnostic — logs each lookup column for a URL slug. */
export async function probeItineraryLinkFromUrlCode(
  supabase: SupabaseClient,
  urlCode: string,
): Promise<MemoryUploadDiagnostic> {
  const code = normalizeItineraryUrlCode(urlCode);
  const steps: MemoryUploadDiagnosticStep[] = [];
  let step = 0;

  const add = (label: string, detail?: Record<string, unknown>) => {
    step += 1;
    steps.push({ step, label, detail });
    console.log(`🟢 ${step}. ${label}`, detail ?? '');
  };

  add('Extracted URL code', { urlCode: code, pathname: typeof window !== 'undefined' ? window.location.pathname : null });

  if (!code) {
    return { urlCode: code, steps };
  }

  const probes: Array<{ column: 'id' | 'magic_link_id' | 'passcode'; value: string | number }> = [];
  if (isUuidCode(code)) {
    probes.push({ column: 'id', value: code }, { column: 'magic_link_id', value: code });
  } else if (isNumericCode(code)) {
    probes.push({ column: 'id', value: Number(code) });
  }
  probes.push({ column: 'magic_link_id', value: code }, { column: 'passcode', value: code.toUpperCase() });

  let browserRouteData: Record<string, unknown> | null = null;
  let browserRouteError: string | null = null;

  for (const probe of probes) {
    const { data, error } = await supabase
      .from('itineraries')
      .select('id, client_id, title, magic_link_id')
      .eq(probe.column, probe.value)
      .maybeSingle();
    add(`Browser/anon probe: ${probe.column}`, {
      column: probe.column,
      value: probe.value,
      data,
      error: error?.message ?? null,
    });
    if (!browserRouteData && data) {
      browserRouteData = data as Record<string, unknown>;
    }
    if (error && !browserRouteError) {
      browserRouteError = error.message;
    }
  }

  const resolved = await resolveItineraryIdsFromUrlCode(supabase, code);
  add('Resolved itinerary link (server logic)', {
    resolved,
    browserClientId: browserRouteData?.client_id ?? null,
  });

  return {
    urlCode: code,
    steps,
    browserRouteData,
    browserRouteError,
    resolvedItineraryId: resolved?.itineraryId ?? null,
    resolvedClientId: resolved?.clientId ?? null,
    source: resolved ? 'resolveItineraryIdsFromUrlCode' : 'none',
  };
}

export async function uploadClientMemory(
  supabase: SupabaseClient,
  input: ClientMemoryUploadInput,
): Promise<
  | { ok: true; inserted: Record<string, unknown>[]; diagnostic?: MemoryUploadDiagnostic }
  | { ok: false; error: string; diagnostic?: MemoryUploadDiagnostic }
> {
  let resolvedItineraryId: number | string | null = null;
  let clientKey: number | null = null;
  let diagnostic: MemoryUploadDiagnostic | undefined;

  // Fast path: page already passed verified ids — skip URL resolution entirely
  if (input.itineraryId != null && input.clientId != null && String(input.clientId).trim() !== '') {
    const itineraryKey = coerceItineraryDbKey(input.itineraryId);
    const fromProps = parseCrmClientIdForSave(input.clientId);
    if (isValidItineraryDbKey(itineraryKey) && fromProps != null) {
      resolvedItineraryId = itineraryKey;
      clientKey = fromProps;
      console.log('[uploadClientMemory] fast path — props:', {
        itineraryId: resolvedItineraryId,
        clientId: clientKey,
      });
    }
  }

  const slug = normalizeItineraryUrlCode(input.itinerarySlug);
  if (resolvedItineraryId == null || clientKey == null) {
    if (slug) {
      diagnostic = await probeItineraryLinkFromUrlCode(supabase, slug);
      const resolved = await resolveItineraryIdsFromUrlCode(supabase, slug);
      if (!resolved) {
        return {
          ok: false,
          error: `itinerary_not_found_in_db:${slug}`,
          diagnostic,
        };
      }
      resolvedItineraryId = resolved.itineraryId;
      clientKey = resolved.clientId;
    }
  }

  if (input.itineraryId != null && resolvedItineraryId == null) {
    const itineraryKey = coerceItineraryDbKey(input.itineraryId);
    if (isValidItineraryDbKey(itineraryKey)) {
      resolvedItineraryId = itineraryKey;
    }
  }

  if (clientKey == null && input.clientId != null && String(input.clientId).trim() !== '') {
    const fromProps = parseCrmClientIdForSave(input.clientId);
    if (fromProps != null) {
      clientKey = fromProps;
      console.log('[uploadClientMemory] using clientId from props:', fromProps);
    }
  }

  if (resolvedItineraryId == null) {
    return { ok: false, error: 'missing_itinerary_id', diagnostic };
  }

  if (clientKey == null) {
    clientKey = await fetchClientIdForItinerary(supabase, resolvedItineraryId);
  }

  if (clientKey == null) {
    console.error('[uploadClientMemory] missing client_id for itinerary:', {
      resolvedItineraryId,
      slug,
      propsClientId: input.clientId ?? null,
      diagnostic,
    });
    return {
      ok: false,
      error:
        'missing_client_id: لا يمكن ربط الصورة بملف العميل — اربط المسار بالعميل في منشئ الرحلة ثم أعد المحاولة',
      diagnostic,
    };
  }

  const ext = input.file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
  const filePath = `${clientKey}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('memories')
    .upload(filePath, input.file, {
      contentType: input.file.type || 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, error: uploadError.message || 'upload_failed' };
  }

  const { data: publicData } = supabase.storage.from('memories').getPublicUrl(filePath);
  const uploadedFileUrl = publicData.publicUrl;
  const memoryCaption = input.caption?.trim() || null;
  const locationName = input.locationName?.trim() || null;
  const mapUrl = input.mapUrl?.trim() || null;

  const itineraryIdForDb = coerceItineraryIdForInsert(resolvedItineraryId);

  const payload: Record<string, unknown> = {
    client_id: clientKey,
    image_url: uploadedFileUrl,
    location_name: locationName || 'محطة مختارة',
    caption: memoryCaption,
  };

  if (itineraryIdForDb != null) {
    payload.itinerary_id = itineraryIdForDb;
  }

  if (locationName) {
    payload.location = locationName;
  }

  if (mapUrl && /^https?:\/\//i.test(mapUrl)) {
    payload.map_url = mapUrl;
  }

  console.log('Attempting DB Insert with payload:', payload);

  const { data: insertedData, error: dbError } = await supabase
    .from('client_memories')
    .insert(payload)
    .select();

  if (dbError) {
    console.error('Supabase DB Insert Error:', dbError);
    return {
      ok: false,
      error: `خطأ في الحفظ بالجدول: ${formatDbInsertError(dbError)}`,
    };
  }

  console.log('Successfully inserted into DB:', insertedData);
  return { ok: true, inserted: (insertedData ?? []) as Record<string, unknown>[], diagnostic };
}

export function groupClientMemoriesByJourney(
  memories: ClientMemory[],
  trips: ClientItineraryBridge[],
): ClientMemoryJourneyGroup[] {
  const tripById = new Map(trips.map((trip) => [String(trip.id), trip]));
  const validMemories = filterAlbumEligibleMemories(memories, trips);
  const groups = new Map<string, ClientMemoryJourneyGroup>();

  for (const memory of validMemories) {
    const itineraryId = memory.itineraryId ? String(memory.itineraryId) : null;
    const trip = itineraryId ? tripById.get(itineraryId) : null;
    const year =
      memory.memoryDate?.slice(0, 4) ??
      trip?.startDate?.slice(0, 4) ??
      trip?.endDate?.slice(0, 4) ??
      null;

    const tripName = resolveMemoryTripName(memory, trip);
    // Pre-filter guarantees tripName — skip any residual orphans
    if (!tripName) continue;

    // Level 1 = TRIP ONLY — never group by place / station / locationName
    let key: string;
    let title: string;
    let subtitle: string | null = null;

    if (itineraryId) {
      key = `itinerary-${itineraryId}`;
      title = tripName;
      if (trip) {
        const range = formatTripDateRange(trip.startDate, trip.endDate ?? trip.startDate);
        subtitle = range !== 'التواريخ قريباً' ? range : null;
      } else if (year) {
        subtitle = year;
      }
    } else {
      key = `trip-${tripName}`;
      title = year ? `${tripName} · ${year}` : tripName;
    }

    if (!groups.has(key)) {
      groups.set(key, { key, title, subtitle, memories: [], locationGroups: [] });
    }
    groups.get(key)!.memories.push(memory);
  }

  return [...groups.values()]
    .filter((group) => group.memories.length > 0)
    .map((group) => ({
      ...group,
      locationGroups: buildLocationGroups(group.memories),
    }));
}
