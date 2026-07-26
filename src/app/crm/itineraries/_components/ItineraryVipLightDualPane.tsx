'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, Plus, Trash2 } from 'lucide-react';

import VipCompassPreferences from '@/app/crm/itineraries/_components/VipCompassPreferences';
import VipDayCardHeader from '@/app/crm/itineraries/_components/VipDayCardHeader';
import { VipDateField, VipTimeSlotSelect } from '@/app/crm/itineraries/_components/VipBookingFields';
import { useCrmEmployee } from '@/app/crm/_components/CrmEmployeeProvider';
import {
  activityFromPlaceBank,
  activityHasCoords,
  activityMapCoordinates,
  createTransportActivity,
  dayToActivities,
  geocodeQueryForActivity,
  kindLabel,
  mapableActivities,
  patchDayActivities,
  pickPlaceBankCoordinates,
} from '@/lib/itinerary-day-activities';
import {
  buildItinerarySupabasePayload,
  buildVipClientSummaryPatch,
  createEmptyDay,
  createInitialItineraryDraft,
  stripItineraryPayloadForSchemaError,
  type DayActivityDraft,
  type FlightDetailsDraft,
  type ItineraryDayDraft,
  type PrimaryHotelBookingDraft,
} from '@/lib/itinerary-builder-model';
import { geocodeAddress } from '@/lib/nominatim-geocoding';
import {
  PLACES_BANK_CATEGORIES,
  PLACES_BANK_PAGE_SIZE,
  placeBankCategoryLabel,
} from '@/lib/places-bank';
import {
  fetchAllPlacesForNearbySearch,
  filterPlacesByProximity,
  formatDistanceKmAr,
  isPlacesCoordinateSchemaError,
  PlacesProximityUnavailableError,
  PROXIMITY_RADIUS_KM,
  type PlaceWithDistance,
  type ProximityOrigin,
} from '@/lib/places-proximity';
import { supabase } from '@/lib/supabase';
import type { PlaceBankRow } from '@/types/place';

/** VIP Light Theme — Wanderloom CRM */
const PAGE = 'min-h-screen bg-[#FAFAFA] p-6 text-[#1E2720] flex flex-col gap-6';
const CARD = 'rounded-xl border border-gray-200 bg-white shadow-sm';
const INPUT =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40';
const LABEL = 'mb-1 block text-xs font-bold text-[#1E2720]';
const SELECT = INPUT;
const BTN_GOLD =
  'rounded-md bg-[#D4AF37] font-bold text-black hover:bg-yellow-500 disabled:opacity-50';
const BTN_GHOST =
  'rounded-md border border-gray-300 bg-white text-xs font-bold text-[#1E2720] hover:border-[#D4AF37]';
const HEADING = 'text-2xl font-bold text-[#1E2720]';
const HEADING_GOLD = 'text-lg font-bold text-[#1E2720]';

const PLACES_SELECT_COORDS =
  'id, name, country, city, category, latitude, longitude, image_url';
const PLACES_SELECT_MINIMAL = 'id, name, country, city, category, image_url';


function patchFlight(f: FlightDetailsDraft, k: keyof FlightDetailsDraft, v: string): FlightDetailsDraft {
  const n = { ...f, [k]: v };
  if (k === 'departure_time') n.flight_time = v;
  return n;
}

function patchHotel(h: PrimaryHotelBookingDraft, k: keyof PrimaryHotelBookingDraft, v: string): PrimaryHotelBookingDraft {
  return { ...h, [k]: v };
}

