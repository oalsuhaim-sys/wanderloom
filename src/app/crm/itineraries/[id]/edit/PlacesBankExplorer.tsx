'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin, Search, X } from 'lucide-react';

import {
  VIP_INPUT,
  VIP_OPTION,
  VIP_PANEL,
  VIP_PANEL_BODY,
  VIP_PANEL_HEAD,
  VIP_SELECT,
} from '@/app/crm/itineraries/[id]/edit/vip-crm-theme';
import {
  PLACES_BANK_CATEGORIES,
  PLACES_BANK_PAGE_SIZE,
  fetchPlacesBankPage,
  placeBankCategoryLabel,
} from '@/lib/places-bank';
import {
  fetchPlacesForProximityEngine,
  filterPlacesByProximity,
  formatDistanceKmAr,
  PROXIMITY_RADIUS_KM,
  type PlaceWithDistance,
  type ProximityOrigin,
} from '@/lib/places-proximity';
import { supabase } from '@/lib/supabase';
import type { PlaceBankRow } from '@/types/place';

type Props = {
  countryBias?: string;
  cityBias?: string;
  activeDayLabel: string;
  onAddToDay: (place: PlaceBankRow) => void;
  proximityOrigin: ProximityOrigin | null;
  onClearProximity: () => void;
};

