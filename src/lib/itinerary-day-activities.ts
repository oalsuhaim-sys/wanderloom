import type { PlaceBankRow } from '@/types/place';
import type { ExperienceRow } from '@/types/experience';
import type { HotelRow } from '@/types/hotel';
import type {
  DayActivityDraft,
  DayActivityKind,
  ItineraryDayDraft,
  ItineraryStopDraft,
} from '@/lib/itinerary-builder-model';
import { placeBankGeocodeQuery, placeBankMapsSearchUrl } from '@/lib/places-bank';

function newLocalId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyActivityFields(): Omit<DayActivityDraft, 'id' | 'kind'> {
  return {
    visit_time: '',
    time_slot: '',
    transit_mode: '',
    transit_duration: '',
    place_name: '',
    story: '',
    note: '',
    maps_url: '',
    booking_url: '',
    lat: '',
    lng: '',
    category: 'o',
    hotel: null,
    experience: null,
    places_bank_id: '',
    country: '',
    city: '',
    image_url: '',
  };
}

/** يدمج activities[] مع الحقول القديمة قبل الحفظ */
export function collapseDayForSave(day: ItineraryDayDraft): {
  hotel: HotelRow | null;
  experience: ExperienceRow | null;
  stops: ItineraryStopDraft[];
} {
  if (day.activities.length === 0) {
    return { hotel: day.hotel, experience: day.experience, stops: day.stops };
  }

  let hotel: HotelRow | null = null;
  let experience: ExperienceRow | null = null;
  const stops: ItineraryStopDraft[] = [];

  day.activities.forEach((act) => {
    if (act.kind === 'hotel' && act.hotel) {
      hotel = act.hotel;
      return;
    }
    if (act.kind === 'experience' && act.experience) {
      experience = act.experience;
      return;
    }
    if (act.kind === 'place' || act.kind === 'transport') {
      const stopIndex = stops.length;
      stops.push({
        id: act.id,
        place_name: act.place_name,
        visit_time: act.visit_time || act.time_slot || '',
        time_slot: act.visit_time || act.time_slot || '',
        note: act.note,
        story: act.story,
        transport_type: '',
        transit_mode: stopIndex > 0 ? act.transit_mode : '',
        transit_duration: stopIndex > 0 ? act.transit_duration : '',
        maps_url: act.maps_url,
        booking_url: act.booking_url,
        lat: act.lat,
        lng: act.lng,
        category: act.kind === 'transport' ? 'transport' : act.category || 'o',
        ...(act.places_bank_id ? { places_bank_id: act.places_bank_id } : {}),
      });
    }
  });

  return { hotel, experience, stops };
}

export function createTransportActivity(): DayActivityDraft {
  return {
    id: newLocalId(),
    kind: 'transport',
    ...emptyActivityFields(),
    place_name: 'انتقال / مواصلات',
    category: 'transport',
  };
}

function parsePlaceCoord(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).trim());
  if (!Number.isFinite(n)) return null;
  if (n === 0) return null;
  return n;
}

