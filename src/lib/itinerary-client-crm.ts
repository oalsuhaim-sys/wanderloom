import { normalizeWhatsAppPhoneDigits } from '@/lib/vip-portal-share';

export type CrmClientMini = {
  id: string | number;
  name?: string | null;
  phone_wa?: string | null;
  vip_tier?: string | null;
  total_spent?: number | null;
};

export function resolveItineraryClientId(row: Record<string, unknown>): string {
  const nested = row.client;
  const nestedId =
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as { id?: unknown }).id
      : null;
  const raw = row.client_id ?? nestedId;
  if (raw == null || raw === '') return '';
  return String(raw).trim();
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
