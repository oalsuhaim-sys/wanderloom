'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { DayWeatherApiPayload } from '@/app/api/weather/route';
import VipCompassPreferencesInteractive from '@/app/crm/itineraries/_components/VipCompassPreferencesInteractive';
import VipDayCardHeader from '@/app/crm/itineraries/_components/VipDayCardHeader';
import { pickPlaceBankCoordinates } from '@/lib/itinerary-day-activities';
import { placeBankCategoryLabel } from '@/lib/places-bank';
import {
  estimateDayActivityHours,
  extraCompassBadgesFromClient,
  fetchDestinationWeather,
  formatWeatherBadgeLabel,
  getMaxHoursForClientType,
  isActivityBeforeClientWakeUp,
  isDayPacingStrenuous,
  mapSupabaseClientToProfilePrefs,
  type ClientProfilePrefs,
  type DayPacingInput,
  type SupabaseClientCompassRow,
} from '@/lib/vip-builder-day-insights';
import { supabase } from '@/lib/supabase';
import type { PlaceBankRow } from '@/types/place';

interface Place {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category?: string;
  city?: string;
}

interface AddedPlace extends Place {
  entryId: string;
  transit_mode: string;
  transit_duration: string;
}

interface ItineraryDay {
  dayId: number;
  title: string;
  addedPlaces: AddedPlace[];
}

interface Origin {
  latitude: number;
  longitude: number;
}