/** إحداثيات من صف places — lat/lng مباشرة من الجدول */
export function pickPlaceBankCoordinates(
  place: PlaceBankRow | Record<string, unknown>,
): { lat: number; lng: number } | null {
  const row = place as Record<string, unknown>;
  const lat = parsePlaceCoord(row.lat ?? row.latitude ?? row.Lat ?? row.LAT);
  const lng = parsePlaceCoord(
    row.lng ?? row.longitude ?? row.lon ?? row.long ?? row.Lng ?? row.LNG,
  );
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

/** إحداثيات رقمية صالحة من نشاط اليوم */
export function activityMapCoordinates(
  act: Pick<DayActivityDraft, 'lat' | 'lng'>,
): { lat: number; lng: number } | null {
  const lat = parseCoordString(act.lat);
  const lng = parseCoordString(act.lng);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

export function activityFromPlaceBank(place: PlaceBankRow): DayActivityDraft {
  const coords = pickPlaceBankCoordinates(place);
  return {
    id: newLocalId(),
    kind: 'place',
    ...emptyActivityFields(),
    place_name: place.name,
    category: place.category || 'o',
    note: place.sub_tag?.trim() || '',
    maps_url: placeBankMapsSearchUrl(place),
    places_bank_id: place.id,
    country: place.country || '',
    city: place.city || '',
    image_url: place.image_url?.trim() || '',
    lat: coords ? String(coords.lat) : '',
    lng: coords ? String(coords.lng) : '',
  };
}

export function stopToActivity(stop: ItineraryStopDraft, index: number): DayActivityDraft {
  const isTransport = stop.category === 'transport';
  const visit = stop.visit_time || stop.time_slot || '';
  return {
    id: stop.id,
    kind: isTransport ? 'transport' : 'place',
    visit_time: visit,
    time_slot: visit,
    transit_mode: index > 0 ? stop.transit_mode : '',
    transit_duration: index > 0 ? stop.transit_duration : '',
    place_name: stop.place_name,
    story: stop.story,
    note: stop.note,
    maps_url: stop.maps_url,
    booking_url: stop.booking_url,
    lat: stop.lat,
    lng: stop.lng,
    category: stop.category || (isTransport ? 'transport' : 'o'),
    hotel: null,
    experience: null,
    places_bank_id: stop.places_bank_id || '',
    country: '',
    city: '',
    image_url: stop.image_url?.trim() || '',
  };
}

export function activityToStop(act: DayActivityDraft, stopIndex: number): ItineraryStopDraft {
  const visit = act.visit_time || act.time_slot || '';
  return {
    id: act.id,
    place_name: act.place_name,
    visit_time: visit,
    time_slot: visit,
    note: act.note,
    story: act.story,
    transport_type: '',
    transit_mode: stopIndex > 0 ? act.transit_mode : '',
    transit_duration: stopIndex > 0 ? act.transit_duration : '',
    maps_url: act.maps_url,
    booking_url: act.booking_url,
    lat: act.lat,
    lng: act.lng,
    category: act.kind === 'transport' ? 'transport' : act.category || 'o',
    places_bank_id: act.places_bank_id || '',
    image_url: act.image_url?.trim() || '',
  };
}

/** قائمة الأنشطة الموحّدة — من activities أو من الحقول القديمة */
export function dayToActivities(day: ItineraryDayDraft): DayActivityDraft[] {
  if (day.activities.length > 0) return [...day.activities];

  const list: DayActivityDraft[] = [];
  if (day.hotel) {
    list.push({
      id: newLocalId(),
      kind: 'hotel',
      ...emptyActivityFields(),
      place_name: day.hotel.name,
      hotel: day.hotel,
    });
  }
  if (day.experience) {
    list.push({
      id: newLocalId(),
      kind: 'experience',
      ...emptyActivityFields(),
      place_name: day.experience.title,
      experience: day.experience,
    });
  }
  day.stops.forEach((s, i) => list.push(stopToActivity(s, i)));
  return list;
}

/** مزامنة activities مع stops / hotel / experience للحفظ والعرض */
export function patchDayActivities(
  day: ItineraryDayDraft,
  activities: DayActivityDraft[],
): ItineraryDayDraft {
  const next = { ...day, activities };
  const collapsed = collapseDayForSave(next);
  return {
    ...next,
    stops: collapsed.stops,
    hotel: collapsed.hotel,
    experience: collapsed.experience,
  };
}

export function reorderActivities(
  activities: DayActivityDraft[],
  sourceIndex: number,
  destIndex: number,
): DayActivityDraft[] {
  const next = [...activities];
  const [removed] = next.splice(sourceIndex, 1);
  if (!removed) return activities;
  next.splice(destIndex, 0, removed);
  return next;
}

export function moveActivityBetweenDays(
  days: ItineraryDayDraft[],
  sourceDayId: string,
  destDayId: string,
  activityId: string,
  destIndex: number,
): ItineraryDayDraft[] {
  let moved: DayActivityDraft | null = null;

  const stripped = days.map((d) => {
    if (d.id !== sourceDayId) return d;
    const acts = dayToActivities(d);
    const idx = acts.findIndex((a) => a.id === activityId);
    if (idx < 0) return d;
    moved = acts[idx]!;
    const nextActs = acts.filter((a) => a.id !== activityId);
    return patchDayActivities(d, nextActs);
  });

  if (!moved) return days;

  return stripped.map((d) => {
    if (d.id !== destDayId) return d;
    const acts = [...dayToActivities(d)];
    acts.splice(destIndex, 0, moved!);
    return patchDayActivities(d, acts);
  });
}

export type PickerApplyMode = 'place';

export function applyPickerToDay(
  day: ItineraryDayDraft,
  _mode: PickerApplyMode,
  payload: { place: PlaceBankRow },
): ItineraryDayDraft {
  const acts = dayToActivities(day);
  return patchDayActivities(day, [...acts, activityFromPlaceBank(payload.place)]);
}

/** أنشطة تظهر على الخريطة (أماكن + انتقالات ذات إحداثيات) */
export function mapableActivities(activities: DayActivityDraft[]): DayActivityDraft[] {
  return activities.filter((a) => a.kind === 'place' || a.kind === 'transport');
}

export function geocodeQueryForActivity(act: DayActivityDraft): string {
  if (act.kind === 'place' && act.places_bank_id) {
    return placeBankGeocodeQuery({
      name: act.place_name,
      city: act.city,
      country: act.country,
    });
  }
  return [act.place_name, act.city, act.country].filter(Boolean).join(', ');
}

export function parseCoordString(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).trim());
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}

export function activityHasCoords(act: DayActivityDraft): boolean {
  return parseCoordString(act.lat) != null && parseCoordString(act.lng) != null;
}

export function kindLabel(kind: DayActivityKind): string {
  if (kind === 'transport') return 'انتقال';
  if (kind === 'place') return 'نشاط';
  return kind;
}
