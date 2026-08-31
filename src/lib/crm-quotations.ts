import { supabase } from '@/lib/supabase';
import { processReferralRewardForQuotation } from '@/lib/referral-rewards';
import { updatePipelineStatus } from '@/lib/lead-pipeline-automation';
import {
  parseClientFeedback,
  parseCostBreakdown,
  parseHotelOptions,
  parseItineraryDays,
  parseActivityOptions,
  parseTransportOptions,
  type QuotationActivityOption,
  type QuotationClientFeedback,
  type QuotationCostLine,
  type QuotationHotelOption,
  type QuotationItineraryDay,
  type QuotationTransportOption,
} from '@/lib/interactive-quotation';

export type QuotationStatus =
  | 'draft'
  | 'pending_client'
  | 'needs_revision'
  | 'client_responded'
  | 'approved'
  | 'awaiting_payment'
  | 'payment_confirmed'
  | 'deposit_paid'
  | 'fully_paid';

export type QuotationTripCategory = 'private' | 'group';

export type QuotationFlightProposal = {
  id: string;
  departureCity: string;
  arrivalCity: string;
  airline: string;
  flight_class: string;
  price: number;
};

export type QuotationHotelProposal = {
  id: string;
  hotel_name: string;
  city: string;
  room_type: string;
  price: number;
};

export type QuotationActivityProposal = {
  id: string;
  name: string;
  location: string;
  description: string;
  price: number;
};

export type QuotationTransportProposal = {
  id: string;
  description: string;
  mode: string;
  price: number;
};

export type QuotationRow = {
  id: string;
  lead_id?: string | null;
  client_id: string | null;
  title: string;
  destinations: string[];
  start_date: string | null;
  end_date: string | null;
  total_estimated_cost: number;
  expected_profit: number;
  status: QuotationStatus;
  paid_amount: number;
  remaining_amount: number;
  trip_category: QuotationTripCategory;
  flight_proposals: QuotationFlightProposal[];
  hotel_proposals: QuotationHotelProposal[];
  activities_proposals: QuotationActivityProposal[];
  transport_proposals: QuotationTransportProposal[];
  profit_margin: number;
  service_fee: number;
  grand_total: number;
  lead_source: string | null;
  referral_code: string | null;
  is_referral_paid: boolean;
  /** اسم الخبير/الموظف المسؤول عن العرض */
  expert_name: string | null;
  /** معرّف الخبير (إن وُجد عمود expert_id في quotations) */
  expert_id: string | null;
  created_at: string;
  itinerary_days: QuotationItineraryDay[];
  hotel_options: QuotationHotelOption[];
  transport_options: QuotationTransportOption[];
  activity_options: QuotationActivityOption[];
  cost_breakdown: QuotationCostLine[];
  client_feedback: QuotationClientFeedback;
  clients?: {
    id?: number;
    name?: string | null;
    phone_wa?: string | null;
  } | null;
};

export type QuotationInsertInput = {
  clientId: string | number;
  title: string;
  destinations: string[];
  startDate: string;
  endDate: string;
  totalEstimatedCost: number;
  expectedProfit: number;
  flightProposals: QuotationFlightProposal[];
  hotelProposals: QuotationHotelProposal[];
};

export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, string> = {
  draft: 'مسودة',
  pending_client: 'بانتظار العميل',
  needs_revision: 'يحتاج تعديلاً',
  client_responded: 'رد العميل',
  approved: 'تم الاعتماد',
  awaiting_payment: 'بانتظار الدفع',
  payment_confirmed: 'تم تأكيد الدفع',
  deposit_paid: 'عربون مدفوع',
  fully_paid: 'مدفوع بالكامل',
};

/** Soft SaaS badge classes for quotation status chips */
export function quotationStatusBadgeClass(status: QuotationStatus): string {
  const base = 'px-3 py-1 rounded-full text-xs font-semibold border';
  switch (status) {
    case 'draft':
      return `${base} border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`;
    case 'pending_client':
    case 'awaiting_payment':
    case 'client_responded':
      return `${base} border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-400`;
    case 'approved':
    case 'payment_confirmed':
    case 'deposit_paid':
    case 'fully_paid':
      return `${base} border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-400`;
    case 'needs_revision':
      return `${base} border-rose-100 bg-rose-50 text-rose-600 dark:border-rose-900/30 dark:bg-rose-900/20 dark:text-rose-400`;
    default:
      return `${base} border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`;
  }
}

/** أعمدة clients المطلوبة لقائمة العروض وواتساب (بترتيب من الأشمل للأضيق عند الفشل) */
export const QUOTATION_CLIENT_EMBED_SELECTS = [
  'id, name, phone_wa, phone_number, phone',
  'id, name, phone_wa, phone_number',
  'id, name, phone_wa',
  'id, name, phone',
] as const;

export const QUOTATION_CLIENT_EMBED_SELECT = QUOTATION_CLIENT_EMBED_SELECTS[0];

/** يطابق القيم الإنجليزية في DB أو أي نص عربي مرن */
export function isQuotationStatusApproved(raw: unknown): boolean {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return false;
  if (s === 'approved' || s === 'confirmed') return true;
  return s.includes('اعتماد') || s.includes('مؤكد');
}

export function isQuotationStatusPending(raw: unknown): boolean {
  const s = String(raw ?? '').trim();
  if (!s) return false;
  if (isQuotationStatusApproved(s)) return false;
  if (s === 'pending_client' || s === 'draft') return true;
  return s.includes('انتظار') || s.includes('بانتظار');
}

