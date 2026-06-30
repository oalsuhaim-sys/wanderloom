import { supabase } from '@/lib/supabase';
import { processReferralRewardForQuotation } from '@/lib/referral-rewards';

export type QuotationStatus = 'draft' | 'pending_client' | 'approved';

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
  client_id: string | null;
  title: string;
  destinations: string[];
  start_date: string | null;
  end_date: string | null;
  total_estimated_cost: number;
  expected_profit: number;
  status: QuotationStatus;
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
  created_at: string;
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
  draft: 'مسودة 📝',
  pending_client: 'بانتظار العميل ⏳',
  approved: 'تم الاعتماد ✨',
};

/** يطابق القيم الإنجليزية في DB أو أي نص عربي مرن */
export function isQuotationStatusApproved(raw: unknown): boolean {
  const s = String(raw ?? '').trim();
  if (!s) return false;
  if (s === 'approved') return true;
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
  if (isQuotationStatusApproved(raw)) return 'approved';
  const s = String(raw ?? '').trim();
  if (s === 'draft') return 'draft';
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

function quotationIdForQuery(id: string | number): string {
  const s = normalizeQuotationId(id);
  if (!s) throw new Error('معرّف العرض غير صالح.');
  return s;
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
        mode: String(o.mode ?? o.type ?? o.vehicle ?? '').trim(),
        price: parseMoney(o.price),
      };
    })
    .filter(Boolean) as QuotationTransportProposal[];
}

function pickJsonbArray(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (key in row && row[key] != null) return row[key];
  }
  return null;
}

export function mapQuotationRow(row: Record<string, unknown>): QuotationRow {
  const status = parseQuotationStatus(row.status);
  const rawClients = row.clients ?? row.client;
  const clients =
    rawClients && typeof rawClients === 'object' && !Array.isArray(rawClients)
      ? (rawClients as QuotationRow['clients'])
      : Array.isArray(rawClients)
        ? (rawClients[0] as QuotationRow['clients'])
        : null;

  return {
    id: normalizeQuotationId(row.id),
    client_id: row.client_id != null ? normalizeQuotationId(row.client_id) || null : null,
    title: String(row.title ?? '').trim(),
    destinations: parseDestinations(row.destinations),
    start_date: row.start_date != null ? String(row.start_date).slice(0, 10) : null,
    end_date: row.end_date != null ? String(row.end_date).slice(0, 10) : null,
    total_estimated_cost: parseMoney(row.total_estimated_cost),
    expected_profit: parseMoney(row.expected_profit),
    status,
    flight_proposals: parseFlightProposals(
      pickJsonbArray(row, 'flight_proposals', 'flights_details', 'flightsDetails'),
    ),
    hotel_proposals: parseHotelProposals(
      pickJsonbArray(row, 'hotel_proposals', 'hotels_details', 'hotelsDetails'),
    ),
    activities_proposals: parseActivityProposals(
      pickJsonbArray(row, 'activities_proposals', 'activities_details', 'activitiesDetails'),
    ),
    transport_proposals: parseTransportProposals(
      pickJsonbArray(row, 'transport_proposals', 'transport_details', 'transportDetails'),
    ),
    profit_margin: parseMoney(row.profit_margin ?? 20),
    service_fee: parseMoney(row.service_fee),
    grand_total: parseMoney(row.grand_total),
    lead_source: row.lead_source != null ? String(row.lead_source).trim() || null : null,
    referral_code:
      row.referral_code != null ? String(row.referral_code).trim() || null : null,
    is_referral_paid: row.is_referral_paid === true,
    created_at: String(row.created_at ?? ''),
    clients,
  };
}

export function quotationClientName(row: QuotationRow): string {
  const c = row.clients;
  return String(c?.name ?? '').trim() || '—';
}

export function quotationClientPhone(row: QuotationRow): string {
  const c = row.clients;
  return String(c?.phone_wa ?? '').trim();
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
        r.departureCity.trim() ||
        r.arrivalCity.trim() ||
        r.airline.trim() ||
        r.flight_class.trim() ||
        r.price > 0,
    )
    .map((r) => ({
      id: r.id,
      departureCity: r.departureCity.trim(),
      arrivalCity: r.arrivalCity.trim(),
      airline: r.airline.trim(),
      flight_class: r.flight_class.trim(),
      price: parseMoney(r.price),
    }));
}

