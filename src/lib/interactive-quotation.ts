/** Premium interactive quotation JSONB shapes (itinerary_days, hotel_options, …) */

export type QuotationItineraryDay = {
  id: string;
  dayNumber: number;
  date: string;
  city: string;
  title: string;
  description: string;
};

export type QuotationHotelOption = {
  id: string;
  city: string;
  name: string;
  description: string;
  price: number;
  is_selected_by_client: boolean;
};

export type QuotationTransportOption = {
  id: string;
  name: string;
  description: string;
  price: number;
  is_selected_by_client: boolean;
};

export type QuotationActivityOption = {
  id: string;
  name: string;
  description: string;
  price: number;
  is_selected_by_client: boolean;
};

export type QuotationCostLine = {
  id: string;
  item_name: string;
  price: number;
};

export type QuotationClientFeedback = {
  general?: string;
  days?: Record<string, string>;
  hotels?: Record<string, string>;
  transport?: Record<string, string>;
  activities?: Record<string, string>;
  submitted_at?: string;
};

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `iq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function pickStr(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function pickNum(row: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const n = Number(row[k]);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function pickBool(row: Record<string, unknown>, keys: string[]): boolean {
  for (const k of keys) {
    if (row[k] === true) return true;
    if (row[k] === false) return false;
    if (String(row[k]).toLowerCase() === 'true') return true;
  }
  return false;
}

export function createEmptyItineraryDay(dayNumber = 1): QuotationItineraryDay {
  return {
    id: newId(),
    dayNumber,
    date: '',
    city: '',
    title: '',
    description: '',
  };
}

export function createEmptyHotelOption(): QuotationHotelOption {
  return {
    id: newId(),
    city: '',
    name: '',
    description: '',
    price: 0,
    is_selected_by_client: false,
  };
}

export function createEmptyTransportOption(): QuotationTransportOption {
  return {
    id: newId(),
    name: '',
    description: '',
    price: 0,
    is_selected_by_client: false,
  };
}

export function createEmptyActivityOption(): QuotationActivityOption {
  return {
    id: newId(),
    name: '',
    description: '',
    price: 0,
    is_selected_by_client: false,
  };
}

export function createEmptyCostLine(): QuotationCostLine {
  return {
    id: newId(),
    item_name: '',
    price: 0,
  };
}

export function parseItineraryDays(raw: unknown): QuotationItineraryDay[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const dayNumber = Math.max(1, Math.trunc(pickNum(row, ['dayNumber', 'day_number', 'day']) || index + 1));
      return {
        id: pickStr(row, ['id']) || newId(),
        dayNumber,
        date: pickStr(row, ['date']).slice(0, 10),
        city: pickStr(row, ['city']),
        title: pickStr(row, ['title', 'name']),
        description: pickStr(row, ['description', 'desc', 'notes']),
      } satisfies QuotationItineraryDay;
    })
    .filter((x): x is QuotationItineraryDay => x != null);
}

export function parseHotelOptions(raw: unknown): QuotationHotelOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const name = pickStr(row, ['name', 'hotel_name', 'title']);
      const city = pickStr(row, ['city']);
      const description = pickStr(row, ['description', 'desc']);
      const price = pickNum(row, ['price', 'amount', 'cost']);
      if (!name && !city && !description && price <= 0) return null;
      return {
        id: pickStr(row, ['id']) || newId(),
        city,
        name,
        description,
        price,
        is_selected_by_client: pickBool(row, [
          'is_selected_by_client',
          'selected',
          'isSelected',
        ]),
      } satisfies QuotationHotelOption;
    })
    .filter((x): x is QuotationHotelOption => x != null);
}

export function parseTransportOptions(raw: unknown): QuotationTransportOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const name = pickStr(row, ['name', 'title', 'mode']);
      const description = pickStr(row, ['description', 'desc']);
      const price = pickNum(row, ['price', 'amount', 'cost']);
      if (!name && !description && price <= 0) return null;
      return {
        id: pickStr(row, ['id']) || newId(),
        name,
        description,
        price,
        is_selected_by_client: pickBool(row, [
          'is_selected_by_client',
          'selected',
          'isSelected',
        ]),
      } satisfies QuotationTransportOption;
    })
    .filter((x): x is QuotationTransportOption => x != null);
}

export function parseActivityOptions(raw: unknown): QuotationActivityOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const name = pickStr(row, ['name', 'title', 'activity']);
      const description = pickStr(row, ['description', 'desc']);
      const price = pickNum(row, ['price', 'amount', 'cost']);
      if (!name && !description && price <= 0) return null;
      return {
        id: pickStr(row, ['id']) || newId(),
        name,
        description,
        price,
        is_selected_by_client: pickBool(row, [
          'is_selected_by_client',
          'selected',
          'isSelected',
        ]),
      } satisfies QuotationActivityOption;
    })
    .filter((x): x is QuotationActivityOption => x != null);
}

export function parseCostBreakdown(raw: unknown): QuotationCostLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const item_name = pickStr(row, ['item_name', 'name', 'label', 'title']);
      const price = pickNum(row, ['price', 'amount', 'cost']);
      if (!item_name && price <= 0) return null;
      return {
        id: pickStr(row, ['id']) || newId(),
        item_name,
        price,
      } satisfies QuotationCostLine;
    })
    .filter((x): x is QuotationCostLine => x != null);
}

export function parseClientFeedback(raw: unknown): QuotationClientFeedback {
  const row = asRecord(raw);
  if (!row) return {};
  const days = asRecord(row.days) ?? {};
  const hotels = asRecord(row.hotels) ?? {};
  const transport = asRecord(row.transport) ?? asRecord(row.transportation) ?? {};
  const activities = asRecord(row.activities) ?? {};
  const toMap = (obj: Record<string, unknown>) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      const s = String(v ?? '').trim();
      if (s) out[k] = s;
    }
    return out;
  };
  return {
    general: pickStr(row, ['general', 'notes', 'message']) || undefined,
    days: toMap(days),
    hotels: toMap(hotels),
    transport: toMap(transport),
    activities: toMap(activities),
    submitted_at: pickStr(row, ['submitted_at']) || undefined,
  };
}

export function serializeItineraryDaysForSave(
  rows: QuotationItineraryDay[],
): Record<string, unknown>[] {
  return rows
    .map((r, i) => ({
      id: (r.id && String(r.id).trim()) || newId(),
      dayNumber: Math.max(1, Math.trunc(Number(r.dayNumber) || i + 1)),
      date: String(r.date ?? '').trim().slice(0, 10),
      city: String(r.city ?? '').trim(),
      title: String(r.title ?? '').trim(),
      description: String(r.description ?? '').trim(),
    }))
    .filter((r) => r.title || r.city || r.description || r.date);
}

export function serializeHotelOptionsForSave(
  rows: QuotationHotelOption[],
): Record<string, unknown>[] {
  return rows
    .filter(
      (r) =>
        String(r?.name ?? '').trim() ||
        String(r?.city ?? '').trim() ||
        String(r?.description ?? '').trim() ||
        Number(r?.price) > 0,
    )
    .map((r) => ({
      id: r.id,
      city: String(r.city ?? '').trim(),
      name: String(r.name ?? '').trim(),
      description: String(r.description ?? '').trim(),
      price: Number.isFinite(r.price) ? r.price : 0,
      is_selected_by_client: Boolean(r.is_selected_by_client),
    }));
}

export function serializeTransportOptionsForSave(
  rows: QuotationTransportOption[],
): Record<string, unknown>[] {
  return rows
    .filter(
      (r) =>
        String(r?.name ?? '').trim() ||
        String(r?.description ?? '').trim() ||
        Number(r?.price) > 0,
    )
    .map((r) => ({
      id: r.id,
      name: String(r.name ?? '').trim(),
      description: String(r.description ?? '').trim(),
      price: Number.isFinite(r.price) ? r.price : 0,
      is_selected_by_client: Boolean(r.is_selected_by_client),
    }));
}

export function serializeActivityOptionsForSave(
  rows: QuotationActivityOption[],
): Record<string, unknown>[] {
  return rows
    .filter(
      (r) =>
        String(r?.name ?? '').trim() ||
        String(r?.description ?? '').trim() ||
        Number(r?.price) > 0,
    )
    .map((r) => ({
      id: r.id,
      name: String(r.name ?? '').trim(),
      description: String(r.description ?? '').trim(),
      price: Number.isFinite(r.price) ? r.price : 0,
      is_selected_by_client: Boolean(r.is_selected_by_client),
    }));
}

/** Dynamic brochure cost lines from client selections + additional costs */
export function buildSelectedCostSummary(input: {
  hotels: QuotationHotelOption[];
  transports: QuotationTransportOption[];
  activities?: QuotationActivityOption[];
  additional: QuotationCostLine[];
}): { lines: Array<{ id: string; label: string; price: number }>; total: number } {
  const lines: Array<{ id: string; label: string; price: number }> = [];

  for (const h of input.hotels) {
    if (!h.is_selected_by_client) continue;
    const price = Number(h.price) || 0;
    const name = String(h.name ?? '').trim();
    if (price <= 0 && !name) continue;
    lines.push({
      id: `hotel-${h.id}`,
      label: name ? `فندق · ${name}` : 'فندق مختار',
      price,
    });
  }

  for (const t of input.transports) {
    if (!t.is_selected_by_client) continue;
    const price = Number(t.price) || 0;
    const name = String(t.name ?? '').trim();
    if (price <= 0 && !name) continue;
    lines.push({
      id: `transport-${t.id}`,
      label: name ? `مواصلات · ${name}` : 'مواصلات مختارة',
      price,
    });
  }

  for (const a of input.activities ?? []) {
    if (!a.is_selected_by_client) continue;
    const price = Number(a.price) || 0;
    const name = String(a.name ?? '').trim();
    if (price <= 0 && !name) continue;
    lines.push({
      id: `activity-${a.id}`,
      label: name ? `فعالية · ${name}` : 'فعالية مختارة',
      price,
    });
  }

  for (const c of input.additional) {
    const price = Number(c.price) || 0;
    const label = String(c.item_name ?? '').trim();
    if (!label && price <= 0) continue;
    lines.push({
      id: `extra-${c.id}`,
      label: label || 'تكلفة إضافية',
      price,
    });
  }

  const total =
    Math.round(lines.reduce((acc, line) => acc + (Number(line.price) || 0), 0) * 100) /
    100;
  return { lines, total };
}

export function serializeCostBreakdownForSave(
  rows: QuotationCostLine[],
): Record<string, unknown>[] {
  return rows
    .filter((r) => String(r?.item_name ?? '').trim() || Number(r?.price) > 0)
    .map((r) => ({
      id: r.id,
      item_name: String(r.item_name ?? '').trim(),
      price: Number.isFinite(r.price) ? r.price : 0,
    }));
}

export function emptyClientFeedback(): QuotationClientFeedback {
  return { days: {}, hotels: {}, transport: {}, activities: {} };
}

export type ClientFeedbackEntry = {
  id: string;
  label: string;
  text: string;
};

/** True when feedback has any readable note for the admin UI */
export function hasClientFeedback(feedback: QuotationClientFeedback | null | undefined): boolean {
  if (!feedback) return false;
  if (String(feedback.general ?? '').trim()) return true;
  for (const map of [feedback.days, feedback.hotels, feedback.transport, feedback.activities]) {
    if (!map) continue;
    for (const v of Object.values(map)) {
      if (String(v ?? '').trim()) return true;
    }
  }
  return false;
}

/** Flat list of client notes for admin alert / modal display */
export function listClientFeedbackEntries(
  feedback: QuotationClientFeedback | null | undefined,
  labels?: {
    days?: Record<string, string>;
    hotels?: Record<string, string>;
    transport?: Record<string, string>;
    activities?: Record<string, string>;
  },
): ClientFeedbackEntry[] {
  if (!feedback) return [];
  const out: ClientFeedbackEntry[] = [];
  const general = String(feedback.general ?? '').trim();
  if (general) {
    out.push({ id: 'general', label: 'ملاحظة عامة', text: general });
  }
  const pushMap = (
    map: Record<string, string> | undefined,
    prefix: string,
    labelMap?: Record<string, string>,
  ) => {
    if (!map) return;
    for (const [key, raw] of Object.entries(map)) {
      const text = String(raw ?? '').trim();
      if (!text) continue;
      const specific = String(labelMap?.[key] ?? '').trim();
      out.push({
        id: `${prefix}-${key}`,
        label: specific || `${prefix} · ${key.slice(0, 8)}`,
        text,
      });
    }
  };
  pushMap(feedback.days, 'يوم', labels?.days);
  pushMap(feedback.hotels, 'فندق', labels?.hotels);
  pushMap(feedback.transport, 'مواصلات', labels?.transport);
  pushMap(feedback.activities, 'فعالية', labels?.activities);
  return out;
}

/** Group brochure hotels by city for VIP city sections */
export function groupHotelsByCity(
  hotels: QuotationHotelOption[],
): Array<{ city: string; hotels: QuotationHotelOption[] }> {
  const order: string[] = [];
  const map = new Map<string, QuotationHotelOption[]>();
  for (const hotel of hotels) {
    const city = String(hotel.city ?? '').trim() || 'وجهات أخرى';
    if (!map.has(city)) {
      map.set(city, []);
      order.push(city);
    }
    map.get(city)!.push(hotel);
  }
  return order.map((city) => ({ city, hotels: map.get(city)! }));
}

export function uniqueRouteCities(days: QuotationItineraryDay[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of days) {
    const c = String(d.city ?? '').trim();
    if (!c) continue;
    const key = c.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}
