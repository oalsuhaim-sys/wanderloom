import type { SupabaseClient } from '@supabase/supabase-js';

const OMIT_ITINERARY_KEYS = new Set([
  'id',
  'created_at',
  'updated_at',
  'magic_link_id',
  'itinerary_days',
  'clients',
  'experts',
]);

function newMagicLinkId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `wl-copy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function versionedTitle(raw: unknown): string {
  const base = String(raw ?? '').trim() || 'مسار بدون عنوان';
  if (/نسخة جديدة\s*$/u.test(base) || /\s-\s*V\d+\s*$/i.test(base)) {
    return `${base} · نسخة`;
  }
  return `${base} - نسخة جديدة`;
}

function stripRowIds<T extends Record<string, unknown>>(row: T, ...keys: string[]): Record<string, unknown> {
  const next: Record<string, unknown> = { ...row };
  for (const key of keys) delete next[key];
  return next;
}

export type DuplicateItineraryResult =
  | { ok: true; newId: string | number; title: string }
  | { ok: false; error: string };

/**
 * Deep-clone an itinerary:
 * 1) Clone `itineraries` row (including `days_data` JSONB with all places/settings)
 * 2) Clone relational `itinerary_days` + `itinerary_stops` when present (legacy schema)
 */
export async function duplicateItineraryDeep(
  client: SupabaseClient,
  originalId: string | number,
): Promise<DuplicateItineraryResult> {
  const queryId = /^\d+$/.test(String(originalId)) ? Number(originalId) : originalId;

  const { data: original, error: fetchErr } = await client
    .from('itineraries')
    .select('*')
    .eq('id', queryId)
    .maybeSingle();

  if (fetchErr) {
    return { ok: false, error: fetchErr.message || 'تعذر قراءة المسار الأصلي.' };
  }
  if (!original) {
    return { ok: false, error: 'المسار الأصلي غير موجود.' };
  }

  const source = original as Record<string, unknown>;
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (OMIT_ITINERARY_KEYS.has(key)) continue;
    payload[key] = value;
  }

  const title = versionedTitle(source.title ?? source.customer_name);
  payload.title = title;
  payload.status = 'draft';
  payload.magic_link_id = newMagicLinkId();
  if ('bypass_24h_lock' in payload) payload.bypass_24h_lock = false;

  let insertRes = await client.from('itineraries').insert(payload).select('id').single();

  // Retry without unknown columns if schema drift
  if (
    insertRes.error &&
    /column|schema cache|does not exist/i.test(insertRes.error.message ?? '')
  ) {
    const msg = insertRes.error.message ?? '';
    const slim = { ...payload };
    for (const key of Object.keys(slim)) {
      if (new RegExp(`['"]${key}['"]|\\b${key}\\b`, 'i').test(msg) && key !== 'title') {
        delete slim[key];
      }
    }
    // Always keep core content
    slim.title = title;
    if (source.days_data != null) slim.days_data = source.days_data;
    insertRes = await client.from('itineraries').insert(slim).select('id').single();
  }

  if (insertRes.error || insertRes.data?.id == null) {
    return {
      ok: false,
      error: insertRes.error?.message || 'تعذر إنشاء نسخة المسار.',
    };
  }

  const newId = insertRes.data.id as string | number;

  // Best-effort relational clone (days_data already covers Timeline builder)
  try {
    await cloneRelationalDays(client, queryId, newId);
  } catch (err) {
    console.error('[duplicateItineraryDeep] relational days clone:', err);
  }

  return { ok: true, newId, title };
}

async function cloneRelationalDays(
  client: SupabaseClient,
  originalItineraryId: string | number,
  newItineraryId: string | number,
): Promise<void> {
  const { data: days, error } = await client
    .from('itinerary_days')
    .select(
      'id, day_num, title, city, notes, sort_order, itinerary_stops(id, place_name, category, visit_time, time_slot, note, image_url, transport_type, taxi, transit_mode, transit_duration, transit_distance, sort_order)',
    )
    .eq('itinerary_id', originalItineraryId)
    .order('sort_order', { ascending: true });

  if (error) {
    // Table may not exist / RLS — days_data clone is enough
    if (/does not exist|schema cache|relationship/i.test(error.message ?? '')) return;
    throw error;
  }
  if (!days?.length) return;

  for (const day of days) {
    const dayRow = day as Record<string, unknown>;
    const stopsRaw = dayRow.itinerary_stops;
    const dayPayload = stripRowIds(dayRow, 'id', 'itinerary_stops');
    dayPayload.itinerary_id = newItineraryId;

    const { data: newDay, error: dayErr } = await client
      .from('itinerary_days')
      .insert(dayPayload)
      .select('id')
      .single();

    if (dayErr || newDay?.id == null) {
      console.error('[duplicateItineraryDeep] day insert:', dayErr?.message);
      continue;
    }

    const stops = Array.isArray(stopsRaw) ? (stopsRaw as Record<string, unknown>[]) : [];
    if (!stops.length) continue;

    const stopPayloads = stops.map((stop) => {
      const next = stripRowIds(stop, 'id');
      next.day_id = newDay.id;
      return next;
    });

    const { error: stopErr } = await client.from('itinerary_stops').insert(stopPayloads);
    if (stopErr) {
      console.error('[duplicateItineraryDeep] stops insert:', stopErr.message);
    }
  }
}