export default function ItineraryVipLightDualPane() {
  const { employee } = useCrmEmployee();

  const [draft, setDraft] = useState(createInitialItineraryDraft);
  const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [activeDayId, setActiveDayId] = useState('');
  const [proximityOrigin, setProximityOrigin] = useState<ProximityOrigin | null>(null);

  const [places, setPlaces] = useState<PlaceBankRow[]>([]);
  const [proximityList, setProximityList] = useState<PlaceWithDistance[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [placesTotal, setPlacesTotal] = useState(0);
  const [placesPage, setPlacesPage] = useState(0);
  const [placeSearch, setPlaceSearch] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [nearbyDisabled, setNearbyDisabled] = useState(false);

  const patchDraft = (p: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...p }));
  const proximityOn = proximityOrigin != null;

  const activeDay = useMemo(
    () => draft.days.find((d) => d.id === activeDayId) ?? draft.days[0],
    [draft.days, activeDayId],
  );

  const activeDayLabel = useMemo(() => {
    const idx = draft.days.findIndex((d) => d.id === activeDayId);
    const day = draft.days[idx];
    if (idx < 0) return '—';
    return `اليوم ${idx + 1}${day?.city ? ` · ${day.city}` : ''}`;
  }, [draft.days, activeDayId]);

  const placeFilters = useMemo(
    () => ({
      search: placeSearch.trim() || undefined,
      country: filterCountry || undefined,
      city: filterCity || undefined,
      category: filterCat || undefined,
    }),
    [placeSearch, filterCountry, filterCity, filterCat],
  );

  useEffect(() => {
    if (!draft.days.length) return;
    if (!draft.days.some((d) => d.id === activeDayId)) setActiveDayId(draft.days[0]!.id);
  }, [draft.days, activeDayId]);

  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from('clients')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data) setClients(data as { id: number; name: string }[]);
      });
  }, []);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const all: string[] = [];
      for (let o = 0; o < 8000; o += 1000) {
        const { data } = await supabase.from('places').select('country').range(o, o + 999);
        if (!data?.length) break;
        data.forEach((r: { country?: string }) => {
          if (r.country && !all.includes(r.country)) all.push(r.country);
        });
        if (data.length < 1000) break;
      }
      setCountries(all.sort());
    })();
  }, []);

  useEffect(() => {
    if (!supabase || !filterCountry) {
      setCities([]);
      return;
    }
    (async () => {
      const all: string[] = [];
      for (let o = 0; o < 8000; o += 1000) {
        const { data } = await supabase
          .from('places')
          .select('city')
          .eq('country', filterCountry)
          .range(o, o + 999);
        if (!data?.length) break;
        data.forEach((r: { city?: string }) => {
          if (r.city && !all.includes(r.city)) all.push(r.city);
        });
        if (data.length < 1000) break;
      }
      setCities(all.sort());
    })();
  }, [filterCountry]);

  const loadBrowsePlaces = useCallback(async () => {
    if (!supabase) return;
    setPlacesLoading(true);
    setPlacesError(null);
    try {
      const runQuery = async (columns: string) => {
        let q = supabase.from('places').select(columns, { count: 'exact' });
        if (placeFilters.search) q = q.ilike('name', `%${placeFilters.search}%`);
        if (placeFilters.country) q = q.eq('country', placeFilters.country);
        if (placeFilters.city) q = q.eq('city', placeFilters.city);
        if (placeFilters.category) q = q.eq('category', placeFilters.category);
        return q
          .order('name')
          .range(placesPage * PLACES_BANK_PAGE_SIZE, (placesPage + 1) * PLACES_BANK_PAGE_SIZE - 1);
      };

      let columns = PLACES_SELECT_COORDS;
      let { data, count, error } = await runQuery(columns);

      if (error && isPlacesCoordinateSchemaError(error.message)) {
        setNearbyDisabled(true);
        columns = PLACES_SELECT_MINIMAL;
        ({ data, count, error } = await runQuery(columns));
      }

      if (error) {
        setPlacesError(error.message);
        setPlaces([]);
        setPlacesTotal(0);
      } else {
        setPlaces((data ?? []) as PlaceBankRow[]);
        setPlacesTotal(count ?? 0);
      }
    } catch (e) {
      setPlacesError(e instanceof Error ? e.message : 'تعذر تحميل الأماكن.');
      setPlaces([]);
      setPlacesTotal(0);
    } finally {
      setPlacesLoading(false);
    }
  }, [placeFilters, placesPage]);

  /** Haversine + فلتر 5 كم — يجلب حتى 10,000 مكاناً من Supabase */
  const runProximitySearch = useCallback(async (origin: ProximityOrigin) => {
    if (nearbyDisabled) {
      setPlacesError('ميزة الأماكن القريبة غير متاحة — أعمدة الإحداثيات غير موجودة في قاعدة البيانات.');
      setProximityList([]);
      setPlacesTotal(0);
      return;
    }
    setPlacesLoading(true);
    setPlacesError(null);
    try {
      const all = await fetchAllPlacesForNearbySearch();
      const nearby = filterPlacesByProximity(origin, all, PROXIMITY_RADIUS_KM);
      setProximityList(nearby);
      setPlacesTotal(nearby.length);
    } catch (e) {
      if (
        e instanceof PlacesProximityUnavailableError ||
        (e instanceof Error && isPlacesCoordinateSchemaError(e.message))
      ) {
        setNearbyDisabled(true);
        setProximityOrigin(null);
        setProximityList([]);
        setPlacesError('تعذّر تفعيل الأماكن القريبة — عمود الإحداثيات غير متوفر في Supabase.');
        void loadBrowsePlaces();
        return;
      }
      setPlacesError(e instanceof Error ? e.message : 'تعذر حساب القرب.');
      setProximityList([]);
      setPlacesTotal(0);
    } finally {
      setPlacesLoading(false);
    }
  }, [nearbyDisabled, loadBrowsePlaces]);

  const loadProximityPlaces = useCallback(async () => {
    if (!proximityOrigin) return;
    await runProximitySearch(proximityOrigin);
  }, [proximityOrigin, runProximitySearch]);

  useEffect(() => {
    setPlacesPage(0);
  }, [placeSearch, filterCountry, filterCity, filterCat, proximityOrigin?.activityId]);

  useEffect(() => {
    if (proximityOn) void loadProximityPlaces();
    else void loadBrowsePlaces();
  }, [proximityOn, loadProximityPlaces, loadBrowsePlaces]);

  const addPlaceToDay = useCallback(
    (place: PlaceBankRow) => {
      const dayId = activeDayId || draft.days[0]?.id;
      if (!dayId) return;
      const bankCoords = pickPlaceBankCoordinates(place);
      let act = activityFromPlaceBank(place);
      if (bankCoords && !activityHasCoords(act)) {
        act = { ...act, lat: String(bankCoords.lat), lng: String(bankCoords.lng) };
      }
      setDraft((d) => ({
        ...d,
        days: d.days.map((day) =>
          day.id === dayId ? patchDayActivities(day, [...dayToActivities(day), act]) : day,
        ),
      }));
      if (!activityHasCoords(act)) {
        void geocodeAddress(geocodeQueryForActivity(act)).then((coords) => {
          if (!coords) return;
          setDraft((d) => ({
            ...d,
            days: d.days.map((day) => {
              if (day.id !== dayId) return day;
              const acts = dayToActivities(day).map((a) =>
                a.id === act.id ? { ...a, lat: String(coords.lat), lng: String(coords.lng) } : a,
              );
              return patchDayActivities(day, acts);
            }),
          }));
        });
      }
    },
    [activeDayId, draft.days],
  );

  const addDay = () => {
    setDraft((d) => {
      const next = [...d.days, createEmptyDay(d.days.length)];
      setActiveDayId(next[next.length - 1]!.id);
      return { ...d, days: next };
    });
  };

  const saveItinerary = useCallback(async (): Promise<boolean> => {
    if (!supabase) return false;
    if (!draft.customerName.trim() || !draft.title.trim()) {
      setNotice('يرجى اختيار العميل وإدخال عنوان الرحلة.');
      return false;
    }
    setSaving(true);
    setNotice(null);
    const payload = buildItinerarySupabasePayload(draft, {
      employeeId: employee?.id ?? null,
      autoPasscode: !draft.passcode.trim(),
    });
    try {
      let insertRes = await supabase
        .from('itineraries')
        .insert(payload)
        .select('id, passcode, magic_link_id')
        .single();
      if (insertRes.error && /column|schema cache|does not exist/i.test(insertRes.error.message ?? '')) {
        insertRes = await supabase
          .from('itineraries')
          .insert(stripItineraryPayloadForSchemaError(insertRes.error.message ?? '', payload))
          .select('id, passcode, magic_link_id')
          .single();
      }
      if (insertRes.error) throw insertRes.error;
      const id = insertRes.data?.id;
      if (id != null) {
        await supabase.from('itineraries').update(buildVipClientSummaryPatch(draft)).eq('id', id);
        setCreatedId(String(id));
        setNotice('تم إنشاء المسار بنجاح.');
        return true;
      }
      return false;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'فشل إنشاء المسار.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [draft, employee?.id]);

  const patchDay = (dayId: string, fn: (d: ItineraryDayDraft) => ItineraryDayDraft) => {
    setDraft((d) => ({ ...d, days: d.days.map((day) => (day.id === dayId ? fn(day) : day)) }));
  };

  const removeActivity = (dayId: string, actId: string) => {
    patchDay(dayId, (day) => patchDayActivities(day, dayToActivities(day).filter((a) => a.id !== actId)));
  };

  const updateActivity = (
    dayId: string,
    actId: string,
    patch: Partial<ReturnType<typeof mapableActivities>[number]>,
  ) => {
    patchDay(dayId, (day) =>
      patchDayActivities(
        day,
        dayToActivities(day).map((a) => (a.id === actId ? { ...a, ...patch } : a)),
      ),
    );
  };

  const handleNearbySearch = useCallback(
    async (act: DayActivityDraft) => {
      if (act.kind !== 'place' || !activeDay) return;
      if (nearbyDisabled) {
        setNotice('ميزة الأماكن القريبة معطّلة — لا توجد أعمدة latitude/longitude في جدول places.');
        return;
      }

      let coords = activityMapCoordinates(act);
      if (!coords) {
        const geocoded = await geocodeAddress(geocodeQueryForActivity(act));
        if (geocoded) {
          coords = geocoded;
          patchDay(activeDay.id, (day) =>
            patchDayActivities(
              day,
              dayToActivities(day).map((a) =>
                a.id === act.id
                  ? { ...a, lat: String(geocoded.lat), lng: String(geocoded.lng) }
                  : a,
              ),
            ),
          );
        }
      }
      if (!coords) {
        setNotice('لا توجد إحداثيات لهذا المكان — أضفه من بنك الأماكن أو حدّث العنوان.');
        return;
      }

      const origin: ProximityOrigin = {
        activityId: act.id,
        placeName: act.place_name || 'محطة',
        lat: coords.lat,
        lng: coords.lng,
      };
      setPlacesPage(0);
      setProximityOrigin(origin);
      await runProximitySearch(origin);
    },
    [activeDay, nearbyDisabled, runProximitySearch],
  );

  const clearProximityMode = () => {
    setProximityOrigin(null);
    setProximityList([]);
    setPlacesPage(0);
  };

  const placesPageSlice = proximityOn
    ? proximityList.slice(
        placesPage * PLACES_BANK_PAGE_SIZE,
        placesPage * PLACES_BANK_PAGE_SIZE + PLACES_BANK_PAGE_SIZE,
      )
    : places;
  const placesTotalPages = Math.max(1, Math.ceil(placesTotal / PLACES_BANK_PAGE_SIZE));
  const timelineActs = activeDay ? mapableActivities(dayToActivities(activeDay)) : [];

  if (createdId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FAFAFA] p-6 text-[#1E2720]" dir="rtl">
        <p className="text-2xl font-bold text-[#1E2720]">تم إنشاء المسار بنجاح</p>
        <p className="text-sm text-gray-600">يمكنك متابعة التعديل أو العودة للقائمة.</p>
        <div className="flex gap-3">
          <Link href={`/crm/itineraries/${createdId}/edit`} className={`px-4 py-2 ${BTN_GOLD}`}>
            فتح المحرر
          </Link>
          <Link href="/crm/itineraries" className={`px-4 py-2 ${BTN_GHOST}`}>
            كل المسارات
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE} dir="rtl">
      {/* شريط علوي */}
      <div className={`flex flex-wrap items-center justify-between gap-3 p-4 ${CARD}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/crm/itineraries" className={`px-3 py-2 ${BTN_GHOST}`}>
            المسارات
          </Link>
          <span className="text-lg font-bold text-[#D4AF37]">إنشاء مسار جديد</span>
          <input
            className={`${INPUT} w-40`}
            placeholder="عنوان الرحلة"
            value={draft.title}
            onChange={(e) => patchDraft({ title: e.target.value })}
          />
          <input
            className={`${INPUT} w-36`}
            placeholder="اسم العميل"
            value={draft.customerName}
            onChange={(e) => patchDraft({ customerName: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={`${SELECT} w-44`}
            value={draft.linkedClientId}
            onChange={(e) => {
              const id = e.target.value;
              const c = clients.find((x) => String(x.id) === id);
              patchDraft({
                linkedClientId: id,
                customerName: c?.name ?? draft.customerName,
              });
            }}
          >
            <option value="">اختر العميل…</option>
            {clients.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={addDay} className={`px-3 py-2 ${BTN_GHOST}`}>
            <Plus className="inline h-4 w-4" /> إضافة يوم
          </button>
        </div>
      </div>

      {notice ? (
        <p className={`px-4 py-2 text-center text-sm font-bold text-[#1E2720] ${CARD}`}>{notice}</p>
      ) : null}

      {/* TOP SECTION: Flight & Hotel */}
      <section className={`p-6 border-[#D4AF37] ${CARD}`}>
        <h2 className={`${HEADING} mb-4`}>بيانات الطيران والحجوزات</h2>
        <p className="mb-4 text-sm font-semibold text-[#1E2720]/60">الطيران</p>
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          <label>
            <span className={LABEL}>رقم الرحلة</span>
            <input
              className={INPUT}
              dir="ltr"
              placeholder="SV130"
              value={draft.flight.flight_number}
              onChange={(e) =>
                patchDraft({
                  flight: patchFlight(draft.flight, 'flight_number', e.target.value),
                })
              }
            />
          </label>
          <label>
            <span className={LABEL}>مغادرة</span>
            <VipTimeSlotSelect
              className={INPUT}
              value={draft.flight.departure_time || draft.flight.flight_time}
              onChange={(v) =>
                patchDraft({
                  flight: patchFlight(draft.flight, 'departure_time', v),
                })
              }
            />
          </label>
          <label>
            <span className={LABEL}>وصول</span>
            <VipTimeSlotSelect
              className={INPUT}
              value={draft.flight.arrival_time}
              onChange={(v) =>
                patchDraft({ flight: patchFlight(draft.flight, 'arrival_time', v) })
              }
            />
          </label>
          <label>
            <span className={LABEL}>البوابة</span>
            <input
              className={INPUT}
              dir="ltr"
              value={draft.flight.gate}
              onChange={(e) => patchDraft({ flight: patchFlight(draft.flight, 'gate', e.target.value) })}
            />
          </label>
          <label>
            <span className={LABEL}>المبنى</span>
            <input
              className={INPUT}
              dir="ltr"
              placeholder="T1"
              value={draft.flight.terminal}
              onChange={(e) =>
                patchDraft({ flight: patchFlight(draft.flight, 'terminal', e.target.value) })
              }
            />
          </label>
          <label>
            <span className={LABEL}>درجة الإركاب</span>
            <select
              className={INPUT}
              dir="ltr"
              value={draft.flight.flight_class}
              onChange={(e) =>
                patchDraft({ flight: patchFlight(draft.flight, 'flight_class', e.target.value) })
              }
            >
              <option value="">—</option>
              <option value="Economy">Economy</option>
              <option value="Premium Economy">Premium Economy</option>
              <option value="Business">Business</option>
              <option value="First Class">First Class</option>
            </select>
          </label>
          <label>
            <span className={LABEL}>المقعد</span>
            <input
              className={INPUT}
              dir="ltr"
              value={draft.flight.flight_seat}
              onChange={(e) =>
                patchDraft({ flight: patchFlight(draft.flight, 'flight_seat', e.target.value) })
              }
            />
          </label>
          <label>
            <span className={LABEL}>PNR</span>
            <input
              className={INPUT}
              dir="ltr"
              value={draft.flight.booking_reference}
              onChange={(e) =>
                patchDraft({
                  flight: patchFlight(draft.flight, 'booking_reference', e.target.value),
                })
              }
            />
          </label>
          <label>
            <span className={LABEL}>من</span>
            <input
              className={INPUT}
              dir="ltr"
              value={draft.flight.flight_from}
              onChange={(e) =>
                patchDraft({ flight: patchFlight(draft.flight, 'flight_from', e.target.value) })
              }
            />
          </label>
          <label>
            <span className={LABEL}>دولة المغادرة</span>
            <input
              className={INPUT}
              placeholder="السعودية"
              value={draft.flight.departure_country}
              onChange={(e) =>
                patchDraft({
                  flight: patchFlight(draft.flight, 'departure_country', e.target.value),
                })
              }
            />
          </label>
          <label>
            <span className={LABEL}>إلى</span>
            <input
              className={INPUT}
              dir="ltr"
              value={draft.flight.flight_to}
              onChange={(e) => {
                const flight = patchFlight(draft.flight, 'flight_to', e.target.value);
                patchDraft({
                  flight,
                  ...(e.target.value.trim() ? { destination: e.target.value.trim() } : {}),
                });
              }}
            />
          </label>
          <label>
            <span className={LABEL}>دولة الوصول</span>
            <input
              className={INPUT}
              placeholder="هنغاريا"
              value={draft.flight.arrival_country}
              onChange={(e) =>
                patchDraft({
                  flight: patchFlight(draft.flight, 'arrival_country', e.target.value),
                })
              }
            />
          </label>
        </div>
        <p className="mb-4 text-sm font-semibold text-[#1E2720]/60">الفندق</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
          <label className="sm:col-span-2">
            <span className={LABEL}>اسم الفندق</span>
            <input
              className={INPUT}
              value={draft.primaryHotel.name}
              onChange={(e) =>
                patchDraft({
                  primaryHotel: patchHotel(draft.primaryHotel, 'name', e.target.value),
                })
              }
            />
          </label>
          <label className="sm:col-span-2">
            <span className={LABEL}>العنوان</span>
            <input
              className={INPUT}
              dir="ltr"
              value={draft.primaryHotel.address}
              onChange={(e) =>
                patchDraft({
                  primaryHotel: patchHotel(draft.primaryHotel, 'address', e.target.value),
                })
              }
            />
          </label>
          <label>
            <span className={LABEL}>التأكيد</span>
            <input
              className={INPUT}
              dir="ltr"
              value={draft.primaryHotel.booking_reference}
              onChange={(e) =>
                patchDraft({
                  primaryHotel: patchHotel(draft.primaryHotel, 'booking_reference', e.target.value),
                })
              }
            />
          </label>
          <label>
            <span className={LABEL}>دخول</span>
            <VipDateField
              className={INPUT}
              value={draft.primaryHotel.check_in}
              onChange={(v) =>
                patchDraft({
                  primaryHotel: patchHotel(draft.primaryHotel, 'check_in', v),
                })
              }
            />
          </label>
          <label>
            <span className={LABEL}>خروج</span>
            <VipDateField
              className={INPUT}
              value={draft.primaryHotel.check_out}
              onChange={(v) =>
                patchDraft({
                  primaryHotel: patchHotel(draft.primaryHotel, 'check_out', v),
                })
              }
            />
          </label>
        </div>
      </section>

      {/* MAIN WORKSPACE */}
      <section className="flex h-[800px] gap-6">
        {/* RIGHT PANE 35% — Places (first in RTL = right) */}
        <aside className={`flex w-[35%] flex-col overflow-hidden ${CARD}`}>
          <div className="border-b border-gray-200 bg-gray-50 p-4">
            <h3 className={HEADING_GOLD}>مستكشف بنك الأماكن (6400+ مكان)</h3>
            <p className="mt-1 text-xs font-semibold text-[#1E2720]/60">يُضاف إلى: {activeDayLabel}</p>
            {nearbyDisabled ? (
              <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                الأماكن القريبة معطّلة — لا توجد أعمدة latitude/longitude في Supabase.
              </p>
            ) : null}
            {proximityOn ? (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-[#D4AF37] bg-[#D4AF37]/15 px-3 py-2">
                <span className="text-sm font-bold text-[#1E2720]">
                  📍 الأماكن القريبة (نطاق {PROXIMITY_RADIUS_KM} كم)
                  {proximityOrigin?.placeName ? (
                    <span className="mr-1 font-semibold text-[#1E2720]/60">
                      — من {proximityOrigin.placeName}
                    </span>
                  ) : null}
                </span>
                <button type="button" onClick={clearProximityMode} className={`shrink-0 px-3 py-1 ${BTN_GHOST}`}>
                  إلغاء
                </button>
              </div>
            ) : null}
            <input
              className={`${INPUT} mt-3`}
              placeholder="بحث بالاسم..."
              value={placeSearch}
              onChange={(e) => setPlaceSearch(e.target.value)}
            />
            <select
              className={`${SELECT} mt-2`}
              value={filterCountry}
              onChange={(e) => {
                setFilterCountry(e.target.value);
                setFilterCity('');
              }}
            >
              <option value="">كل الدول</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className={`${SELECT} mt-2`}
              value={filterCity}
              disabled={!filterCountry}
              onChange={(e) => setFilterCity(e.target.value)}
            >
              <option value="">كل المدن</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className={`${SELECT} mt-2`}
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
            >
              <option value="">كل الفئات</option>
              {Object.entries(PLACES_BANK_CATEGORIES).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {placesLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
              </div>
            ) : placesError ? (
              <p className="text-center text-sm font-bold text-red-700">{placesError}</p>
            ) : placesPageSlice.length === 0 ? (
              <p className="text-center text-sm font-semibold text-[#1E2720]/50">
                {proximityOn
                  ? `لا توجد أماكن ضمن ${PROXIMITY_RADIUS_KM} كم — جرّب مكان أصل آخر أو اضغط إلغاء`
                  : 'لا توجد نتائج'}
              </p>
            ) : (
              <ul className="space-y-3">
                {placesPageSlice.map((item) => {
                  const p = proximityOn ? (item as PlaceWithDistance).place : (item as PlaceBankRow);
                  const dist = proximityOn ? (item as PlaceWithDistance).distanceKm : null;
                  return (
                    <li
                      key={p.id}
                      className="rounded-lg border border-gray-200 bg-white p-3"
                    >
                      <div className="flex justify-between gap-2">
                        <p className="text-sm font-bold text-[#1E2720]">{p.name}</p>
                        {dist != null ? (
                          <span className="shrink-0 rounded-full border border-[#D4AF37] bg-[#D4AF37]/20 px-2 py-0.5 text-[10px] font-bold text-[#D4AF37]">
                            {formatDistanceKmAr(dist)}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-[#1E2720]/60">
                        {placeBankCategoryLabel(p.category)}
                        {p.city ? ` · ${p.city}` : ''}
                      </p>
                      <button
                        type="button"
                        onClick={() => addPlaceToDay(p)}
                        className={`mt-2 w-full px-3 py-2 text-sm ${BTN_GOLD}`}
                      >
                        إضافة للمسار ➕
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {placesTotalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-gray-200 bg-white/80 px-3 py-2">
              <button
                type="button"
                disabled={placesPage <= 0}
                onClick={() => setPlacesPage((p) => Math.max(0, p - 1))}
                className="text-xs font-bold text-[#1E2720] disabled:opacity-40"
              >
                السابق
              </button>
              <span className="text-xs text-[#1E2720]/50">
                {placesPage + 1}/{placesTotalPages}
              </span>
              <button
                type="button"
                disabled={placesPage >= placesTotalPages - 1}
                onClick={() => setPlacesPage((p) => p + 1)}
                className="text-xs font-bold text-[#1E2720] disabled:opacity-40"
              >
                التالي
              </button>
            </div>
          ) : null}
        </aside>

        {/* LEFT PANE 65% — Builder */}
        <main className={`w-[65%] overflow-y-auto p-6 ${CARD}`}>
          <div className="mb-6 flex items-center justify-between">
            <h2 className={HEADING}>مخطط المسار اليومي</h2>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveItinerary()}
              className={`px-4 py-2 ${BTN_GOLD}`}
            >
              {saving ? 'جاري الإنشاء…' : 'إنشاء المسار'}
            </button>
          </div>

          <VipCompassPreferences />

          <div className="mb-4 flex flex-wrap gap-2">
            {draft.days.map((day, i) => (
              <button
                key={day.id}
                type="button"
                onClick={() => setActiveDayId(day.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                  day.id === activeDayId
                    ? 'bg-[#D4AF37] text-black hover:bg-yellow-500'
                    : `${BTN_GHOST}`
                }`}
              >
                اليوم {i + 1}
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                activeDay &&
                patchDay(activeDay.id, (day) =>
                  patchDayActivities(day, [...dayToActivities(day), createTransportActivity()]),
                )
              }
              className={`px-3 py-1.5 ${BTN_GHOST}`}
            >
              + انتقال
            </button>
          </div>

          {activeDay ? (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3">
                <input
                  className={INPUT}
                  placeholder="عنوان اليوم"
                  value={activeDay.title}
                  onChange={(e) => patchDay(activeDay.id, (d) => ({ ...d, title: e.target.value }))}
                />
                <input
                  className={INPUT}
                  placeholder="المدينة"
                  value={activeDay.city}
                  onChange={(e) => patchDay(activeDay.id, (d) => ({ ...d, city: e.target.value }))}
                />
              </div>
              <div className="mb-4 rounded-xl border border-gray-200 bg-[#FAFAFA] p-4">
                <VipDayCardHeader
                  dayTitle={
                    activeDay.title?.trim() ||
                    `اليوم ${draft.days.findIndex((d) => d.id === activeDay.id) + 1}`
                  }
                  city={activeDay.city}
                  dayIndex={Math.max(0, draft.days.findIndex((d) => d.id === activeDay.id))}
                  activities={dayToActivities(activeDay)}
                />
              </div>
            </>
          ) : null}

          <div className="daily-timeline-builder space-y-4">
            {timelineActs.length === 0 ? (
              <p className="py-16 text-center text-sm font-semibold text-[#1E2720]/50">
                اضغط «إضافة للمسار ➕» من مستكشف الأماكن (يمين)
              </p>
            ) : (
              timelineActs.map((act, index) => {
                const coords = act.kind === 'place' ? activityMapCoordinates(act) : null;
                const isOrigin = proximityOrigin?.activityId === act.id;
                return (
                  <article
                    key={act.id}
                    className={`rounded-xl border bg-white p-4 ${
                      isOrigin ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/40' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex gap-3">
                      {act.image_url?.trim() ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={act.image_url}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-md border border-gray-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-xs font-bold text-[#1E2720]/50">
                          {index + 1}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-[#1E2720]">
                              {act.place_name || kindLabel(act.kind)}
                            </h3>
                            {act.kind === 'place' ? (
                              <p className="text-xs text-[#1E2720]/60">
                                {placeBankCategoryLabel(act.category)}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => activeDay && removeActivity(activeDay.id, act.id)}
                            className="text-red-700"
                            aria-label="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {act.kind === 'place' ? (
                          <button
                            type="button"
                            disabled={nearbyDisabled}
                            onClick={() => void handleNearbySearch(act)}
                            className={`mt-2 px-3 py-1.5 text-xs ${BTN_GOLD} ${
                              isOrigin ? 'ring-2 ring-[#D4AF37]/60' : ''
                            } disabled:cursor-not-allowed disabled:opacity-40`}
                          >
                            📍 أماكن قريبة
                          </button>
                        ) : null}

                        {act.kind === 'place' || act.kind === 'transport' ? (
                          <label className="mt-3 block">
                            <span className={LABEL}>وقت الزيارة</span>
                            <input
                              type="time"
                              className={INPUT}
                              value={act.visit_time || act.time_slot || ''}
                              onChange={(e) => {
                                const visit_time = e.target.value
                                activeDay &&
                                  updateActivity(activeDay.id, act.id, {
                                    visit_time,
                                    time_slot: visit_time,
                                  })
                              }}
                            />
                          </label>
                        ) : null}

                        {index > 0 && act.kind !== 'transport' ? (
                          <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-white p-2">
                            <label>
                              <span className={LABEL}>وسيلة النقل</span>
                              <select
                                className={SELECT}
                                value={act.transit_mode || 'car'}
                                onChange={(e) =>
                                  activeDay &&
                                  updateActivity(activeDay.id, act.id, {
                                    transit_mode: e.target.value as typeof act.transit_mode,
                                  })
                                }
                              >
                                <option value="car">سيارة</option>
                                <option value="walk">مشي</option>
                                <option value="metro">مترو</option>
                              </select>
                            </label>
                            <label>
                              <span className={LABEL}>المدة</span>
                              <input
                                className={INPUT}
                                value={act.transit_duration}
                                placeholder="25 دقيقة"
                                onChange={(e) =>
                                  activeDay &&
                                  updateActivity(activeDay.id, act.id, {
                                    transit_duration: e.target.value,
                                  })
                                }
                              />
                            </label>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </main>
      </section>
    </div>
  );
}

