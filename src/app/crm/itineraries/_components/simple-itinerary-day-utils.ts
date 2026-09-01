export type ItineraryHotelEntry = {
  id: string;
  name: string;
  pnr: string;
  checkIn: string;
  checkOut: string;
  supplier_contact: string;
  /** عند true: حقل نص حر؛ عند false: اختيار من دليل الموردين */
  isManualSupplier?: boolean;
};

export type SimpleItineraryDay = {
  id: number;
  title: string;
  /** مدينة اليوم — تُعرض في المسار اليومي للعميل */
  city?: string;
  /** فندق الإقامة لهذا اليوم — يُستخدم لمرساة البداية/النهاية في عرض العميل */
  hotelName?: string;
  places: SimpleItineraryPlace[];
};

export type SimpleItineraryPlace = {
  id?: string | number;
  name?: string;
  category?: string;
  city?: string;
  branch_name?: string | null;
  rating?: string | number;
  /** وقت الزيارة (HH:MM) — يظهر في بوابة العميل */
  visit_time?: string;
  /** ملاحظات المحطة (اختياري) — تظهر للعميل في المسار */
  notes?: string;
  transportToNext?: string;
  transportDuration?: string;
  /** حالة سداد المورد — للموظف فقط */
  supplierPaid?: boolean;
  _dragId: string;
  [key: string]: unknown;
};

/** قراءة ملاحظات المحطة من JSON محفوظ — يدعم notes و note للتوافق */
export function readPlaceNotesFromStop(raw: Record<string, unknown>): string | undefined {
  const notes = String(raw.notes ?? raw.note ?? '').trim();
  return notes || undefined;
}

/** كتابة ملاحظات المحطة في payload الحفظ — notes + note للتوافق مع البيانات القديمة */
export function placeNotesToStopPayload(notes: string | undefined): Record<string, string> {
  const trimmed = String(notes ?? '').trim();
  if (!trimmed) return {};
  return { notes: trimmed, note: trimmed };
}

export const TRANSPORT_MODES = [
  { value: 'سيارة', icon: '🚗' },
  { value: 'مترو', icon: '🚇' },
  { value: 'مشي', icon: '🚶‍♂️' },
] as const;

export function createEmptyHotelEntry(): ItineraryHotelEntry {
  return {
    id: `hotel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    pnr: '',
    checkIn: '',
    checkOut: '',
    supplier_contact: '',
  };
}

export function parseHotelsFromDetailsRaw(raw: unknown): ItineraryHotelEntry[] {
  if (!raw) return [createEmptyHotelEntry()];

  const rows = Array.isArray(raw) ? raw : [raw];
  const parsed = rows
    .map((item, index) => {
      const row = item as Record<string, unknown>;
      const name = String(row.name ?? '').trim();
      if (!name) return null;
      return {
        id: `hotel-${index}-${Date.now()}`,
        name,
        pnr: String(row.booking_reference ?? row.pnr ?? '').trim(),
        checkIn: String(row.check_in ?? row.check_in_date ?? '').slice(0, 10),
        checkOut: String(row.check_out ?? row.check_out_date ?? '').slice(0, 10),
        supplier_contact: String(row.supplier_contact ?? '').trim(),
      } satisfies ItineraryHotelEntry;
    })
    .filter((h): h is ItineraryHotelEntry => h != null);

  return parsed.length > 0 ? parsed : [createEmptyHotelEntry()];
}

export function hotelsToDetailsPayload(hotels: ItineraryHotelEntry[]): unknown[] {
  return hotels
    .filter((h) => h.name.trim())
    .map((h) => ({
      name: h.name.trim(),
      check_in: h.checkIn || undefined,
      check_out: h.checkOut || undefined,
      check_in_date: h.checkIn || undefined,
      check_out_date: h.checkOut || undefined,
      ...(h.pnr.trim() ? { booking_reference: h.pnr.trim(), pnr: h.pnr.trim() } : {}),
      ...(h.supplier_contact.trim() ? { supplier_contact: h.supplier_contact.trim() } : {}),
    }));
}

export function createEmptyDay(index: number): SimpleItineraryDay {
  return {
    id: Date.now() + index,
    title: index === 0 ? 'اليوم الأول' : `اليوم ${index + 1}`,
    places: [],
  };
}

export function withTransportDefaults(place: Record<string, unknown>): SimpleItineraryPlace {
  const dragId =
    typeof place._dragId === 'string' && place._dragId
      ? place._dragId
      : `place-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const visit_time = String(
    place.visit_time ?? place.time_slot ?? place.time ?? '',
  ).trim();

  return {
    ...place,
    _dragId: dragId,
    visit_time,
    transportToNext: (place.transportToNext as string | undefined) ?? 'سيارة',
    transportDuration: (place.transportDuration as string | undefined) ?? '',
    supplierPaid:
      place.supplierPaid === true ||
      place.supplier_paid === true ||
      String(place.supplier_paid ?? '').toLowerCase() === 'paid',
  } as SimpleItineraryPlace;
}

function normalizeVisitTime(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
  if (!match) return s;
  return `${match[1]!.padStart(2, '0')}:${match[2]}`;
}

/** Sort places by visit_time (HH:MM). Missing times sink to the bottom. */
export function sortPlacesByVisitTime(places: SimpleItineraryPlace[]): SimpleItineraryPlace[] {
  return [...places].sort((a, b) => {
    const ta = normalizeVisitTime(a.visit_time ?? a.time_slot);
    const tb = normalizeVisitTime(b.visit_time ?? b.time_slot);
    if (!ta && !tb) return 0;
    if (!ta) return 1;
    if (!tb) return -1;
    return ta.localeCompare(tb);
  });
}

export const PLACES_BANK_DROPPABLE_ID = 'places-bank';

export function bankPlaceDraggableId(place: Record<string, unknown>): string {
  const key = place.id != null ? String(place.id) : String(place.name ?? 'place');
  return `bank-${key}`;
}

export function dayDroppableId(dayId: number): string {
  return `day-${dayId}`;
}

export function parseDayDroppableId(droppableId: string): number | null {
  const match = /^day-(\d+)$/.exec(droppableId);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}