function parseQuotationStatus(raw: unknown): QuotationStatus {
  const s = String(raw ?? '').trim();
  if (s === 'fully_paid') return 'fully_paid';
  if (s === 'deposit_paid') return 'deposit_paid';
  if (s === 'payment_confirmed') return 'payment_confirmed';
  if (s === 'awaiting_payment') return 'awaiting_payment';
  if (s === 'draft') return 'draft';
  if (s === 'needs_revision') return 'needs_revision';
  if (s === 'client_responded') return 'client_responded';
  if (s === 'pending_client') return 'pending_client';
  if (s === 'approved' || isQuotationStatusApproved(raw)) return 'approved';
  return 'pending_client';
}

/** ربح تلقائي من التكلفة ونسبة الهامش */
export function calculateProfitFromMargin(cost: number, marginPercent: number): number {
  const c = parseMoney(cost);
  const m = parseMoney(marginPercent);
  if (c <= 0 || m <= 0) return 0;
  return Math.round(((c * m) / 100) * 100) / 100;
}

/** الإجمالي للعميل = التكلفة + هامش الربح + رسوم الخدمة */
export function calculateQuotationGrandTotal(
  baseCost: number,
  marginPercent: number,
  serviceFee: number,
): number {
  const base = parseMoney(baseCost);
  const margin = calculateProfitFromMargin(base, marginPercent);
  const fee = parseMoney(serviceFee);
  return Math.round((base + margin + fee) * 100) / 100;
}

export function sumProposalPrices(
  ...groups: Array<Array<{ price?: number }>>
): number {
  let total = 0;
  for (const group of groups) {
    for (const row of group) {
      total += parseMoney(row.price);
    }
  }
  return Math.round(total * 100) / 100;
}

function newProposalId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyFlightProposal(): QuotationFlightProposal {
  return {
    id: newProposalId(),
    departureCity: '',
    arrivalCity: '',
    airline: '',
    flight_class: '',
    price: 0,
  };
}

export function createEmptyHotelProposal(): QuotationHotelProposal {
  return {
    id: newProposalId(),
    hotel_name: '',
    city: '',
    room_type: '',
    price: 0,
  };
}

export function createEmptyActivityProposal(): QuotationActivityProposal {
  return {
    id: newProposalId(),
    name: '',
    location: '',
    description: '',
    price: 0,
  };
}

export function createEmptyTransportProposal(): QuotationTransportProposal {
  return {
    id: newProposalId(),
    description: '',
    mode: '',
    price: 0,
  };
}

/** يضمن صفاً واحداً على الأقل لكل قسم */
export function ensureProposalRows<T>(rows: T[], createEmpty: () => T): T[] {
  return rows.length > 0 ? rows : [createEmpty()];
}

/** معرّف عرض السعر — UUID أو bigint كنص، بدون Number() */
export function normalizeQuotationId(raw: unknown): string {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return '';
    return String(Math.trunc(raw));
  }
  const s = String(raw).trim();
  if (!s || s === 'NaN' || s === 'undefined' || s === 'null') return '';
  return s;
}

const QUOTATION_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isQuotationUuid(id: string): boolean {
  return QUOTATION_UUID_RE.test(normalizeQuotationId(id));
}

/** يُستخدم في مسارات API و Server Actions */
export function resolveQuotationRouteId(raw: unknown): string {
  return normalizeQuotationId(raw);
}

/** مسار صفحة التعديل — quotations.id فقط */
export function buildQuotationEditPath(quotationId: string): string {
  const id = normalizeQuotationId(quotationId);
  if (!id) return '/crm/quotations';
  return `/crm/quotations/edit/${encodeURIComponent(id)}`;
}

/** مسار إنشاء عرض من طلب DNA — يمرّر leadId و clientId وبيانات التعبئة */
export type BuildQuotationNewFromLeadInput = {
  leadId: string;
  clientId?: string | number | null;
  tripTitle?: string;
  destination?: string;
  startDate?: string | null;
  endDate?: string | null;
  clientName?: string;
};

export function buildQuotationNewFromLeadPath(
  leadIdOrInput: string | BuildQuotationNewFromLeadInput,
  clientId?: string | number | null,
): string {
  const input: BuildQuotationNewFromLeadInput =
    typeof leadIdOrInput === 'string'
      ? { leadId: leadIdOrInput, clientId }
      : leadIdOrInput;

  const params = new URLSearchParams();
  params.set('from', 'lead');

  const lid = normalizeQuotationId(input.leadId);
  if (lid) params.set('leadId', lid);

  const cid =
    input.clientId != null && String(input.clientId).trim() !== ''
      ? normalizeQuotationId(input.clientId)
      : '';
  if (cid) {
    params.set('clientId', cid);
    params.set('client_id', cid);
  }

  const tripTitle = String(input.tripTitle ?? '').trim();
  if (tripTitle) {
    params.set('tripTitle', tripTitle);
    params.set('title', tripTitle);
  }

  const destination = String(input.destination ?? '').trim();
  if (destination && destination !== '—') {
    params.set('destination', destination);
    params.set('destinations', destination);
  }

  const startDate = String(input.startDate ?? '').trim().slice(0, 10);
  if (startDate) params.set('startDate', startDate);

  const endDate = String(input.endDate ?? '').trim().slice(0, 10);
  if (endDate) params.set('endDate', endDate);

  const clientName = String(input.clientName ?? '').trim();
  if (clientName) params.set('clientName', clientName);

  return `/crm/quotations/new?${params.toString()}`;
}

function quotationIdForQuery(id: string | number): string {
  const s = normalizeQuotationId(id);
  if (!s) throw new Error('معرّف العرض غير صالح.');
  return s;
}

/** bigint في Postgres — يُفضّل تمرير رقم عندما يكون المعرّف رقمياً */
export function coerceQuotationIdForDb(id: string | number): string | number {
  const key = quotationIdForQuery(id);
  if (/^\d+$/.test(key)) {
    const n = Number(key);
    if (Number.isSafeInteger(n) && n > 0) return n;
  }
  return key;
}

