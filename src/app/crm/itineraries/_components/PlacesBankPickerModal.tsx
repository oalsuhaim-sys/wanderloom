'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MapPin, Search, X } from 'lucide-react';

import {
  PLACES_BANK_CATEGORIES,
  PLACES_BANK_PAGE_SIZE,
  placeBankCategoryLabel,
} from '@/lib/places-bank';
import { supabase } from '@/lib/supabase';
import type { PlaceBankRow } from '@/types/place';

type Props = {
  open: boolean;
  cityBias?: string;
  countryBias?: string;
  onClose: () => void;
  onSelect: (place: PlaceBankRow) => void;
};

export default function PlacesBankPickerModal({
  open,
  cityBias = '',
  countryBias = '',
  onClose,
  onSelect,
}: Props) {
  const [places, setPlaces] = useState<PlaceBankRow[]>([]);
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

  const loadCountries = useCallback(async () => {
    if (!supabase) return;
    const all: string[] = [];
    let offset = 0;
    while (true) {
      const { data } = await supabase.from('places').select('country').range(offset, offset + 999);
      if (!data?.length) break;
      data.forEach((d: { country?: string }) => {
        if (d.country && !all.includes(d.country)) all.push(d.country);
      });
      if (data.length < 1000) break;
      offset += 1000;
    }
    setCountries(all.sort());
  }, []);

  const loadCities = useCallback(async (country: string) => {
    if (!supabase || !country) {
      setCities([]);
      return;
    }
    const all: string[] = [];
    let offset = 0;
    while (true) {
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
      offset += 1000;
    }
    setCities(all.sort());
  }, []);

  const loadPlaces = useCallback(async () => {
    if (!supabase) {
      setError('قاعدة البيانات غير مهيأة.');
      return;
    }
    setLoading(true);
    setError(null);
    let q = supabase.from('places').select('*', { count: 'exact' });
    if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);
    if (filterCountry) q = q.eq('country', filterCountry);
    if (filterCity) q = q.eq('city', filterCity);
    if (filterCat) q = q.eq('category', filterCat);
    const { data, count, error: qErr } = await q
      .order('name')
      .range(page * PLACES_BANK_PAGE_SIZE, (page + 1) * PLACES_BANK_PAGE_SIZE - 1);
    if (qErr) {
      setError(qErr.message);
      setPlaces([]);
    } else {
      setPlaces((data ?? []) as PlaceBankRow[]);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [search, filterCountry, filterCity, filterCat, page]);

  useEffect(() => {
    if (!open) return;
    void loadCountries();
  }, [open, loadCountries]);

  useEffect(() => {
    if (!open) return;
    setFilterCountry((c) => c || countryBias);
    setFilterCity((c) => c || cityBias);
  }, [open, countryBias, cityBias]);

  useEffect(() => {
    if (!open) return;
    void loadCities(filterCountry);
  }, [open, filterCountry, loadCities]);

  useEffect(() => {
    if (!open) return;
    setPage(0);
  }, [open, search, filterCountry, filterCity, filterCat]);

  useEffect(() => {
    if (!open) return;
    void loadPlaces();
  }, [open, loadPlaces]);

  if (!open) return null;

  const totalPages = Math.max(1, Math.ceil(total / PLACES_BANK_PAGE_SIZE));

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="places-bank-title"
    >
      <div className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#D4AF37]/30 bg-[#F9F9F6] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#1E2720]/10 px-4 py-3">
          <div>
            <h2 id="places-bank-title" className="text-base font-black text-[#1E2720]">
              بنك الأماكن
            </h2>
            <p className="text-[11px] font-medium text-[#1E2720]/60">
              {total.toLocaleString('ar-SA')} مكان · اختر من القاعدة المركزية
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#1E2720]/70 hover:bg-[#1E2720]/5"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-3 border-b border-[#1E2720]/10 px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1E2720]/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم..."
              className="w-full rounded-xl border border-[#1E2720]/15 bg-white py-2.5 pe-9 ps-3 text-sm font-bold text-[#1E2720] outline-none focus:border-[#D4AF37]"
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select
              value={filterCountry}
              onChange={(e) => {
                setFilterCountry(e.target.value);
                setFilterCity('');
              }}
              className="rounded-xl border border-[#1E2720]/15 bg-white px-3 py-2 text-xs font-bold text-[#1E2720]"
            >
              <option value="">كل الدول</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              disabled={!filterCountry}
              className="rounded-xl border border-[#1E2720]/15 bg-white px-3 py-2 text-xs font-bold text-[#1E2720] disabled:opacity-50"
            >
              <option value="">كل المدن</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              className="rounded-xl border border-[#1E2720]/15 bg-white px-3 py-2 text-xs font-bold text-[#1E2720]"
            >
              <option value="">كل الفئات</option>
              {Object.entries(PLACES_BANK_CATEGORIES).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm font-bold text-red-600">{error}</p>
          ) : places.length === 0 ? (
            <p className="py-8 text-center text-sm font-medium text-[#1E2720]/50">لا توجد نتائج.</p>
          ) : (
            <ul className="space-y-1">
              {places.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(p);
                      onClose();
                    }}
                    className="flex w-full items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 text-right transition hover:border-[#D4AF37]/40 hover:bg-white"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-[#1E2720]">{p.name}</p>
                      <p className="text-[11px] font-medium text-[#1E2720]/55">
                        {p.city} · {p.country} · {placeBankCategoryLabel(p.category)}
                      </p>
                      {p.sub_tag ? (
                        <p className="mt-0.5 text-[10px] text-[#1E2720]/45">{p.sub_tag}</p>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {totalPages > 1 ? (
          <footer className="flex items-center justify-between border-t border-[#1E2720]/10 px-4 py-2">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#1E2720] disabled:opacity-40"
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
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#1E2720] disabled:opacity-40"
            >
              التالي
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