export function serializeHotelProposalsForSave(
  rows: QuotationHotelProposal[],
): Record<string, unknown>[] {
  return rows
    .filter((r) => r.hotel_name.trim() || r.city.trim() || r.room_type.trim() || r.price > 0)
    .map((r) => ({
      id: r.id,
      hotel_name: r.hotel_name.trim(),
      city: r.city.trim(),
      room_type: r.room_type.trim(),
      price: parseMoney(r.price),
    }));
}

export function serializeActivityProposalsForSave(
  rows: QuotationActivityProposal[],
): Record<string, unknown>[] {
  return rows
    .filter((r) => r.name.trim() || r.description.trim() || r.price > 0)
    .map((r) => ({
      id: r.id,
      name: r.name.trim(),
      description: r.description.trim(),
      price: parseMoney(r.price),
    }));
}

export function serializeTransportProposalsForSave(
  rows: QuotationTransportProposal[],
): Record<string, unknown>[] {
  return rows
    .filter((r) => r.description.trim() || r.mode.trim() || r.price > 0)
    .map((r) => ({
      id: r.id,
      description: r.description.trim(),
      mode: r.mode.trim(),
      price: parseMoney(r.price),
    }));
}

export async function insertQuotation(input: QuotationInsertInput): Promise<string> {
  if (!supabase) throw new Error('Supabase غير مهيأ.');

  const clientId = resolveQuotationClientId(input.clientId);
  if (!input.title.trim()) throw new Error('أدخل عنوان الرحلة.');
  if (!input.destinations.length) throw new Error('أضف وجهة واحدة على الأقل.');
  if (!input.startDate.trim()) throw new Error('أدخل تاريخ البداية.');
  if (!input.endDate.trim()) throw new Error('أدخل تاريخ النهاية.');
  if (input.endDate < input.startDate) throw new Error('تاريخ النهاية يجب أن يكون بعد البداية.');

  const payload = {
    client_id: clientId,
    title: input.title.trim(),
    destinations: input.destinations,
    start_date: input.startDate.trim(),
    end_date: input.endDate.trim(),
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

  const { data, error } = await supabase
    .from('quotations')
    .select(
      'id, client_id, title, destinations, start_date, end_date, total_estimated_cost, expected_profit, status, flight_proposals, hotel_proposals, created_at, updated_at, client:clients(id, name, phone_wa)',
    )
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message || 'تعذر تحميل عروض الأسعار.');
  return (data ?? [])
    .map((row) => mapQuotationRow(row as Record<string, unknown>))
    .filter((row) => Boolean(row.id));
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
    activities_proposals: row.activities_proposals ?? [],
    transport_proposals: row.transport_proposals ?? [],
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
  const sel = destination.trim();
  if (!sel) return false;
  const selNorm = normalizeArabic(sel);
  const cityRaw = hotel.city.trim();
  const countryRaw = hotel.country.trim();
  const cityNorm = normalizeArabic(cityRaw);
  const countryNorm = normalizeArabic(countryRaw);

  return (
    (cityNorm && cityNorm === selNorm) ||
    (countryNorm && countryNorm === selNorm) ||
    (cityRaw && (cityRaw.includes(sel) || sel.includes(cityRaw))) ||
    (countryRaw && (countryRaw.includes(sel) || sel.includes(countryRaw)))
  );
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

  return (data ?? [])
    .map((row) => mapHotelsTableRow(row as Record<string, unknown>))
    .filter((h): h is QuotationHotelPlace => h != null);
}

export function filterQuotationHotelsByCity(
  places: QuotationHotelPlace[],
  destinationInput: string,
): QuotationHotelPlace[] {
  if (!destinationInput.trim()) return [];
  return places.filter((place) => hotelMatchesDestination(place, destinationInput));
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
      (!destination.trim() || hotelMatchesDestination(p, destination)),
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

  const name = input.hotelName.trim();
  if (!name) return null;

  const city = input.city.trim();
  const roomType = input.roomType.trim();

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

  const { data, error } = await supabase
    .from('quotations')
    .select('*, clients(id, name, phone_wa)')
    .eq('id', key)
    .maybeSingle();

  if (error) throw new Error(error.message || 'تعذر تحميل عرض السعر.');
  if (!data) return null;
  return mapQuotationRow(data as Record<string, unknown>);
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

  try {
    const reward = await processReferralRewardForQuotation(supabase, key);
    if (reward.processed) {
      console.log('[referral-reward] credited referrer', reward.referrerId, reward.amount);
    }
  } catch (rewardError) {
    console.error('[referral-reward] after approval:', rewardError);
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
