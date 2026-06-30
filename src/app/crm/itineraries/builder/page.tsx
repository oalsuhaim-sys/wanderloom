'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DragDropContext } from '@hello-pangea/dnd';

import SimpleItineraryDayPlanner from '@/app/crm/itineraries/_components/SimpleItineraryDayPlanner';
import SimpleItineraryPlacesBank from '@/app/crm/itineraries/_components/SimpleItineraryPlacesBank';
import TripGeographySelectors from '@/app/crm/itineraries/_components/TripGeographySelectors';
import ItineraryHotelsEditor from '@/app/crm/itineraries/_components/ItineraryHotelsEditor';
import { normalizeSingleArrivalCity } from '@/lib/vip-flight-voucher';
import { QuickAddPlaceModal, useQuickAddPlace } from '@/app/crm/itineraries/_components/useQuickAddPlace';
import {
  createEmptyDay,
  createEmptyHotelEntry,
  type ItineraryHotelEntry,
  type SimpleItineraryDay,
  withTransportDefaults,
} from '@/app/crm/itineraries/_components/simple-itinerary-day-utils';
import { useSimpleItineraryDays } from '@/app/crm/itineraries/_components/useSimpleItineraryDays';
import {
  buildSupplierBriefClientContext,
  type SupplierBriefClientContext,
} from '@/lib/supplier-whatsapp-brief';
import {
  buildStrictSimpleItineraryInsertPayload,
  stripItineraryPayloadForSchemaError,
} from '@/lib/itinerary-builder-model';
import {
  buildDestinationSummary,
  filterPlacesByCities,
  type GeoTripType,
} from '@/lib/itinerary-geography';
import { supabase } from '@/lib/supabase';

function formatSupabaseSaveError(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}): string {
  const parts = [error.message, error.details, error.hint, error.code ? `(${error.code})` : '']
    .filter(Boolean)
    .join(' — ');
  const msg = parts || 'فشل الحفظ.';
  if (/column|schema|does not exist|permission|RLS|policy|42501|42703/i.test(msg)) {
    return `${msg} — تحقق من عمود days_data (JSONB) وصلاحيات RLS في Supabase.`;
  }
  return msg;
}

function arabicTransportToMode(value: string): string {
  if (value === 'مشي') return 'walking';
  if (value === 'مترو') return 'metro';
  return 'car';
}

function itineraryDaysToDaysData(days: SimpleItineraryDay[]): unknown[] {
  return days.map((day, idx) => {
    const places = day.places.map(withTransportDefaults);
    const itinerary_stops = places.map((p, placeIndex) => ({
      sort_order: placeIndex + 1,
      place_name: p.name,
      category: p.category,
      places_bank_id: p.id != null ? String(p.id) : undefined,
      ...(placeIndex > 0
        ? {
            transit_mode: arabicTransportToMode(p.transportToNext ?? 'سيارة'),
            transit_duration: p.transportDuration ?? '',
          }
        : {}),
    }));

  return {
      day_number: idx + 1,
      id: day.id,
      title: day.title,
      ...(day.city ? { city: day.city.trim() } : {}),
      ...(day.hotelName ? { hotelName: day.hotelName, hotel_name: day.hotelName } : {}),
      places,
      itinerary_stops,
      stops: itinerary_stops,
    };
  });
}