function quotationReferenceKey(raw: unknown): string {
  return normalizeQuotationId(raw).toLowerCase();
}

/** يبحث في قائمة العروض بـ quotations.id أو lead_id */
export function findQuotationInList(
  list: QuotationRow[],
  needle: string,
): QuotationRow | undefined {
  const key = quotationReferenceKey(needle);
  if (!key) return undefined;
  return list.find(
    (row) =>
      quotationReferenceKey(row.id) === key ||
      (row.lead_id != null && quotationReferenceKey(row.lead_id) === key),
  );
}

/** معرّف quotations.id للروابط — لا يُستخدم lead_id أبداً */
export function quotationEditId(row: Pick<QuotationRow, 'id' | 'lead_id'>): string {
  const pk = normalizeQuotationId(row.id);
  if (!pk || pk === 'new') return '';
  const leadId = row.lead_id ? normalizeQuotationId(row.lead_id) : '';
  if (leadId && pk === leadId) return '';
  return pk;
}

/** @deprecated alias — use quotationEditId */
export function quotationRouteId(row: Pick<QuotationRow, 'id' | 'lead_id'>): string {
  return quotationEditId(row);
}

/** هل العرض محفوظ فعلياً في quotations (وليس مسودة lead فقط) */
export function isQuotationPersisted(row: Pick<QuotationRow, 'id' | 'lead_id'>): boolean {
  return quotationEditId(row).length > 0;
}

/** معرّف محفوظ — bigint أو UUID؛ يستبعد "new" والقيم الفارغة */
export function isQuoteSavedId(id: string | null | undefined): boolean {
  const pk = normalizeQuotationId(id);
  return Boolean(pk && pk !== 'new');
}

/** @deprecated استخدم isQuoteSavedId */
export function isQuotationUuidSaved(id: string | null | undefined): boolean {
  return isQuoteSavedId(id);
}

/** معرّف الفواتير — quotations.id المحفوظ */
export function quotationInvoiceId(row: Pick<QuotationRow, 'id' | 'lead_id'>): string {
  return quotationEditId(row);
}

function parseMoney(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** يقبل id رقمي أو UUID من القائمة */
const CLIENT_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveQuotationClientId(raw: string | number): string | number {
  const s = String(raw ?? '').trim();
  if (!s) {
    throw new Error('اختر عميلاً صالحاً.');
  }
  if (CLIENT_ID_UUID_RE.test(s)) return s;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (Number.isSafeInteger(n) && n > 0) return n;
    return s;
  }
  throw new Error('اختر عميلاً صالحاً.');
}

function parseDestinations(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((d) => String(d).trim()).filter(Boolean);
}

function parseFlightProposals(raw: unknown): QuotationFlightProposal[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      return {
        id: String(o.id ?? `flight-${index}`),
        departureCity: String(o.departureCity ?? o.departure_city ?? '').trim(),
        arrivalCity: String(o.arrivalCity ?? o.arrival_city ?? '').trim(),
        airline: String(o.airline ?? '').trim(),
        flight_class: String(o.flight_class ?? o.flightClass ?? '').trim(),
        price: parseMoney(o.price),
      };
    })
    .filter(Boolean) as QuotationFlightProposal[];
}

function parseHotelProposals(raw: unknown): QuotationHotelProposal[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      return {
        id: String(o.id ?? `hotel-${index}`),
        hotel_name: String(o.hotel_name ?? o.hotelName ?? o.name ?? '').trim(),
        city: String(o.city ?? '').trim(),
        room_type: String(o.room_type ?? o.roomType ?? '').trim(),
        price: parseMoney(o.price),
      };
    })
    .filter(Boolean) as QuotationHotelProposal[];
}

function parseActivityProposals(raw: unknown): QuotationActivityProposal[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      return {
        id: String(o.id ?? `activity-${index}`),
        name: String(o.name ?? o.title ?? '').trim(),
        location: String(o.location ?? o.place ?? '').trim(),
        description: String(o.description ?? o.notes ?? '').trim(),
        price: parseMoney(o.price),
      };
    })
    .filter(Boolean) as QuotationActivityProposal[];
}

function parseTransportProposals(raw: unknown): QuotationTransportProposal[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      return {
        id: String(o.id ?? `transport-${index}`),
        description: String(o.description ?? o.notes ?? '').trim(),
        mode: String(o.mode ?? o.type ?? o.title ?? o.vehicle ?? '').trim(),
        price: parseMoney(o.price),
      };
    })
    .filter(Boolean) as QuotationTransportProposal[];
}

function pickJsonbArray(row: Record<string, unknown>, ...keys: string[]): unknown {
  let fallback: unknown = null;
  for (const key of keys) {
    if (!(key in row) || row[key] == null) continue;
    const val = row[key];
    if (Array.isArray(val)) {
      if (val.length > 0) return val;
      if (fallback == null) fallback = val;
      continue;
    }
    return val;
  }
  return fallback;
}

/** عناصر الفعاليات لعرض العميل — يدعم name/title */
export type ClientQuoteActivity = {
  title: string;
  description: string;
  location: string;
  price: number;
};

/** عناصر المواصلات لعرض العميل — يدعم mode/type/title */
export type ClientQuoteTransport = {
  title: string;
  type: string;
  description: string;
  price: number;
};

function parseClientActivitiesRaw(raw: unknown): ClientQuoteActivity[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const title = String(o.title ?? o.name ?? '').trim();
      const description = String(o.description ?? o.notes ?? '').trim();
      const location = String(o.location ?? o.place ?? '').trim();
      const price = parseMoney(o.price);
      if (!title && !description && !location && price <= 0) return null;
      return { title: title || '—', description, location, price };
    })
    .filter(Boolean) as ClientQuoteActivity[];
}