export default function PlacesBankExplorer({
  countryBias = '',
  cityBias = '',
  activeDayLabel,
  onAddToDay,
  proximityOrigin,
  onClearProximity,
}: Props) {
  const [places, setPlaces] = useState<PlaceBankRow[]>([]);
  const [proximityList, setProximityList] = useState<PlaceWithDistance[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [filterCountry, setFilterCountry] = useState(countryBias);
  const [filterCity, setFilterCity] = useState(cityBias);
  const [filterCat, setFilterCat] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const proximityOn = proximityOrigin != null;

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      country: filterCountry || undefined,
      city: filterCity || undefined,
      category: filterCat || undefined,
    }),
    [search, filterCountry, filterCity, filterCat],
  );

  const loadCountries = useCallback(async () => {
    if (!supabase) return;
    const all: string[] = [];
    for (let offset = 0; offset < 8000; offset += 1000) {
      const { data } = await supabase.from('places').select('country').range(offset, offset + 999);
      if (!data?.length) break;
      data.forEach((d: { country?: string }) => {
        if (d.country && !all.includes(d.country)) all.push(d.country);
      });
      if (data.length < 1000) break;
    }
    setCountries(all.sort());
  }, []);

  const loadCities = useCallback(async (country: string) => {
    if (!supabase || !country) {
      setCities([]);
      return;
    }
    const all: string[] = [];
    for (let offset = 0; offset < 8000; offset += 1000) {
      const { data } = await supabase
        .from('places')
        .select('city')
        .eq('country', country)
        .range(offset, offset + 999);
      if (!data?.length) break;
      data.forEach((d: { city?: string }) => {
        if (d.city && !all.includes(d.city)) all.push(d.city);
      });
      if (data.length < 1000) break;
    }
    setCities(all.sort());
  }, []);

  const loadBrowse = useCallback(async () => {
    if (!supabase) {
      setError('قاعدة البيانات غير مهيأة.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { rows, total: count } = await fetchPlacesBankPage(supabase, {
        page,
        pageSize: PLACES_BANK_PAGE_SIZE,
        search: filters.search,
        category: filters.category,
        countries: filters.country ? [filters.country] : undefined,
        cityFilter: filters.city,
      });
      setPlaces(rows);
      setTotal(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل الأماكن.');
      setPlaces([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  const loadProximity = useCallback(async () => {
    if (!proximityOrigin) return;
    setLoading(true);
    setError(null);
    setProximityList([]);
    try {
      const all = await fetchPlacesForProximityEngine(filters);
      const nearby = filterPlacesByProximity(proximityOrigin, all, PROXIMITY_RADIUS_KM);
      setProximityList(nearby);
      setTotal(nearby.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر حساب القرب.');
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters, proximityOrigin]);

  useEffect(() => {
    void loadCountries();
  }, [loadCountries]);

  useEffect(() => {
    if (countryBias) setFilterCountry((c) => c || countryBias);
    if (cityBias) setFilterCity((c) => c || cityBias);
  }, [countryBias, cityBias]);

  useEffect(() => {
    void loadCities(filterCountry);
  }, [filterCountry, loadCities]);

  useEffect(() => {
    setPage(0);
  }, [search, filterCountry, filterCity, filterCat, proximityOrigin?.activityId]);

  useEffect(() => {
    if (proximityOn) void loadProximity();
    else void loadBrowse();
  }, [proximityOn, loadProximity, loadBrowse]);

  const pageSlice = proximityOn
    ? proximityList.slice(
        page * PLACES_BANK_PAGE_SIZE,
        page * PLACES_BANK_PAGE_SIZE + PLACES_BANK_PAGE_SIZE,
      )
    : places;

  const totalPages = Math.max(1, Math.ceil(total / PLACES_BANK_PAGE_SIZE));

  const handleAdd = (place: PlaceBankRow) => {
    onAddToDay(place);
    setFlashId(place.id);
    window.setTimeout(() => setFlashId(null), 900);
  };

  return (
    <aside className={VIP_PANEL} aria-label="مستكشف بنك الأماكن">
      <div className={VIP_PANEL_HEAD}>
        <h2 className="text-sm font-bold text-[#1E2720]">مستكشف بنك الأماكن</h2>
        <p className="mt-0.5 text-[11px] font-semibold text-[#1E2720]/60">The Vault · 6400+ مكان</p>
        <p className="mt-2 rounded-lg border border-[#D4AF37] bg-[#FAFAFA] px-2 py-1.5 text-[10px] font-bold text-[#1E2720]">
          يُضاف إلى: {activeDayLabel}
        </p>
      </div>

      {proximityOn && proximityOrigin ? (
        <div className="shrink-0 border-b border-[#D4AF37] bg-[#D4AF37]/10 px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-bold leading-snug text-[#1E2720]">
              📍 ضمن {PROXIMITY_RADIUS_KM} كم من: {proximityOrigin.placeName}
            </p>
            <button
              type="button"
              onClick={onClearProximity}
              className="shrink-0 rounded border border-[#D4AF37] bg-white px-2 py-1 text-[10px] font-bold text-[#1E2720]"
            >
              <X className="inline h-3 w-3" aria-hidden /> إلغاء
            </button>
          </div>
        </div>
      ) : null}

      <div className="shrink-0 space-y-2 border-b border-[#D4AF37]/40 bg-[#FAFAFA] p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم..."
            className={`${VIP_INPUT} pe-9 placeholder:text-slate-500`}
          />
        </div>
        <select
          value={filterCountry}
          onChange={(e) => {
            setFilterCountry(e.target.value);
            setFilterCity('');
          }}
          className={VIP_SELECT}
        >
          <option value="" className={VIP_OPTION}>
            كل الدول
          </option>
          {countries.map((c) => (
            <option key={c} value={c} className={VIP_OPTION}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          disabled={!filterCountry}
          className={VIP_SELECT}
        >
          <option value="" className={VIP_OPTION}>
            كل المدن
          </option>
          {cities.map((c) => (
            <option key={c} value={c} className={VIP_OPTION}>
              {c}
            </option>
          ))}
        </select>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className={VIP_SELECT}>
          <option value="" className={VIP_OPTION}>
            كل الفئات
          </option>
          {Object.entries(PLACES_BANK_CATEGORIES).map(([code, label]) => (
            <option key={code} value={code} className={VIP_OPTION}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className={VIP_PANEL_BODY}>
        {loading ? (
          <div className="flex flex-col items-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
            <p className="mt-2 text-xs font-bold text-slate-600">جاري التحميل…</p>
          </div>
        ) : error ? (
          <p className="py-8 text-center text-xs font-bold text-red-700">{error}</p>
        ) : pageSlice.length === 0 ? (
          <p className="py-8 text-center text-xs font-semibold text-slate-600">لا توجد نتائج.</p>
        ) : (
          <ul className="space-y-2">
            {pageSlice.map((item) => {
              const p = proximityOn ? (item as PlaceWithDistance).place : (item as PlaceBankRow);
              const dist = proximityOn ? (item as PlaceWithDistance).distanceKm : null;
              const added = flashId === p.id;
              return (
                <li
                  key={p.id}
                  className={`rounded-lg border bg-white p-3 transition ${
                    added ? 'border-[#1E2720] bg-[#D4AF37]/25' : 'border-[#D4AF37]/60'
                  }`}
                >
                  <div className="flex gap-2">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={String(p.image_url)}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-md border border-[#D4AF37]/40 object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-[#D4AF37]/40 bg-[#FAFAFA]">
                        <MapPin className="h-5 w-5 text-[#D4AF37]" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                          {p.branch_name ? (
                            <span className="shrink-0 rounded-md border border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                              {p.branch_name}
                            </span>
                          ) : null}
                          <p className="truncate text-sm font-bold text-[#1E2720]">{p.name}</p>
                        </div>
                        {dist != null ? (
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-[#D4AF37]">
                            {formatDistanceKmAr(dist)}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[10px] font-bold text-slate-700">
                        {placeBankCategoryLabel(p.category)}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500">
                        {p.city ? <span>{p.city}</span> : null}
                        {p.branch_name ? (
                          <>
                            {p.city ? <span aria-hidden>•</span> : null}
                            <span className="rounded border border-amber-200/60 bg-amber-50 px-1.5 py-0.5 font-bold text-amber-700">
                              {p.branch_name}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdd(p)}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#1E2720] bg-[#D4AF37] py-2.5 text-sm font-bold text-[#1E2720] shadow-sm hover:brightness-105"
                  >
                    إضافة للمسار
                    <span className="text-lg leading-none" aria-hidden>
                      ➕
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {totalPages > 1 ? (
        <footer className="flex shrink-0 items-center justify-between border-t border-[#D4AF37]/40 bg-[#FAFAFA] px-3 py-2">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="text-[11px] font-bold text-[#1E2720] disabled:opacity-40"
          >
            السابق
          </button>
          <span className="text-[11px] font-bold text-[#1E2720]/50">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="text-[11px] font-bold text-[#1E2720] disabled:opacity-40"
          >
            التالي
          </button>
        </footer>
      ) : null}
    </aside>
  );
}
