import { normalizeWhatsAppPhoneDigits } from '@/lib/vip-portal-share';

export type CrmClientMini = {
  id: string | number;
  name?: string | null;
  phone_wa?: string | null;
  vip_tier?: string | null;
  total_spent?: number | null;
};

/** Normalize CRM client id strings (strip vip-/client- prefixes). */
export function normalizeCrmClientIdString(
  raw: string | number | null | undefined,
): string {
  if (raw == null || raw === '') return '';
  const stripped = String(raw).trim().replace(/^(client-|vip-)/i, '');
  return stripped || '';
}

/** Parse a CRM client id for Supabase bigint columns. */
export function parseCrmClientIdForSave(
  raw: string | number | null | undefined,
): number | null {
  const normalized = normalizeCrmClientIdString(raw);
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

const CLIENT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Numeric bigint id or UUID string — for itineraries.client_id writes. */
export function coerceClientIdForItinerarySave(
  raw: string | number | null | undefined,
): number | string | null {
  const normalized = normalizeCrmClientIdString(raw);
  if (!normalized) return null;
  if (/^\d+$/.test(normalized)) {
    const n = Number(normalized);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (CLIENT_UUID_RE.test(normalized)) return normalized;
  return null;
}

export function resolveItineraryClientId(row: Record<string, unknown>): string {
  const nested = row.client;
  const nestedId =
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as { id?: unknown }).id
      : null;
  const raw = row.client_id ?? nestedId;
  return normalizeCrmClientIdString(
    raw as string | number | null | undefined,
  );
}

type ItineraryClientDb = {
  // Minimal surface for itinerary client link helpers (avoids tight coupling to generated DB types).
  from: (table: string) => unknown;
};

function resolveItineraryQueryId(itineraryId: string | number): string | number {
  return /^\d+$/.test(String(itineraryId)) ? Number(itineraryId) : itineraryId;
}

/** Fallback when itineraries.client_id is null but a member row exists. */
export async function fetchItineraryMemberClientId(
  supabase: ItineraryClientDb,
  itineraryId: string | number,
): Promise<string> {
  const queryId = resolveItineraryQueryId(itineraryId);
  const client = supabase as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string | number,
        ) => {
          order: (
            column: string,
            opts: { ascending: boolean },
          ) => {
            limit: (n: number) => {
              maybeSingle: () => Promise<{
                data: { client_id?: unknown } | null;
                error: { message?: string } | null;
              }>;
            };
          };
        };
      };
    };
  };

  const { data, error } = await client
    .from('itinerary_client_members')
    .select('client_id')
    .eq('itinerary_id', queryId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || data?.client_id == null) return '';
  return normalizeCrmClientIdString(data.client_id as string | number);
}

/** Resolve linked client from row + itinerary_client_members fallback. */
export async function resolveItineraryClientIdFromDb(
  supabase: ItineraryClientDb,
  row: Record<string, unknown>,
  itineraryId: string | number,
): Promise<string> {
  const direct = resolveItineraryClientId(row);
  if (direct) return direct;
  return fetchItineraryMemberClientId(supabase, itineraryId);
}

export async function fetchCrmClientMiniById(
  supabase: ItineraryClientDb,
  clientId: string | number,
): Promise<CrmClientMini | null> {
  const parsed = parseCrmClientIdForSave(clientId);
  if (parsed == null) return null;

  const client = supabase as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: number,
        ) => {
          maybeSingle: () => Promise<{
            data: CrmClientMini | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };
  };

  const { data, error } = await client
    .from('clients')
    .select(CRM_CLIENTS_LIST_SELECT)
    .eq('id', parsed)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/** Keep itineraries.client_id and itinerary_client_members in sync after save. */
export async function syncItineraryClientLink(
  supabase: ItineraryClientDb,
  itineraryId: string | number,
  clientId: number | string | null,
): Promise<void> {
  const queryId = resolveItineraryQueryId(itineraryId);

  if (clientId == null) return;

  const client = supabase as {
    from: (table: string) => {
      upsert: (
        row: Record<string, unknown>,
        opts?: { onConflict?: string },
      ) => Promise<{ error: { message?: string } | null }>;
    };
  };

  const { error } = await client
    .from('itinerary_client_members')
    .upsert(
      { itinerary_id: queryId, client_id: clientId },
      { onConflict: 'itinerary_id,client_id' },
    );

  if (error) {
    console.warn('[syncItineraryClientLink]', error.message);
  }
}

function formatItineraryClientSaveError(error: {
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
    'تعذر حفظ ربط العميل بالمسار'
  );
}

/** Dedicated write for itineraries.client_id — never skipped by schema retries on other columns. */
export async function persistItineraryClientId(
  supabase: ItineraryClientDb,
  itineraryId: string | number,
  clientId: number | string | null,
): Promise<
  | { ok: true; client_id: number | string | null }
  | { ok: false; error: string }
