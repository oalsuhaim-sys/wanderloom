export type ClientActivityType =
  | 'note'
  | 'payment'
  | 'invoice'
  | 'booking'
  | 'trip'
  | 'quote'
  | 'meeting'
  | 'contact'
  | 'other';

export type ClientActivityLog = {
  id: string;
  client_id: string;
  title: string;
  description: string;
  type: ClientActivityType;
  created_at: string;
  metadata: Record<string, unknown>;
};

const ALLOWED_TYPES = new Set<string>([
  'note',
  'payment',
  'invoice',
  'booking',
  'trip',
  'quote',
  'meeting',
  'contact',
  'other',
]);

export function normalizeActivityType(raw: unknown): ClientActivityType {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (ALLOWED_TYPES.has(s)) return s as ClientActivityType;
  if (s === 'paid' || s === 'دفعة') return 'payment';
  if (s === 'فاتورة') return 'invoice';
  if (s === 'حجز' || s === 'confirmed_seat') return 'booking';
  if (s === 'ملاحظة' || s === 'manual') return 'note';
  return 'other';
}

export function mapActivityLogRow(row: Record<string, unknown>): ClientActivityLog | null {
  const id = row.id != null ? String(row.id) : '';
  const client_id = row.client_id != null ? String(row.client_id) : '';
  if (!id || !client_id) return null;

  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    id,
    client_id,
    title: String(row.title ?? '').trim() || 'حدث',
    description: String(row.description ?? '').trim(),
    type: normalizeActivityType(row.type),
    created_at:
      row.created_at != null ? String(row.created_at) : new Date().toISOString(),
    metadata: meta,
  };
}