function parseClientTransportRaw(raw: unknown): ClientQuoteTransport[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const type = String(o.type ?? o.mode ?? o.vehicle ?? '').trim();
      const title = String(o.title ?? o.name ?? type ?? '').trim();
      const description = String(o.description ?? o.notes ?? o.route ?? '').trim();
      const price = parseMoney(o.price);
      if (!title && !type && !description && price <= 0) return null;
      return {
        title: title || type || '—',
        type: type || title,
        description,
        price,
      };
    })
    .filter(Boolean) as ClientQuoteTransport[];
}

/** يدمج activities_proposals و activities (وأي alias) لصفحة العميل */
export function extractClientQuoteActivities(
  row: QuotationRow | Record<string, unknown>,
): ClientQuoteActivity[] {
  const record = row as Record<string, unknown>;
  const mapped = mapQuotationRow(record);

  const fromProposals = mapped.activities_proposals
    .filter((a) => a.name || a.location || a.description || a.price > 0)
    .map((a) => ({
      title: a.name || '—',
      description: a.description,
      location: a.location,
      price: a.price,
    }));

  const fromRaw = parseClientActivitiesRaw(
    pickJsonbArray(record, 'activities', 'activities_details', 'activitiesDetails'),
  );

  const seen = new Set<string>();
  const merged: ClientQuoteActivity[] = [];
  for (const item of [...fromProposals, ...fromRaw]) {
    const key = `${item.title}|${item.description}|${item.location}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

/** يدمج transport_proposals و transportation (وأي alias) لصفحة العميل */
export function extractClientQuoteTransportation(
  row: QuotationRow | Record<string, unknown>,
): ClientQuoteTransport[] {
  const record = row as Record<string, unknown>;
  const mapped = mapQuotationRow(record);

  const fromProposals = mapped.transport_proposals
    .filter((t) => t.description || t.mode || t.price > 0)
    .map((t) => ({
      title: t.mode || t.description || '—',
      type: t.mode,
      description: t.description,
      price: t.price,
    }));

  const fromRaw = parseClientTransportRaw(
    pickJsonbArray(record, 'transportation', 'transport_details', 'transportDetails'),
  );

  const seen = new Set<string>();
  const merged: ClientQuoteTransport[] = [];
  for (const item of [...fromProposals, ...fromRaw]) {
    const key = `${item.title}|${item.type}|${item.description}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

/** JSON للحفظ في أعمدة activities / transportation (توافق العرض للعميل) */
export function serializeActivitiesForClientColumn(
  rows: QuotationActivityProposal[] | null | undefined,
): Record<string, unknown>[] {
  const saved = serializeActivityProposalsForSave(rows ?? []);
  return Array.isArray(saved)
    ? saved.map((row) => ({
        ...row,
        title: row.name,
      }))
    : [];
}

export function serializeTransportationForClientColumn(
  rows: QuotationTransportProposal[] | null | undefined,
): Record<string, unknown>[] {
  const saved = serializeTransportProposalsForSave(rows ?? []);
  return Array.isArray(saved)
    ? saved.map((row) => ({
        ...row,
        type: row.mode,
        title: row.mode || row.description,
      }))
    : [];
}

/** أعمدة quotations المطلوبة لصفحة العميل */
export const PUBLIC_QUOTATION_SELECT =
  'id, client_id, lead_id, title, destinations, start_date, end_date, total_estimated_cost, expected_profit, status, flight_proposals, hotel_proposals, activities, transportation, profit_margin, service_fee, grand_total, lead_source, expert_name, created_at, itinerary_days, hotel_options, transport_options, activity_options, cost_breakdown, client_feedback, clients(id, name, phone_wa), lead:leads(id, full_name, phone_wa)';

/** أعمدة هاتف العميل المحتملة في clients */
const CLIENT_PHONE_KEYS = ['phone_wa', 'phone_number', 'phone'] as const;

/** يختار أول رقم هاتف غير فارغ من صف clients */
export function pickClientPhoneFromRecord(
  record: Record<string, unknown> | null | undefined,
): string {
  if (!record) return '';
  for (const key of CLIENT_PHONE_KEYS) {
    const value = String(record[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

/** يوحّد صف clients المضمّن (اسم + هاتف) لصفوف عروض الأسعار */
export function mapQuotationClientEmbed(raw: unknown): QuotationRow['clients'] | null {
  if (!raw) return null;
  const record = Array.isArray(raw) ? raw[0] : raw;
  if (!record || typeof record !== 'object') return null;
  const o = record as Record<string, unknown>;
  const idRaw = o.id;
  const id =
    idRaw != null && String(idRaw).trim() !== ''
      ? Number.isFinite(Number(idRaw))
        ? Number(idRaw)
        : undefined
      : undefined;
  const name = String(o.name ?? '').trim() || null;
  const phone = pickClientPhoneFromRecord(o);
  if (!id && !name && !phone) return null;
  return { id, name, phone_wa: phone || null };
}

export function mapQuotationRow(row: Record<string, unknown>): QuotationRow {
  const status = parseQuotationStatus(row.status);
  let clients = mapQuotationClientEmbed(row.clients ?? row.client);

  // Merge lead contact when clients embed is empty / incomplete
  const leadRaw = row.leads ?? row.lead;
  const leadRecord = Array.isArray(leadRaw) ? leadRaw[0] : leadRaw;
  if (leadRecord && typeof leadRecord === 'object') {
    const lead = leadRecord as Record<string, unknown>;
    const leadName = String(lead.full_name ?? lead.name ?? '').trim();
    const leadPhone =
      pickClientPhoneFromRecord(lead) || String(lead.phone_wa ?? '').trim();
    if (leadName || leadPhone) {
      clients = {
        id: clients?.id,
        name: clients?.name || leadName || null,
        phone_wa: clients?.phone_wa || leadPhone || null,
      };
    }
  }

  const leadId = row.lead_id != null ? normalizeQuotationId(row.lead_id) || null : null;
  const tripCategoryRaw = String(row.trip_category ?? 'private').trim();
  const trip_category: QuotationTripCategory =
    tripCategoryRaw === 'group' ? 'group' : 'private';

  return {
    id: normalizeQuotationId(row.id),
    lead_id: leadId,
    client_id:
      row.client_id != null
        ? normalizeQuotationId(row.client_id) || null
        : clients?.id != null
          ? String(clients.id)
          : null,
    title: String(row.title ?? '').trim(),
    destinations: parseDestinations(row.destinations),
    start_date: row.start_date != null ? String(row.start_date).slice(0, 10) : null,
    end_date: row.end_date != null ? String(row.end_date).slice(0, 10) : null,
    total_estimated_cost: parseMoney(row.total_estimated_cost),
    expected_profit: parseMoney(row.expected_profit),
    status,
    paid_amount: parseMoney(row.paid_amount),
    remaining_amount: parseMoney(row.remaining_amount),
    trip_category,
    flight_proposals: parseFlightProposals(
      pickJsonbArray(row, 'flight_proposals', 'flights_details', 'flightsDetails'),
    ),
    hotel_proposals: parseHotelProposals(
      pickJsonbArray(row, 'hotel_proposals', 'hotels_details', 'hotelsDetails'),
    ),
    activities_proposals: parseActivityProposals(
      pickJsonbArray(
        row,
        'activities',
        'activities_proposals',
        'activities_details',
        'activitiesDetails',
      ),
    ),
    transport_proposals: parseTransportProposals(
      pickJsonbArray(
        row,
        'transportation',
        'transport_proposals',
        'transport_details',
        'transportDetails',
      ),
    ),
    profit_margin: parseMoney(row.profit_margin ?? 20),
    service_fee: parseMoney(row.service_fee),
    grand_total: parseMoney(row.grand_total),
    lead_source: row.lead_source != null ? String(row.lead_source).trim() || null : null,
    referral_code:
      row.referral_code != null ? String(row.referral_code).trim() || null : null,
    is_referral_paid: row.is_referral_paid === true,
    expert_name: row.expert_name != null ? String(row.expert_name).trim() || null : null,
    expert_id: row.expert_id != null ? String(row.expert_id).trim() || null : null,
    created_at: String(row.created_at ?? ''),
    itinerary_days: parseItineraryDays(row.itinerary_days),
    hotel_options: parseHotelOptions(row.hotel_options),
    transport_options: parseTransportOptions(row.transport_options),
    activity_options: (() => {
      const fromCol = parseActivityOptions(row.activity_options);
      if (fromCol.length > 0) return fromCol;
      return parseActivityProposals(
        pickJsonbArray(
          row,
          'activities',
          'activities_proposals',
          'activities_details',
          'activitiesDetails',
        ),
      ).map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        price: a.price,
        is_selected_by_client: false,
      }));
    })(),
    cost_breakdown: parseCostBreakdown(row.cost_breakdown),
    client_feedback: parseClientFeedback(row.client_feedback),
    clients,
  };
}

export function quotationClientName(row: QuotationRow): string {
  const c = row.clients;
  return String(c?.name ?? '').trim() || '—';
}

export function quotationClientPhone(row: QuotationRow): string {
  return pickClientPhoneFromRecord(row.clients as Record<string, unknown> | null | undefined);
}

export function quotationTotalPrice(row: QuotationRow): number {
  if (row.grand_total > 0) return row.grand_total;
  return calculateQuotationGrandTotal(
    row.total_estimated_cost,
    row.profit_margin,
    row.service_fee,
  );
}

export function formatDestinationsLabel(destinations: string[]): string {
  if (!destinations.length) return '—';
  return destinations.join(' · ');
}

export function serializeFlightProposalsForSave(
  rows: QuotationFlightProposal[],
): Record<string, unknown>[] {
  return rows
    .filter(
      (r) =>
        String(r?.departureCity ?? '').trim() ||
        String(r?.arrivalCity ?? '').trim() ||
        String(r?.airline ?? '').trim() ||
        String(r?.flight_class ?? '').trim() ||
        Number(r?.price) > 0,
    )
    .map((r) => ({
      id: r.id,
      departureCity: String(r.departureCity ?? '').trim(),
      arrivalCity: String(r.arrivalCity ?? '').trim(),
      airline: String(r.airline ?? '').trim(),
      flight_class: String(r.flight_class ?? '').trim(),
      price: parseMoney(r.price),
    }));
}

export function serializeHotelProposalsForSave(
  rows: QuotationHotelProposal[],
): Record<string, unknown>[] {
  return rows
    .filter(
      (r) =>
        String(r?.hotel_name ?? '').trim() ||
        String(r?.city ?? '').trim() ||
        String(r?.room_type ?? '').trim() ||
        Number(r?.price) > 0,
    )
    .map((r) => ({
      id: r.id,
      hotel_name: String(r.hotel_name ?? '').trim(),
      city: String(r.city ?? '').trim(),
      room_type: String(r.room_type ?? '').trim(),
      price: parseMoney(r.price),
    }));
}

export function serializeActivityProposalsForSave(
  rows: QuotationActivityProposal[],
): Record<string, unknown>[] {
  return rows
    .filter(
      (r) =>
        String(r?.name ?? '').trim() ||
        String(r?.location ?? '').trim() ||
        String(r?.description ?? '').trim() ||
        Number(r?.price) > 0,
    )
    .map((r) => ({
      id: r.id,
      name: String(r.name ?? '').trim(),
      location: String(r.location ?? '').trim(),
      description: String(r.description ?? '').trim(),
      price: parseMoney(r.price),
    }));
}

export function serializeTransportProposalsForSave(
  rows: QuotationTransportProposal[],
): Record<string, unknown>[] {
  return rows
    .filter(
      (r) =>
        String(r?.description ?? '').trim() ||
        String(r?.mode ?? '').trim() ||
        Number(r?.price) > 0,
    )
    .map((r) => ({
      id: r.id,
      description: String(r.description ?? '').trim(),
      mode: String(r.mode ?? '').trim(),
      price: parseMoney(r.price),
    }));
}

export async function insertQuotation(input: QuotationInsertInput): Promise<string> {
  if (!supabase) throw new Error('Supabase غير مهيأ.');

  const clientId = resolveQuotationClientId(input.clientId);
  const titleSafe = String(input.title ?? '').trim();
  const startSafe = String(input.startDate ?? '').trim();
  const endSafe = String(input.endDate ?? '').trim();
  if (!titleSafe) throw new Error('أدخل عنوان الرحلة.');
  if (!input.destinations.length) throw new Error('أضف وجهة واحدة على الأقل.');
  if (!startSafe) throw new Error('أدخل تاريخ البداية.');
  if (!endSafe) throw new Error('أدخل تاريخ النهاية.');
  if (endSafe < startSafe) throw new Error('تاريخ النهاية يجب أن يكون بعد البداية.');

  const payload = {
    client_id: clientId,
    title: titleSafe,
    destinations: input.destinations,
    start_date: startSafe,
    end_date: endSafe,
    total_estimated_cost: parseMoney(input.totalEstimatedCost),
    expected_profit: parseMoney(input.expectedProfit),
    status: 'pending_client' as const,
    flight_proposals: serializeFlightProposalsForSave(input.flightProposals),
    hotel_proposals: serializeHotelProposalsForSave(input.hotelProposals),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('quotations').insert(payload).select().single();
  const insertedId = normalizeQuotationId(data?.id);
  if (error || !insertedId) {
    throw new Error(error?.message || 'تعذر حفظ عرض السعر. نفّذ supabase/sql/quotations.sql');
  }
  return insertedId;
}

export async function fetchQuotationsList(): Promise<QuotationRow[]> {
  if (!supabase) return [];

  const withLeadEmbed = await supabase
    .from('quotations')
    .select(
      'id, client_id, lead_id, title, destinations, start_date, end_date, total_estimated_cost, expected_profit, status, flight_proposals, hotel_proposals, created_at, updated_at, client_feedback, expert_name, client:clients(id, name, phone_wa), lead:leads(id, full_name, phone_wa)',
    )
    .order('created_at', { ascending: false });

  let data = withLeadEmbed.data;
  let error = withLeadEmbed.error;

  if (error) {
    // FK embed may be missing — still pull lead_id and attach contacts separately
    const fallback = await supabase
      .from('quotations')
      .select(
        'id, client_id, lead_id, title, destinations, start_date, end_date, total_estimated_cost, expected_profit, status, flight_proposals, hotel_proposals, created_at, updated_at, client_feedback, expert_name, client:clients(id, name, phone_wa)',
      )
      .order('created_at', { ascending: false });
    data = fallback.data as typeof withLeadEmbed.data;
    error = fallback.error;
  }

  if (error && /expert_name/i.test(error.message)) {
    const noExpert = await supabase
      .from('quotations')
      .select(
        'id, client_id, lead_id, title, destinations, start_date, end_date, total_estimated_cost, expected_profit, status, flight_proposals, hotel_proposals, created_at, updated_at, client_feedback, client:clients(id, name, phone_wa)',
      )
      .order('created_at', { ascending: false });
    data = noExpert.data as typeof withLeadEmbed.data;
    error = noExpert.error;
  }

  if (error && /client_feedback/i.test(error.message)) {
    const noFeedback = await supabase
      .from('quotations')
      .select(
        'id, client_id, lead_id, title, destinations, start_date, end_date, total_estimated_cost, expected_profit, status, flight_proposals, hotel_proposals, created_at, updated_at, client:clients(id, name, phone_wa)',
      )
      .order('created_at', { ascending: false });
    data = noFeedback.data as typeof withLeadEmbed.data;
    error = noFeedback.error;
  }

  if (error) throw new Error(error.message || 'تعذر تحميل عروض الأسعار.');

  const mapped = (data ?? [])
    .map((row) => mapQuotationRow(row as Record<string, unknown>))
    .filter((row) => Boolean(row.id));

  return attachLeadContactsToQuotationRows(mapped);
}

async function attachLeadContactsToQuotationRows(
  rows: QuotationRow[],
): Promise<QuotationRow[]> {
  if (!supabase || !rows.length) return rows;

  const needsContact = rows.filter(
    (r) => quotationClientName(r) === '—' || !quotationClientPhone(r),
  );
  if (!needsContact.length) return rows;

  const leadIds = [
    ...new Set(needsContact.map((r) => r.lead_id).filter((id): id is string => Boolean(id))),
  ];

  const byLeadId = new Map<string, { name: string; phone: string }>();

  if (leadIds.length) {
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, full_name, phone_wa')
      .in('id', leadIds);
    if (error) console.warn('[quotations] leads contact fallback:', error.message);
    for (const lead of leads ?? []) {
      const key = normalizeQuotationId((lead as { id?: unknown }).id);
      if (!key) continue;
      byLeadId.set(key, {
        name: String((lead as { full_name?: unknown }).full_name ?? '').trim(),
        phone: String((lead as { phone_wa?: unknown }).phone_wa ?? '').trim(),
      });
    }
  }

  // Skip leads.client_id lookup — column often missing until clients_intake_pipeline.sql

  if (!byLeadId.size) return rows;

  return rows.map((row) => {
    const currentName = quotationClientName(row);
    const currentPhone = quotationClientPhone(row);
    if (currentName !== '—' && currentPhone) return row;

    const fromLead = row.lead_id ? byLeadId.get(normalizeQuotationId(row.lead_id)) : undefined;
    if (!fromLead || (!fromLead.name && !fromLead.phone)) return row;

    return {
      ...row,
      clients: {
        ...row.clients,
        id: row.clients?.id,
        name: currentName !== '—' ? row.clients?.name : fromLead.name || row.clients?.name || null,
        phone_wa: currentPhone || fromLead.phone || row.clients?.phone_wa || null,
      },
    };
  });
}

export async function cloneQuotation(sourceId: string | number): Promise<string> {
  if (!supabase) throw new Error('Supabase غير مهيأ.');

  const { data: source, error: fetchErr } = await supabase
    .from('quotations')
    .select('*')
    .eq('id', quotationIdForQuery(sourceId))
    .single();

  if (fetchErr || !source) {
    throw new Error(fetchErr?.message || 'تعذر قراءة العرض للاستنساخ.');
  }

  const row = source as Record<string, unknown>;
  const baseTitle = String(row.title ?? '').trim() || 'عرض سعر';
  const prefixed = baseTitle.startsWith('نسخة من ') ? baseTitle : `نسخة من ${baseTitle}`;

  const payload = {
    client_id: row.client_id ?? null,
    title: prefixed,
    destinations: parseDestinations(row.destinations),
    start_date: row.start_date != null ? String(row.start_date).slice(0, 10) : null,
    end_date: row.end_date != null ? String(row.end_date).slice(0, 10) : null,
    total_estimated_cost: parseMoney(row.total_estimated_cost),
    expected_profit: parseMoney(row.expected_profit),
    status: 'draft' as const,
    flight_proposals: row.flight_proposals ?? [],
    hotel_proposals: row.hotel_proposals ?? [],
    activities: pickJsonbArray(row, 'activities', 'activities_proposals') ?? [],
    transportation: pickJsonbArray(row, 'transportation', 'transport_proposals') ?? [],
    profit_margin: parseMoney(row.profit_margin ?? 20),
    service_fee: parseMoney(row.service_fee),
    grand_total: parseMoney(row.grand_total),
    updated_at: new Date().toISOString(),
  };

  let insertRes = await supabase.from('quotations').insert(payload).select().single();
  if (insertRes.error && /status|check|draft/i.test(insertRes.error.message ?? '')) {
    insertRes = await supabase
      .from('quotations')
      .insert({ ...payload, status: 'pending_client' })
      .select()
      .single();
  }

  const clonedId = normalizeQuotationId(insertRes.data?.id);
  if (insertRes.error || !clonedId) {
    throw new Error(insertRes.error?.message || 'تعذر استنساخ العرض.');
  }
  return clonedId;
}

export type QuotationHotelPlace = {
  id: string;
  name: string;
  city: string;
  country: string;
  category: string;
  /** غير مستخدم في جدول hotels — يبقى للتوافق */
  room_types: string[];
};

function mapHotelsTableRow(row: Record<string, unknown>): QuotationHotelPlace | null {
  const name = String(row.name ?? '').trim();
  if (!name) return null;
  return {
    id: String(row.id),
    name,
    city: String(row.city ?? '').trim(),
    country: String(row.country ?? '').trim(),
    category: String(row.category ?? 'smart_choice'),
    room_types: [],
  };
}

/** توحيد كتابة العربية للمقارنة — همزات، ta marbuta، مسافات */
export function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ؤو]/g, 'و')
    .replace(/[ئيى]/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
    .toLowerCase();
}

function normPlaceText(value: string): string {
  return normalizeArabic(value);
}

/** مطابقة الوجهة المختارة مع city أو country في جدول hotels */
export function hotelMatchesDestination(
  hotel: QuotationHotelPlace,
  destination: string,
): boolean {
  const sel = String(destination ?? '').trim();
  if (!sel) return false;
  const selNorm = normalizeArabic(sel);
  const cityRaw = String(hotel.city ?? '').trim();
  const countryRaw = String(hotel.country ?? '').trim();
  const cityNorm = normalizeArabic(cityRaw);
  const countryNorm = normalizeArabic(countryRaw);

  return (
    Boolean(cityNorm && cityNorm === selNorm) ||
    Boolean(countryNorm && countryNorm === selNorm) ||
    Boolean(cityRaw && (cityRaw.includes(sel) || sel.includes(cityRaw))) ||
    Boolean(countryRaw && (countryRaw.includes(sel) || sel.includes(countryRaw)))
  );
}

/** Keep first occurrence per normalized name (+ optional city key). */
export function dedupeQuotationHotelPlaces(
  places: QuotationHotelPlace[],
  scope: 'name' | 'name+city' = 'name+city',
): QuotationHotelPlace[] {
  const seen = new Set<string>();
  const out: QuotationHotelPlace[] = [];
  for (const place of places) {
    const nameKey = normPlaceText(place.name);
    if (!nameKey) continue;
    const key =
      scope === 'name'
        ? nameKey
        : `${nameKey}::${normPlaceText(place.city) || normPlaceText(place.country)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(place);
  }
  return out;
}

export async function fetchQuotationHotelPlaces(): Promise<QuotationHotelPlace[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('hotels')
    .select('id, name, country, city, category')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message || 'تعذر تحميل قاعدة الفنادق.');
  }

  const mapped = (data ?? [])
    .map((row) => mapHotelsTableRow(row as Record<string, unknown>))
    .filter((h): h is QuotationHotelPlace => h != null);

  return dedupeQuotationHotelPlaces(mapped, 'name+city');
}

export function filterQuotationHotelsByCity(
  places: QuotationHotelPlace[],
  destinationInput: string,
): QuotationHotelPlace[] {
  if (!String(destinationInput ?? '').trim()) return [];
  const matched = places.filter((place) =>
    hotelMatchesDestination(place, destinationInput),
  );
  // Dropdown must show each hotel name once for the selected city/destination
  return dedupeQuotationHotelPlaces(matched, 'name');
}

export function findQuotationHotelPlace(
  places: QuotationHotelPlace[],
  hotelName: string,
  destination: string,
): QuotationHotelPlace | undefined {
  const nameNorm = normPlaceText(hotelName);
  if (!nameNorm) return undefined;
  return places.find(
    (p) =>
      normPlaceText(p.name) === nameNorm &&
      (!String(destination ?? '').trim() || hotelMatchesDestination(p, destination)),
  );
}

export function hotelExistsInQuotationPlaces(
  places: QuotationHotelPlace[],
  hotelName: string,
  city: string,
): boolean {
  return Boolean(findQuotationHotelPlace(places, hotelName, city));
}

/** حفظ فندق جديد صامتاً في جدول hotels عند إضافة مقترح فندق */
export async function silentInsertQuotationHotelPlace(input: {
  hotelName: string;
  city: string;
  roomType: string;
}): Promise<QuotationHotelPlace | null> {
  if (!supabase) return null;

  const name = String(input.hotelName ?? '').trim();
  if (!name) return null;

  const city = String(input.city ?? '').trim();
  const roomType = String(input.roomType ?? '').trim();

  const payload = {
    name,
    city: city || '',
    country: city || 'غير محدد',
    category: 'smart_choice' as const,
    notes: roomType ? `نوع الغرفة (عرض سعر): ${roomType}` : null,
  };

  const res = await supabase
    .from('hotels')
    .insert(payload)
    .select('id, name, country, city, category')
    .single();

  if (res.error || !res.data) {
    console.warn('silentInsertQuotationHotelPlace (hotels):', res.error?.message);
    return null;
  }

  return mapHotelsTableRow(res.data as Record<string, unknown>);
}

export async function fetchQuotationById(id: string | number): Promise<QuotationRow | null> {
  if (!supabase) throw new Error('Supabase غير مهيأ.');
  const key = quotationIdForQuery(id);

  let data: Record<string, unknown> | null = null;

  const primary = await supabase
    .from('quotations')
    .select(PUBLIC_QUOTATION_SELECT)
    .eq('id', key)
    .maybeSingle();

  if (!primary.error && primary.data) {
    data = primary.data as Record<string, unknown>;
  } else {
    const fallback = await supabase
      .from('quotations')
      .select('*, clients(id, name, phone_wa)')
      .eq('id', key)
      .maybeSingle();
    if (fallback.error) {
      throw new Error(fallback.error.message || primary.error?.message || 'تعذر تحميل عرض السعر.');
    }
    data = (fallback.data as Record<string, unknown> | null) ?? null;
  }

  if (!data) return null;
  return mapQuotationRow(data);
}

export async function approveQuotation(id: string | number): Promise<void> {
  if (!supabase) throw new Error('Supabase غير مهيأ.');

  const key = quotationIdForQuery(id);
  const { data, error } = await supabase
    .from('quotations')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', key)
    .select('id, status')
    .single();

  if (error) {
    console.error('Approval Update Error:', error);
    throw new Error(error.message || 'تعذر اعتماد العرض.');
  }
  if (!data || !isQuotationStatusApproved(data.status)) {
    throw new Error('لم يُحفظ الاعتماد — تحقق من صلاحيات قاعدة البيانات.');
  }

  // EVENT C — approved quote → Kanban awaiting_payment
  try {
    const { data: full } = await supabase
      .from('quotations')
      .select('lead_id, client_id')
      .eq('id', key)
      .maybeSingle();
    await updatePipelineStatus(
      supabase,
      {
        leadId: (full as { lead_id?: string | null } | null)?.lead_id ?? null,
        clientId: (full as { client_id?: string | number | null } | null)?.client_id ?? null,
        force: true,
      },
      'awaiting_payment',
    );
  } catch (pipelineErr) {
    console.warn('[approveQuotation] pipeline awaiting_payment:', pipelineErr);
  }

  try {
    const reward = await processReferralRewardForQuotation(supabase, key);
    if (reward.processed) {
      console.log('[referral-reward] credited referrer', reward.referrerId, reward.amount);
    }
  } catch (rewardError) {
    console.error('[referral-reward] after approval:', rewardError);
  }

  // Best-effort: push into active individual routes (idempotent)
  try {
    const { createItineraryFromApprovedQuotation } = await import('@/lib/quotation-to-itinerary');
    const full = await fetchQuotationById(key);
    if (full) {
      await createItineraryFromApprovedQuotation(
        { ...full, status: 'approved' },
        supabase,
        { status: 'active' },
      );
    }
  } catch (itineraryErr) {
    console.warn('[approveQuotation] itinerary auto-create:', itineraryErr);
  }
}

export async function deleteQuotation(id: string | number): Promise<void> {
  if (!supabase) throw new Error('Supabase غير مهيأ.');

  const key = quotationIdForQuery(id);
  const { error } = await supabase.from('quotations').delete().eq('id', key);
  if (error) throw new Error(error.message || 'تعذر حذف عرض السعر.');
}

export function formatQuotationDateRange(start: string | null, end: string | null): string {
  if (!start) return 'التواريخ قريباً';
  const fmt = (iso: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return iso;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const s = fmt(start);
  if (!end || end === start) return s;
  return `${s} — ${fmt(end)}`;
}