> {
  const queryId = resolveItineraryQueryId(itineraryId);

  console.log('[persistItineraryClientId] saving', { itineraryId: queryId, clientId });

  const client = supabase as {
    from: (table: string) => {
      update: (row: Record<string, unknown>) => {
        eq: (
          column: string,
          value: string | number,
        ) => {
          select: (columns: string) => {
            single: () => Promise<{
              data: { id?: unknown; client_id?: unknown } | null;
              error: { message?: string; details?: string; hint?: string; code?: string } | null;
            }>;
          };
        };
      };
    };
  };

  const { data, error } = await client
    .from('itineraries')
    .update({ client_id: clientId })
    .eq('id', queryId)
    .select('id, client_id');

  if (error) {
    console.error('[persistItineraryClientId] Supabase error:', error);
    const columnMissing = /column|schema cache|does not exist/i.test(error.message ?? '');
    return {
      ok: false,
      error: columnMissing
        ? `خطأ في ربط العميل: عمود client_id غير موجود — نفّذ supabase/sql/clients_profile_code.sql — ${error.message}`
        : `خطأ في ربط العميل: ${formatItineraryClientSaveError(error)}`,
    };
  }

  if (!data?.length) {
    console.error('[persistItineraryClientId] zero rows updated', { queryId, clientId });
    return {
      ok: false,
      error:
        'لم يُحدَّث أي صف في itineraries — تحقق من معرّف المسار أو صلاحيات RLS (استخدم حفظ الخادم بـ service_role).',
    };
  }

  const row = data[0];
  const saved =
    row?.client_id != null && row.client_id !== ''
      ? (typeof row.client_id === 'number'
          ? row.client_id
          : normalizeCrmClientIdString(row.client_id as string | number) || row.client_id)
      : null;

  if (clientId != null && String(saved ?? '') !== String(clientId)) {
    console.error('[persistItineraryClientId] mismatch after save', {
      expected: clientId,
      actual: saved,
    });
    return {
      ok: false,
      error: 'تم الحفظ لكن client_id لم يُحدَّث في قاعدة البيانات — نفّذ clients_profile_code.sql في Supabase.',
    };
  }

  await syncItineraryClientLink(supabase, queryId, clientId);
  console.log('[persistItineraryClientId] success', { client_id: saved });
  return { ok: true, client_id: saved as number | string | null };
}

export function parseJoinedCrmClient(raw: unknown): CrmClientMini | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const id = row.id;
  if (id == null || id === '') return null;
  return {
    id: typeof id === 'number' ? id : String(id),
    name: row.name != null ? String(row.name) : null,
    phone_wa: row.phone_wa != null ? String(row.phone_wa) : null,
    vip_tier: row.vip_tier != null ? String(row.vip_tier) : null,
    total_spent:
      row.total_spent != null && Number.isFinite(Number(row.total_spent))
        ? Number(row.total_spent)
        : null,
  };
}

export function mergeClientIntoList(
  list: CrmClientMini[],
  client: CrmClientMini,
): CrmClientMini[] {
  const id = String(client.id);
  if (list.some((item) => String(item.id) === id)) return list;
  return [...list, client].sort((a, b) =>
    clientDisplayName(a).localeCompare(clientDisplayName(b), 'ar'),
  );
}

export function clientDisplayName(client: {
  id: string | number;
  name?: string | null;
}): string {
  return String(client.name ?? '').trim() || `عميل #${client.id}`;
}

export function resolveClientPhone(client?: CrmClientMini | null): string {
  if (!client) return '';
  return String(client.phone_wa ?? '').trim();
}

export function resolveItineraryPublicSlug(row: Record<string, unknown>, fallbackId: string): string {
  const magic = String(row.magic_link_id ?? '').trim();
  if (magic) return magic;
  const id = row.id != null ? String(row.id).trim() : '';
  return id || fallbackId;
}

export function buildItineraryWhatsAppShareUrl(input: {
  client?: CrmClientMini | null;
  itinerarySlug: string;
  origin?: string;
}): { url: string } | { error: string } {
  const digits = normalizeWhatsAppPhoneDigits(resolveClientPhone(input.client));
  if (!digits) {
    return { error: '⚠️ لا يوجد رقم جوال مسجل لهذا العميل في قاعدة البيانات.' };
  }

  const base = (input.origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(
    /\/$/,
    '',
  );
  const link = `${base}/itinerary/${encodeURIComponent(input.itinerarySlug)}`;
  const name = input.client ? clientDisplayName(input.client) : 'عزيزي العميل';
  const message = [
    `مرحباً ${name} ✨`,
    '',
    'تم تحديث مسار رحلتك الفاخرة، يمكنك معاينته عبر الرابط التالي:',
    link,
  ].join('\n');

  return {
    url: `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
  };
}

export function openItineraryWhatsAppShare(input: {
  client?: CrmClientMini | null;
  itinerarySlug: string;
  origin?: string;
}): { ok: true } | { ok: false; error: string } {
  const result = buildItineraryWhatsAppShareUrl(input);
  if ('error' in result) return { ok: false, error: result.error };
  if (typeof window === 'undefined') return { ok: false, error: 'غير متاح خارج المتصفح.' };
  window.open(result.url, '_blank', 'noopener,noreferrer');
  return { ok: true };
}

export const ITINERARY_CLIENT_JOIN_SELECT =
  '*, client:clients(id, name, phone_wa, vip_tier, total_spent)';

export const CRM_CLIENTS_LIST_SELECT =
  'id, name, phone_wa, vip_tier, total_spent';
