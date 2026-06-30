/**
 * ربط بيانات الطيران والفندق الرئيسي — itineraries.flight_details / hotel_details
 */

import type { FlightDetailsDraft, ItineraryDraft } from '@/lib/itinerary-builder-model';

function pickStr(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = obj[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

export type PrimaryHotelBookingDraft = {
  name: string;
  address: string;
  booking_reference: string;
  check_in: string;
  check_out: string;
  city: string;
  country: string;
};

export function createEmptyPrimaryHotelBooking(): PrimaryHotelBookingDraft {
  return {
    name: '',
    address: '',
    booking_reference: '',
    check_in: '',
    check_out: '',
    city: '',
    country: '',
  };
}

export function primaryHotelToPayload(h: PrimaryHotelBookingDraft): Record<string, string> {
  const name = h.name.trim();
  const address = h.address.trim();
  const ref = h.booking_reference.trim();
  const payload: Record<string, string> = { name };
  if (address) payload.address = address;
  if (h.city.trim()) payload.city = h.city.trim();
  if (h.country.trim()) payload.country = h.country.trim();
  if (h.check_in.trim()) {
    payload.check_in = h.check_in.trim();
    payload.check_in_date = h.check_in.trim();
  }
  if (h.check_out.trim()) {
    payload.check_out = h.check_out.trim();
    payload.check_out_date = h.check_out.trim();
  }
  if (ref) {
    payload.booking_reference = ref;
    payload.confirmation = ref;
    payload.confirmation_number = ref;
    payload.reference = ref;
  }
  return payload;
}

export function primaryHotelFromHotelDetailsRaw(raw: unknown): PrimaryHotelBookingDraft {
  const empty = createEmptyPrimaryHotelBooking();
  if (!raw) return empty;

  let row: Record<string, unknown> | null = null;
  if (Array.isArray(raw) && raw.length > 0 && raw[0] && typeof raw[0] === 'object') {
    row = raw[0] as Record<string, unknown>;
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    row = raw as Record<string, unknown>;
  }
  if (!row) return empty;

  const nested =
    row.hotel && typeof row.hotel === 'object' ? (row.hotel as Record<string, unknown>) : row;

  return {
    name: pickStr(nested, ['name', 'title']),
    address: pickStr(nested, ['address', 'hotel_address', 'location', 'maps_query']),
    booking_reference: pickStr(nested, [
      'booking_reference',
      'confirmation',
      'reference',
      'confirmation_number',
      'booking_ref',
    ]),
    check_in: pickStr(nested, ['check_in', 'check_in_date', 'checkin', 'arrival_date']),
    check_out: pickStr(nested, ['check_out', 'check_out_date', 'checkout', 'departure_date']),
    city: pickStr(nested, ['city']),
    country: pickStr(nested, ['country']),
  };
}

/** دمج الفندق الرئيسي من النموذج + فنادق الأيام (بدون تكرار الاسم) */
export function buildHotelDetailsForSave(draft: ItineraryDraft): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  const primary = draft.primaryHotel;
  if (primary.name.trim()) {
    const key = primary.name.trim().toLowerCase();
    seen.add(key);
    rows.push(primaryHotelToPayload(primary));
  }

  for (const d of draft.days) {
    const push = (h: { name?: string } | null) => {
      if (!h?.name?.trim()) return;
      const key = h.name.trim().toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({ name: h.name.trim() });
    };
    push(d.hotel);
    for (const alt of d.alternative_hotels) push(alt.hotel);
  }

  return rows;
}