export default function ItineraryBuilderWorkspace() {
  const router = useRouter();
  // --- 1. States (الحالات) ---
  const [places, setPlaces] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [activeClient, setActiveClient] = useState<any | null>(null);
  const [clientInterests, setClientInterests] = useState<string[]>([]);
  const [accessCode, setAccessCode] = useState('');

  // البحث والفلاتر
  const [searchQuery, setSearchQuery] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [flightArrivalCity, setFlightArrivalCity] = useState('');
  const [tripTitle, setTripTitle] = useState('');
  const [geoTripType, setGeoTripType] = useState<GeoTripType>('single');
  const [tripCountries, setTripCountries] = useState<string[]>([]);
  const [tripCities, setTripCities] = useState<string[]>([]);
  const [customCitiesText, setCustomCitiesText] = useState('');
  const [tripDateFrom, setTripDateFrom] = useState('');
  const [tripDateTo, setTripDateTo] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // المالية
  const [budget, setBudget] = useState('');
  const [paid, setPaid] = useState('');
  const remaining = (Number(budget) || 0) - (Number(paid) || 0);

  // البوردينق والفندق
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [gate, setGate] = useState('');
  const [seat, setSeat] = useState('');
  const [pnr, setPnr] = useState('');
  const [hotels, setHotels] = useState<ItineraryHotelEntry[]>([createEmptyHotelEntry()]);

  const {
    itineraryDays,
    activeDayId,
    setActiveDayId,
    activeDayLabel,
    handleAddDay,
    handleAddPlace,
    handleRemovePlace,
    updateTransport,
    updateDayHotel,
    updateDayCity,
    onDragEnd,
    dayDroppableId,
  } = useSimpleItineraryDays([createEmptyDay(0)]);

  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // --- 2. جلب البيانات (تخطي أخطاء التايب سكريبت) ---
  useEffect(() => {
    async function loadInitialData() {
      if (!supabase) return;

      try {
        const allPlaces: any[] = [];
        for (let offset = 0; offset < 10_000; offset += 1000) {
          const { data: placesData, error } = await supabase
            .from('places')
            .select('*')
            .order('name', { ascending: true })
            .range(offset, offset + 999);

          if (error) {
            console.error('Failed to load places', error);
            break;
          }
          if (!placesData?.length) break;
          allPlaces.push(...placesData);
          if (placesData.length < 1000) break;
        }
        setPlaces(allPlaces as any[]);

        const { data: clientsData } = await supabase.from('clients').select('*');
        if (clientsData) setClients(clientsData as any[]);
      } catch (error) {
        console.error('Data loading error:', error);
      }
    }
    void loadInitialData();
  }, []);

  // --- 3. استخراج المدن والفئات للقوائم ---
  const uniqueCities = useMemo(
    () =>
      Array.from(
        new Set(
          (tripCities.length ? tripCities : places.map((p) => p.city)).filter(Boolean),
        ),
      ),
    [tripCities, places],
  );
  const uniqueCategories = Array.from(new Set(places.map((p) => p.category).filter(Boolean)));

  useEffect(() => {
    if (tripCities.length === 1) {
      setFilterCity(tripCities[0]!);
    } else if (tripCities.length === 0) {
      setFilterCity('');
    }
  }, [tripCities]);

  // تحديث العميل النشط
  useEffect(() => {
    if (selectedClientId) {
      const found = clients.find(c => c.id == selectedClientId);
      setActiveClient(found || null);
    }
  }, [selectedClientId, clients]);

  useEffect(() => {
    async function loadClientInterests() {
      if (!supabase || !selectedClientId) {
        setClientInterests([]);
      return;
    }
      const { data } = await supabase
        .from('client_preferences')
        .select('interests')
        .eq('client_id', selectedClientId)
        .maybeSingle();
      setClientInterests(
        Array.isArray((data as { interests?: unknown } | null)?.interests)
          ? ((data as { interests: unknown[] }).interests.map((x) => String(x).trim()).filter(Boolean))
          : [],
      );
    }
    void loadClientInterests();
  }, [selectedClientId]);

  const supplierBrief = useMemo((): SupplierBriefClientContext | null => {
    if (!selectedClientId) return null;
    return buildSupplierBriefClientContext({
      clientRow: activeClient,
      interests: clientInterests,
      tripDateFrom,
      tripDateTo,
      destination: buildDestinationSummary(tripCities, tripCountries) || tripTitle,
    });
  }, [activeClient, clientInterests, tripCities, tripCountries, tripTitle, selectedClientId, tripDateFrom, tripDateTo]);

  const handleSave = useCallback(async () => {
    if (!supabase) {
      setSaveNotice('قاعدة البيانات غير مهيأة.');
      return;
    }

    setSaving(true);
    setSaveNotice(null);

    const passcode = accessCode.trim().toUpperCase();
    const serializedDays = itineraryDaysToDaysData(itineraryDays);

    const destinationSummary = buildDestinationSummary(tripCities, tripCountries) || tripTitle;

    const payload = buildStrictSimpleItineraryInsertPayload({
      daysData: serializedDays,
      budget,
      paid,
      departureTime,
      arrivalTime,
      bookingRef: pnr,
      passcode,
      title: tripTitle || destinationSummary,
      destination: destinationSummary,
      geoTripType,
      countries: tripCountries,
      cities: tripCities,
      datesFrom: tripDateFrom,
      datesTo: tripDateTo,
      originCity,
      arrivalCity: normalizeSingleArrivalCity(flightArrivalCity),
      gate,
      seat,
      hotels: hotels.map((h) => ({
        name: h.name,
        pnr: h.pnr,
        checkIn: h.checkIn,
        checkOut: h.checkOut,
      })),
      customerName: activeClient?.name ? String(activeClient.name) : 'عميل VIP',
      clientId:
        selectedClientId && Number.isFinite(Number(selectedClientId))
          ? Number(selectedClientId)
          : null,
    });

    try {
      let res = await supabase.from('itineraries').insert(payload).select('id').single();
      if (res.error && /column|schema cache|does not exist/i.test(res.error.message ?? '')) {
        res = await supabase
        .from('itineraries')
          .insert(stripItineraryPayloadForSchemaError(res.error.message ?? '', payload))
          .select('id')
        .single();
      }
      if (res.error) {
        console.error('Supabase Save Error:', res.error);
        throw new Error(formatSupabaseSaveError(res.error));
      }

      setSaveNotice('تم حفظ المسار بنجاح.');
      if (res.data?.id != null) {
        router.push(`/crm/itineraries/${res.data.id}/edit`);
      }
    } catch (e) {
      console.error('Unexpected save error:', e);
      setSaveNotice(e instanceof Error ? e.message : 'فشل حفظ المسار.');
    } finally {
      setSaving(false);
    }
  }, [
    accessCode,
    tripTitle,
    geoTripType,
    tripCountries,
    tripCities,
    flightArrivalCity,
    tripDateFrom,
    tripDateTo,
    originCity,
    budget,
    paid,
    departureTime,
    arrivalTime,
    gate,
    seat,
    pnr,
    hotels,
    itineraryDays,
    activeClient,
    selectedClientId,
    router,
  ]);

  // --- 4. فلترة بنك الأماكن ---
  const displayedPlaces = useMemo(() => {
    const geoFiltered = filterPlacesByCities(places, tripCities);
    return geoFiltered.filter((place) => {
      const matchSearch = place.name?.includes(searchQuery) || place.city?.includes(searchQuery);
      const matchCity = filterCity ? place.city === filterCity : true;
      const matchCategory = filterCategory ? place.category === filterCategory : true;
      return matchSearch && matchCity && matchCategory;
    });
  }, [places, tripCities, searchQuery, filterCity, filterCategory]);

  const handleDragEnd = useCallback(
    (result: import('@hello-pangea/dnd').DropResult) => {
      onDragEnd(result, displayedPlaces);
    },
    [onDragEnd, displayedPlaces],
  );

  const handleQuickAddPlaceCreated = useCallback(
    (place: Record<string, unknown>) => {
      setPlaces((prev) => [...prev, place]);
      handleAddPlace(place);
    },
    [handleAddPlace],
  );

  const {
    isQuickAddModalOpen,
    setIsQuickAddModalOpen,
    newPlaceData,
    setNewPlaceData,
    quickAddSaving,
    quickAddError,
    openQuickAddModal,
    handleQuickAddPlace,
  } = useQuickAddPlace({
    defaultCity: filterCity || tripCities[0] || '',
    onPlaceCreated: handleQuickAddPlaceCreated,
    onClearSearch: () => setSearchQuery(''),
  });

  // --- 5. واجهة المستخدم ---
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1E2720] p-8 font-sans" dir="rtl">
      <div className="mb-6 flex items-center justify-between">
          <div>
          <h1 className="text-3xl font-bold text-gray-900">مساحة بناء المسار الذكي</h1>
          </div>
          <button
            type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-lg bg-[#1A2520] px-8 py-3 font-bold text-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-60"
          >
          {saving ? 'جاري الحفظ...' : 'حفظ المسار'}
          </button>
        </div>

      <div className="mb-8 rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="min-w-0 md:col-span-2">
            <TripGeographySelectors
              geoTripType={geoTripType}
              onGeoTripTypeChange={setGeoTripType}
              countries={tripCountries}
              onCountriesChange={setTripCountries}
              cities={tripCities}
              onCitiesChange={setTripCities}
              tripTitle={tripTitle}
              onTripTitleChange={setTripTitle}
              customCitiesText={customCitiesText}
              onCustomCitiesTextChange={setCustomCitiesText}
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-bold text-gray-700">اسم العميل</label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 outline-none focus:border-[#D4AF37]"
              >
                <option value="">-- اختر العميل --</option>
                {clients.map((client) => (
                  <option key={String(client.id)} value={String(client.id)}>
                    {client.name || `عميل #${client.id}`}
                  </option>
                ))}
              </select>
          </div>

            <div className="min-w-0">
              <label className="mb-2 block text-sm font-bold text-gray-700">تاريخ البداية</label>
              <input
                type="date"
                value={tripDateFrom}
                onChange={(e) => setTripDateFrom(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 outline-none focus:border-[#D4AF37] [color-scheme:light]"
              />
            </div>

            <div className="min-w-0">
              <label className="mb-2 block text-sm font-bold text-gray-700">تاريخ النهاية</label>
                <input
                type="date"
                value={tripDateTo}
                onChange={(e) => setTripDateTo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 outline-none focus:border-[#D4AF37] [color-scheme:light]"
              />
            </div>
                  </div>
                </div>
          </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D4AF37]/25 bg-[#FEFDF9] px-5 py-3 shadow-sm">
        <span className="text-sm font-bold text-gray-700">كود العميل (PIN)</span>
        <div className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-[#D4AF37]/60 bg-white px-4 py-1.5">
            <input
              type="text"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
            placeholder="---"
            dir="ltr"
            size={Math.max(accessCode.length || 3, 7)}
            className="min-w-[5ch] border-0 bg-transparent p-0 text-sm font-bold tracking-wider text-[#D4AF37] outline-none placeholder:text-[#D4AF37]/40"
          />
              </div>
            </div>

      {saveNotice ? (
        <p
          className={`mb-4 rounded-lg border px-4 py-3 text-sm font-bold ${
            saveNotice.includes('بنجاح')
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
          role="status"
        >
          {saveNotice}
        </p>
      ) : null}

      {/* الملخص المالي للحجز (تم إعادته بوضوح وتصميم فخم) */}
      <section className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col gap-4">
        <h3 className="font-bold text-lg text-[#1E2720] flex items-center gap-2">
          <span>💰</span> الملخص المالي للحجز
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-600">الميزانية الإجمالية</label>
                  <input
              type="number" 
              value={budget} 
              onChange={(e) => setBudget(e.target.value)}
              placeholder="مثال: 50000" 
              className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg p-3 font-bold focus:border-[#D4AF37]" 
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-600">المدفوع من العميل</label>
                  <input
              type="number" 
              value={paid} 
              onChange={(e) => setPaid(e.target.value)}
              placeholder="مثال: 20000" 
              className="bg-gray-50 border border-gray-300 text-green-700 rounded-lg p-3 font-bold focus:border-green-500" 
            />
              </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-600">المتبقي</label>
            <div className={`p-3 rounded-lg font-bold text-lg border ${remaining > 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
              {remaining.toLocaleString()} SAR
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col gap-4">
        <h3 className="font-bold text-lg text-[#1E2720] flex items-center gap-2">
          <span>✈️</span> بيانات البوردينق والحجوزات الفندقية
              </h3>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">من مدينة (رحلة الطيران)</span>
                  <input
                    type="text"
              value={originCity}
              onChange={(e) => setOriginCity(e.target.value)}
              placeholder="مثال: الرياض"
              className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 focus:border-[#D4AF37] outline-none"
            />
                </label>
          <label className="flex flex-col gap-1.5 md:col-span-2">
            <span className="text-sm font-bold text-gray-600">
              إلى مدينة (رحلة الطيران — مدينة واحدة)
                        </span>
                  <input
              type="text"
              list="builder-flight-arrival-city-suggestions"
              value={flightArrivalCity}
              onChange={(e) => setFlightArrivalCity(e.target.value)}
              onBlur={(e) =>
                setFlightArrivalCity(normalizeSingleArrivalCity(e.target.value))
              }
              placeholder={tripCities[0] ? `مثال: ${tripCities[0]}` : 'مثال: سيول'}
              className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 focus:border-[#D4AF37] outline-none"
            />
            {tripCities.length > 0 ? (
              <datalist id="builder-flight-arrival-city-suggestions">
                {tripCities.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            ) : null}
            <span className="text-xs text-gray-500">
              مدينة هبوط الطيران فقط — لا تُربط تلقائياً بكل مدن المسار.
            </span>
                        </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">وقت المغادرة</span>
                          <input
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 focus:border-[#D4AF37] outline-none"
                          />
                        </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">وقت الوصول</span>
                            <input
              type="time"
              value={arrivalTime}
              onChange={(e) => setArrivalTime(e.target.value)}
              className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 focus:border-[#D4AF37] outline-none"
                            />
                          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">البوابة</span>
                            <input
              type="text"
              value={gate}
              onChange={(e) => setGate(e.target.value)}
              placeholder="A12"
              className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 focus:border-[#D4AF37] outline-none"
                            />
                          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">المقعد</span>
                            <input
              type="text"
              value={seat}
              onChange={(e) => setSeat(e.target.value)}
              placeholder="5A"
              className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 focus:border-[#D4AF37] outline-none"
                            />
                          </label>
          </div>

        <label className="flex max-w-md flex-col gap-1.5">
          <span className="text-sm font-bold text-gray-600">رقم تأكيد الطيران (PNR)</span>
              <input
            type="text"
            value={pnr}
            onChange={(e) => setPnr(e.target.value)}
            placeholder="ABC12X"
            className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 focus:border-[#D4AF37] outline-none"
              />
            </label>

        <h4 className="text-sm font-bold text-[#1E2720]">🏨 الفنادق والإقامة</h4>
        <ItineraryHotelsEditor
          hotels={hotels}
          onChange={setHotels}
          supplierBrief={supplierBrief}
          destinationLabel={buildDestinationSummary(tripCities, tripCountries) || tripTitle}
          tripCountries={tripCountries}
          tripCities={tripCities}
        />
        </section>

      <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-6 h-[750px]">
        {/* بنك الأماكن (اليمين) */}
        <aside className="w-[35%] bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50 flex flex-col gap-4">
            <h3 className="font-bold text-lg">بنك الأماكن ({displayedPlaces.length} مكان متاح)</h3>
            
            {/* شريط البحث */}
            <input 
              type="text" 
              placeholder="ابحث بالاسم أو الحي..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-gray-300 p-3 rounded-lg w-full focus:border-[#D4AF37] outline-none"
            />
            
            {/* الفلاتر الذكية (تم إصلاح الخلل هنا) */}
            <div className="flex gap-2">
              <select 
                value={filterCity} 
                onChange={(e) => { setFilterCity(e.target.value); setFilterCategory(''); }}
                className="flex-1 bg-white border border-gray-300 text-sm rounded-lg p-2"
              >
                <option value="">كل المدن</option>
                {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

                              <select
                value={filterCategory} 
                onChange={(e) => setFilterCategory(e.target.value)}
                className="flex-1 bg-white border border-gray-300 text-sm rounded-lg p-2"
              >
                <option value="">كل الفئات</option>
                {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                  </div>
          
          <SimpleItineraryPlacesBank
            places={displayedPlaces}
            activeDayLabel={activeDayLabel}
            searchQuery={searchQuery}
            onAddPlace={handleAddPlace}
            onQuickAddClick={() => openQuickAddModal(searchQuery)}
          />
        </aside>

        <SimpleItineraryDayPlanner
          days={itineraryDays}
          hotels={hotels}
          activeDayId={activeDayId}
          onActiveDayIdChange={setActiveDayId}
          onAddDay={handleAddDay}
          onRemovePlace={handleRemovePlace}
          onUpdateDayHotel={updateDayHotel}
          onUpdateDayCity={updateDayCity}
          onUpdateTransport={updateTransport}
          dayDroppableId={dayDroppableId}
          supplierBrief={supplierBrief}
                />
              </div>
      </DragDropContext>

      <QuickAddPlaceModal
        open={isQuickAddModalOpen}
        draft={newPlaceData}
        saving={quickAddSaving}
        error={quickAddError}
        onClose={() => setIsQuickAddModalOpen(false)}
        onChange={(patch) => setNewPlaceData((prev) => ({ ...prev, ...patch }))}
        onSave={handleQuickAddPlace}
      />
    </div>
  );
}