function newEntryId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `place-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normText(value: string): string {
  return value.trim().toLowerCase();
}

function cityMatches(placeCity: string | undefined, filter: string): boolean {
  if (!filter.trim()) return true;
  const place = normText(placeCity ?? '');
  const target = normText(filter);
  if (!place) return false;
  return place === target || place.includes(target) || target.includes(place);
}

function categoryMatches(placeCategory: string | undefined, filter: string): boolean {
  if (!filter.trim()) return true;
  return normText(placeCategory ?? '') === normText(filter);
}

const FILTER_SELECT =
  'bg-white border border-gray-300 text-sm rounded-lg p-2 w-full text-gray-900 focus:border-[#D4AF37] focus:outline-none';

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number | null {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

const CLIENT_COMPASS_SELECT =
  'id, name, dietary, secret_notes, travel_dna, flight_preferences, hotel_preferences';

const CLIENT_COMPASS_SELECT_EXTENDED =
  'id, name, dietary, dietary_preferences, secret_notes, activity_level, travel_dna, flight_preferences, hotel_preferences';

const PLACES_SELECT = 'id, name, latitude, longitude, category, city, country';
const PLACES_SELECT_MINIMAL = 'id, name, category, city, country';

async function fetchAllPlaces(): Promise<Place[]> {
  const client = supabase;
  if (!client) return [];

  const run = async (columns: string) => {
    const all: Place[] = [];
    for (let offset = 0; offset < 10_000; offset += 1000) {
      const { data, error } = await client
        .from('places')
        .select(columns)
        .order('name', { ascending: true })
        .range(offset, offset + 999);

      if (error) throw error;
      if (!data?.length) break;
      data.forEach((row) => {
        const record = row as unknown as Record<string, unknown>;
        const coords = pickPlaceBankCoordinates(record as PlaceBankRow);
        all.push({
          id: String(record.id ?? ''),
          name: String(record.name ?? ''),
          latitude: coords?.lat ?? 0,
          longitude: coords?.lng ?? 0,
          category: record.category ? String(record.category) : undefined,
          city: record.city ? String(record.city) : undefined,
        });
      });
      if (data.length < 1000) break;
    }
    return all;
  };

  try {
    return await run(PLACES_SELECT);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/column|schema cache|does not exist/i.test(message)) {
      return run(PLACES_SELECT_MINIMAL);
    }
    return [];
  }
}

async function fetchClientCompassRow(clientId: string): Promise<SupabaseClientCompassRow | null> {
  if (!supabase || !clientId) return null;

  let result = await supabase
    .from('clients')
    .select(CLIENT_COMPASS_SELECT_EXTENDED)
    .eq('id', clientId)
    .maybeSingle();

  if (result.error && /column|schema cache|does not exist/i.test(result.error.message ?? '')) {
    result = await supabase
      .from('clients')
      .select(CLIENT_COMPASS_SELECT)
      .eq('id', clientId)
      .maybeSingle();
  }

  if (result.error || !result.data) return null;
  return result.data as SupabaseClientCompassRow;
}

export default function CreateNewItinerary() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [nearbyOrigin, setNearbyOrigin] = useState<Origin | null>(null);

  const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientPrefs, setClientPrefs] = useState<ClientProfilePrefs | null>(null);
  const [extraCompassBadges, setExtraCompassBadges] = useState<string[]>([]);
  const [clientProfileLoading, setClientProfileLoading] = useState(false);

  const [destinationCity, setDestinationCity] = useState('');
  const [tripStartDate, setTripStartDate] = useState('');
  const [realWeather, setRealWeather] = useState<DayWeatherApiPayload | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const [itineraryDays, setItineraryDays] = useState<ItineraryDay[]>([
    { dayId: 1, title: 'اليوم الأول', addedPlaces: [] },
  ]);
  const [firstActivityStart, setFirstActivityStart] = useState('09:00');

  const firstDay = itineraryDays[0];

  const dayPacingInputs: DayPacingInput[] = useMemo(
    () =>
      (firstDay?.addedPlaces ?? []).map((p) => ({
        kind: 'place' as const,
        transit_duration: p.transit_duration,
      })),
    [firstDay?.addedPlaces],
  );

  const prefsForUi = clientPrefs ?? {
    type: 'شباب' as const,
    wakeUpTime: '09:00',
    activityLevel: 'متوسط' as const,
  };

  const maxHours = useMemo(
    () => getMaxHoursForClientType(prefsForUi.type),
    [prefsForUi.type],
  );
  const totalDayHours = useMemo(
    () => estimateDayActivityHours(dayPacingInputs),
    [dayPacingInputs],
  );
  const pacingStrenuous = isDayPacingStrenuous(totalDayHours, maxHours);
  const wakeUpWarning =
    clientPrefs != null &&
    isActivityBeforeClientWakeUp(firstActivityStart, clientPrefs.wakeUpTime);

  const weatherLabel = useMemo(() => {
    if (weatherLoading && destinationCity.trim()) return '🌤️ جاري تحميل الطقس…';
    if (realWeather) return formatWeatherBadgeLabel(realWeather);
    return undefined;
  }, [realWeather, weatherLoading, destinationCity]);

  useEffect(() => {
    if (!supabase) {
      setPlacesLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setPlacesLoading(true);
      const [fetchedPlaces, clientsResult] = await Promise.all([
        fetchAllPlaces(),
        supabase.from('clients').select('id, name').order('name', { ascending: true }),
      ]);
      if (cancelled) return;
      setPlaces(fetchedPlaces);
      if (clientsResult.data) {
        setClients(clientsResult.data as { id: number; name: string }[]);
      }
      setPlacesLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedClientId) {
      setClientPrefs(null);
      setExtraCompassBadges([]);
      setClientProfileLoading(false);
      return;
    }

    let cancelled = false;
    setClientProfileLoading(true);

    void (async () => {
      const row = await fetchClientCompassRow(selectedClientId);
      if (cancelled) return;
      if (row) {
        setClientPrefs(mapSupabaseClientToProfilePrefs(row));
        setExtraCompassBadges(extraCompassBadgesFromClient(row));
      } else {
        setClientPrefs(null);
        setExtraCompassBadges([]);
      }
      setClientProfileLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedClientId]);

  useEffect(() => {
    const city = destinationCity.trim();
    if (!city) {
      setRealWeather(null);
      setWeatherLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setWeatherLoading(true);
      void (async () => {
        const payload = await fetchDestinationWeather(city, tripStartDate || undefined);
        if (cancelled) return;
        setRealWeather(payload);
        setWeatherLoading(false);
      })();
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [destinationCity, tripStartDate]);

  /** مزامنة مرشّح المدينة مع وجهة الرحلة عندما لم يختر الموظف مدينة يدوياً */
  useEffect(() => {
    const dest = destinationCity.trim();
    if (!dest) return;
    setFilterCity((prev) => (prev.trim() === '' ? dest : prev));
  }, [destinationCity]);

  const effectiveCityFilter = filterCity.trim() || destinationCity.trim();

  const placesForCategoryOptions = useMemo(() => {
    if (!effectiveCityFilter) return places;
    return places.filter((p) => cityMatches(p.city, effectiveCityFilter));
  }, [places, effectiveCityFilter]);

  const uniqueCities = useMemo(() => {
    const set = new Set<string>();
    places.forEach((p) => {
      const city = p.city?.trim();
      if (city) set.add(city);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'ar'));
  }, [places]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    placesForCategoryOptions.forEach((p) => {
      const cat = p.category?.trim();
      if (cat) set.add(cat);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'ar'));
  }, [placesForCategoryOptions]);

  useEffect(() => {
    if (!filterCategory) return;
    if (uniqueCategories.some((c) => normText(c) === normText(filterCategory))) return;
    setFilterCategory('');
  }, [filterCategory, uniqueCategories]);

  const handleAddPlace = useCallback((place: Place) => {
    const added: AddedPlace = {
      ...place,
      entryId: newEntryId(),
      transit_mode: 'سيارة خاصة',
      transit_duration: '',
    };
    setItineraryDays((days) =>
      days.map((day, index) =>
        index === 0 ? { ...day, addedPlaces: [...day.addedPlaces, added] } : day,
      ),
    );
  }, []);

  const handleRemovePlace = useCallback((dayId: number, entryId: string) => {
    setItineraryDays((days) =>
      days.map((day) =>
        day.dayId === dayId
          ? { ...day, addedPlaces: day.addedPlaces.filter((p) => p.entryId !== entryId) }
          : day,
      ),
    );
  }, []);

  const patchAddedPlace = useCallback(
    (dayId: number, entryId: string, patch: Partial<Pick<AddedPlace, 'transit_mode' | 'transit_duration'>>) => {
      setItineraryDays((days) =>
        days.map((day) =>
          day.dayId === dayId
            ? {
                ...day,
                addedPlaces: day.addedPlaces.map((p) =>
                  p.entryId === entryId ? { ...p, ...patch } : p,
                ),
              }
            : day,
        ),
      );
    },
    [],
  );

  const displayedPlaces = useMemo(() => {
    const q = normText(searchQuery);

    return places.filter((place) => {
      if (q) {
        const name = normText(place.name);
        const city = normText(place.city ?? '');
        if (!name.includes(q) && !city.includes(q)) return false;
      }

      if (!cityMatches(place.city, effectiveCityFilter)) return false;
      if (!categoryMatches(place.category, filterCategory)) return false;

      if (nearbyOrigin) {
        const dist = calculateDistance(
          nearbyOrigin.latitude,
          nearbyOrigin.longitude,
          place.latitude,
          place.longitude,
        );
        if (dist === null || dist > 5) return false;
      }

      return true;
    });
  }, [places, searchQuery, effectiveCityFilter, filterCategory, nearbyOrigin]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1E2720] p-8 font-sans" dir="rtl">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#1E2720]">إنشاء مسار رحلة جديد</h1>
          <p className="text-gray-500 mt-1">واجهة الإدخال السريعة - Wanderloom VIP</p>
        </div>
        <button className="bg-[#1E2720] text-[#D4AF37] px-8 py-3 rounded-lg font-bold shadow-md hover:bg-[#2a362c] transition-all">
          حفظ وإصدار المسار
        </button>
      </header>

      <div className="flex flex-col gap-6">
        <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-xl font-bold text-[#1E2720] mb-6 flex items-center gap-2">
            <span className="w-2 h-6 bg-[#D4AF37] rounded-full"></span>
            بيانات البوردينق والحجوزات
          </h2>

          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-gray-700 text-sm">اختر العميل</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="bg-white text-gray-900 border border-gray-300 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] p-3 rounded-lg w-full"
                >
                  <option value="">اختر العميل…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
            </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-gray-700 text-sm">المدينة</label>
                <input
                  type="text"
                  placeholder="مثال: باريس"
                  value={destinationCity}
                  onChange={(e) => setDestinationCity(e.target.value)}
                  className="bg-white text-gray-900 border border-gray-300 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] p-3 rounded-lg w-full"
                />
          </div>
          </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-gray-700 text-sm">رقم الرحلة</label>
                <input
                  type="text"
                  placeholder="مثال: SV130"
                  className="bg-white text-gray-900 border border-gray-300 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] p-3 rounded-lg w-full"
                />
        </div>
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-gray-700 text-sm">وقت المغادرة</label>
                <input
                  type="time"
                  className="bg-white text-gray-900 border border-gray-300 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] p-3 rounded-lg w-full"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-gray-700 text-sm">وقت الوصول</label>
                <input
                  type="time"
                  className="bg-white text-gray-900 border border-gray-300 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] p-3 rounded-lg w-full"
                />
                </div>
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-gray-700 text-sm">البوابة</label>
                <input
                  type="text"
                  placeholder="A12"
                  className="bg-white text-gray-900 border border-gray-300 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] p-3 rounded-lg w-full"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-gray-700 text-sm">المقعد</label>
                <input
                  type="text"
                  placeholder="5A"
                  className="bg-white text-gray-900 border border-gray-300 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] p-3 rounded-lg w-full"
                />
                </div>
              </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-gray-700 text-sm">اسم الفندق</label>
                <input
                  type="text"
                  placeholder="فندق الريتز كارلتون"
                  className="bg-white text-gray-900 border border-gray-300 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] p-3 rounded-lg w-full"
                />
                  </div>
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-gray-700 text-sm">رقم التأكيد (PNR)</label>
                <input
                  type="text"
                  placeholder="ABC12X"
                  className="bg-white text-gray-900 border border-gray-300 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] p-3 rounded-lg w-full"
                />
                  </div>
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-gray-700 text-sm">تسجيل الدخول</label>
                <input
                  type="date"
                  value={tripStartDate}
                  onChange={(e) => setTripStartDate(e.target.value)}
                  className="bg-white text-gray-900 border border-gray-300 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] p-3 rounded-lg w-full"
                />
                </div>
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-gray-700 text-sm">تسجيل الخروج</label>
                <input
                  type="date"
                  className="bg-white text-gray-900 border border-gray-300 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] p-3 rounded-lg w-full"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="flex gap-6 h-[800px]">
          <aside className="w-[35%] bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50 flex flex-col gap-4">
              <h3 className="font-bold text-lg text-[#1E2720]">بنك الأماكن (6400+ موقع)</h3>
              <input
                type="text"
                placeholder="ابحث عن مطعم، معلم، أو مدينة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white text-gray-900 border border-gray-300 p-3 rounded-lg w-full focus:border-[#D4AF37] focus:outline-none"
              />
              <div className="flex flex-wrap gap-2">
                <label className="flex min-w-[48%] flex-1 flex-col gap-1">
                  <span className="text-xs font-bold text-gray-600">المدينة</span>
                  <select
                    value={filterCity}
                    onChange={(e) => setFilterCity(e.target.value)}
                    className={FILTER_SELECT}
                  >
                    <option value="">
                      {destinationCity.trim() && !filterCity.trim()
                        ? `كل المدن (مرشّح: ${destinationCity.trim()})`
                        : 'كل المدن'}
                    </option>
                    {uniqueCities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-w-[48%] flex-1 flex-col gap-1">
                  <span className="text-xs font-bold text-gray-600">الفئة</span>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className={FILTER_SELECT}
                  >
                    <option value="">كل الفئات</option>
                    {uniqueCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {placeBankCategoryLabel(cat)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {!placesLoading && places.length > 0 ? (
                <p className="text-[11px] font-semibold text-gray-500">
                  {displayedPlaces.length.toLocaleString('ar')} من{' '}
                  {places.length.toLocaleString('ar')} مكان
                  {effectiveCityFilter ? ` · ${effectiveCityFilter}` : ''}
                </p>
              ) : null}
              {nearbyOrigin && (
                <div className="bg-[#1E2720] text-white p-3 rounded-lg flex justify-between items-center text-sm">
                  <span>📍 يعرض الأماكن في محيط 5 كم</span>
                  <button
                    onClick={() => setNearbyOrigin(null)}
                    className="text-[#D4AF37] hover:underline font-bold"
                  >
                    إلغاء
                  </button>
                </div>
              )}
                    </div>

            <div className="p-4 flex-1 overflow-y-auto bg-gray-50 flex flex-col gap-4">
              {placesLoading ? (
                <p className="text-center text-sm text-gray-500 py-8">جاري تحميل بنك الأماكن…</p>
              ) : displayedPlaces.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-8">
                  لا توجد أماكن مطابقة — جرّب تعديل البحث أو المرشّحات.
                </p>
              ) : (
                displayedPlaces.map((place) => (
                  <div
                    key={place.id}
                    className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm flex flex-col gap-3 hover:border-[#D4AF37] transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-[#1E2720]">{place.name}</h4>
                      {place.category ? (
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                          {placeBankCategoryLabel(place.category)}
                        </span>
                      ) : null}
                    </div>
                    {place.city ? <p className="text-sm text-gray-500">{place.city}</p> : null}
                    <button
                      type="button"
                      onClick={() => handleAddPlace(place)}
                      className="mt-2 bg-[#D4AF37] text-[#1E2720] font-bold py-2 rounded-lg w-full hover:bg-[#c29f2f] transition-colors"
                    >
                      إضافة للمسار ➕
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>

          <main className="w-[65%] bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h2 className="text-2xl font-bold text-[#1E2720]">مخطط المسار اليومي</h2>
              <button className="bg-gray-100 text-[#1E2720] px-4 py-2 rounded-md font-bold hover:bg-gray-200">
                + إضافة يوم جديد
              </button>
            </div>

            <VipCompassPreferencesInteractive
              prefs={prefsForUi}
              onChange={(next) => {
                setClientPrefs(next);
              }}
              maxHours={maxHours}
              extraBadges={extraCompassBadges}
              loading={clientProfileLoading}
            />

            <div className="flex flex-col gap-6">
              {itineraryDays.map((day, dayIndex) => (
                <div
                  key={day.dayId}
                  className="bg-[#FAFAFA] border border-gray-200 rounded-xl p-5"
                >
                  <VipDayCardHeader
                    dayTitle={day.title}
                    city={destinationCity}
                    dayIndex={dayIndex}
                    activities={day.addedPlaces.map((p) => ({
                      kind: 'place' as const,
                      transit_duration: p.transit_duration,
                    }))}
                    maxHours={maxHours}
                    weatherLabelOverride={dayIndex === 0 ? weatherLabel : undefined}
                    showWakeUpWarning={dayIndex === 0 ? wakeUpWarning : false}
                    fatigueWarningMessage={
                      dayIndex === 0 && pacingStrenuous && clientPrefs
                        ? '⚠️ الجدول مجهد جداً بناءً على تفضيلات هذا العميل.'
                        : undefined
                    }
                  />

                  {day.addedPlaces.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-6">
                      أضف أنشطة من بنك الأماكن لبدء تخطيط اليوم.
                    </p>
                  ) : (
                  day.addedPlaces.map((place, index) => (
                    <div
                      key={place.entryId}
                      className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col gap-4 mb-4 last:mb-0"
                    >
                      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 pb-3">
                        <div className="flex flex-col gap-1">
                          <h4 className="font-bold text-lg text-[#1E2720]">{place.name}</h4>
                          {index === 0 ? (
                            <p className="text-xs text-gray-500">أول نشاط في اليوم</p>
                          ) : null}
                        </div>
                        {index === 0 && dayIndex === 0 ? (
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-gray-600">وقت البداية</span>
                        <input
                              type="time"
                              value={firstActivityStart}
                              onChange={(e) => setFirstActivityStart(e.target.value)}
                              className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm font-semibold text-gray-900 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
                            />
                          </label>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleRemovePlace(day.dayId, place.entryId)}
                          className="text-red-500 hover:text-red-700 font-bold text-sm"
                        >
                          حذف
                        </button>
                    </div>

                      {index > 0 ? (
                        <div className="flex gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                          <div className="flex-1 flex flex-col gap-1">
                            <label className="text-xs font-bold text-gray-600">وسيلة النقل</label>
                            <select
                              value={place.transit_mode || 'سيارة خاصة'}
                              onChange={(e) =>
                                patchAddedPlace(day.dayId, place.entryId, {
                                  transit_mode: e.target.value,
                                })
                              }
                              className="bg-white border border-gray-300 text-gray-900 text-sm rounded p-2"
                            >
                              <option value="سيارة خاصة">سيارة خاصة</option>
                              <option value="مشي">مشي</option>
                            </select>
                          </div>
                          <div className="flex-1 flex flex-col gap-1">
                            <label className="text-xs font-bold text-gray-600">مدة الانتقال</label>
                            <input
                              type="text"
                              value={place.transit_duration}
                              onChange={(e) =>
                                patchAddedPlace(day.dayId, place.entryId, {
                                  transit_duration: e.target.value,
                                })
                              }
                              placeholder="15 دقيقة"
                              className="bg-white border border-gray-300 text-gray-900 text-sm rounded p-2"
                            />
                    </div>
                  </div>
                      ) : null}

                      {place.latitude && place.longitude ? (
                        <button
                          type="button"
                          onClick={() =>
                            setNearbyOrigin({
                              latitude: place.latitude,
                              longitude: place.longitude,
                            })
                          }
                          className="self-start text-sm bg-[#1E2720] text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
                        >
                          <span>📍</span> ابحث عن أماكن قريبة
                        </button>
                      ) : null}
                    </div>
                  ))
                  )}
                </div>
              ))}
            </div>
          </main>
        </section>
        </div>
    </div>
  );
}
