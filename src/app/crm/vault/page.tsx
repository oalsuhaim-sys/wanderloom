'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Folder,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  PLACE_CATEGORY_OPTIONS,
  PLACES_BANK_CATEGORIES,
} from '@/lib/places-bank'
import { CRM_BTN_PRIMARY, CRM_INPUT, CRM_MODAL_PANEL } from '@/lib/crm-luxury-ui'
import PlacesCsvUploader from './_components/PlacesCsvUploader'
import EditPlaceModal from './_components/EditPlaceModal'

const categoryOptions = [
  ...PLACE_CATEGORY_OPTIONS,
  { id: 's', label: PLACES_BANK_CATEGORIES.s },
  { id: 'h', label: PLACES_BANK_CATEGORIES.h },
]

function categoryLabel(id: string | null | undefined): string {
  const found = categoryOptions.find((o) => o.id === id)
  return found?.label ?? String(id ?? 'أخرى')
}

export default function VaultPage() {
  const [places, setPlaces] = useState<any[]>([])
  const [countries, setCountries] = useState<string[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [filterCountry, setFilterCountry] = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)
  const [adding, setAdding] = useState(false)
  const [newPlace, setNewPlace] = useState({
    name: '',
    country: '',
    city: '',
    category: 'o',
    sub_tag: '',
  })
  const [opNotice, setOpNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [updatingCategoryId, setUpdatingCategoryId] = useState<string | null>(null)
  const PAGE_SIZE = 50

  const loadCountries = async () => {
    if (!supabase) return
    const allCountries: string[] = []
    let offset = 0
    while (true) {
      const { data } = await supabase.from('places').select('country').range(offset, offset + 999)
      if (!data || data.length === 0) break
      data.forEach((d: any) => {
        if (d.country && !allCountries.includes(d.country)) allCountries.push(d.country)
      })
      if (data.length < 1000) break
      offset += 1000
    }
    setCountries(allCountries.sort())
  }

  const loadCities = async (country: string) => {
    if (!supabase || !country) {
      setCities([])
      return
    }
    const allCities: string[] = []
    let offset = 0
    while (true) {
      const { data } = await supabase
        .from('places')
        .select('city')
        .eq('country', country)
        .range(offset, offset + 999)
      if (!data || data.length === 0) break
      data.forEach((d: any) => {
        if (d.city && !allCities.includes(d.city)) allCities.push(d.city)
      })
      if (data.length < 1000) break
      offset += 1000
    }
    setCities(allCities.sort())
  }

  const loadPlaces = async () => {
    if (!supabase) return
    setLoading(true)
    let q = supabase.from('places').select('*', { count: 'exact' })
    if (search) q = q.ilike('name', '%' + search + '%')
    if (filterCountry) q = q.eq('country', filterCountry)
    if (filterCity) q = q.eq('city', filterCity)
    if (filterCat) q = q.eq('category', filterCat)
    const { data, count } = await q
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .order('name')
    if (data) setPlaces(data)
    if (count !== null) setTotal(count)
    setLoading(false)
  }

  useEffect(() => {
    loadCountries()
  }, [])
  useEffect(() => {
    loadCities(filterCountry)
  }, [filterCountry])
  useEffect(() => {
    setPage(0)
  }, [search, filterCountry, filterCity, filterCat])
  useEffect(() => {
    loadPlaces()
  }, [search, filterCountry, filterCity, filterCat, page])

  const handleCategoryChange = async (placeId: string, newCategory: string) => {
    if (!supabase || !placeId || !newCategory) return
    const previous = places.find((p) => String(p.id) === String(placeId))?.category

    setPlaces((prev) =>
      prev.map((p) => (String(p.id) === String(placeId) ? { ...p, category: newCategory } : p)),
    )
    setUpdatingCategoryId(String(placeId))

    try {
      const { error } = await supabase
        .from('places')
        .update({ category: newCategory })
        .eq('id', placeId)

      if (error) throw error
      toast.success('تم تصحيح الفئة بنجاح')
    } catch (error) {
      console.error('Update failed:', error)
      setPlaces((prev) =>
        prev.map((p) =>
          String(p.id) === String(placeId) ? { ...p, category: previous } : p,
        ),
      )
      toast.error('فشل تحديث الفئة. يرجى المحاولة مرة أخرى.')
    } finally {
      setUpdatingCategoryId(null)
    }
  }

  const addNewPlace = async () => {
    if (!supabase || !newPlace.name) return
    setOpNotice(null)
    const { error } = await supabase.from('places').insert(newPlace)
    if (error) {
      setOpNotice({ type: 'err', text: error.message || 'تعذر إضافة المكان.' })
      return
    }
    setAdding(false)
    setNewPlace({ name: '', country: '', city: '', category: 'o', sub_tag: '' })
    setOpNotice({ type: 'ok', text: 'تمت إضافة المكان.' })
    loadPlaces()
    loadCountries()
  }

  const deletePlace = async (id: string) => {
    if (!supabase || !window.confirm('حذف هذا المكان؟')) return
    setOpNotice(null)
    const { error } = await supabase.from('places').delete().eq('id', id)
    if (error) {
      setOpNotice({ type: 'err', text: error.message || 'تعذر حذف المكان.' })
      return
    }
    setOpNotice({ type: 'ok', text: 'تم الحذف.' })
    loadPlaces()
  }

  const openMaps = (p: any) => {
    const direct = String(p.map_url || p.maps_url || p.google_maps_url || '').trim()
    if (direct) {
      window.open(direct, '_blank')
      return
    }
    const query = [p.name, p.branch_name, p.city, p.country].filter(Boolean).join(' ')
    window.open(
      'https://www.google.com/maps/search/' + encodeURIComponent(query),
      '_blank',
    )
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div
      dir="rtl"
      className="mx-auto max-w-7xl bg-[#F9FAFB] px-4 py-5 dark:bg-[#1A2421] sm:px-6"
    >
      {opNotice ? (
        <div
          className={`mb-4 rounded-2xl border px-4 py-3 text-xs font-medium ${
            opNotice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300'
          }`}
        >
          {opNotice.text}
        </div>
      ) : null}

      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400 dark:text-[#D4AF37]/80">
            Resource Bank
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">بنك الأماكن</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {total} مكان · {countries.length} دولة · مستكشف موارد فاخر
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PlacesCsvUploader
            onImported={() => {
              loadPlaces()
              loadCountries()
            }}
          />
          <button type="button" onClick={() => setAdding(true)} className={CRM_BTN_PRIMARY}>
            <Plus className="h-4 w-4" aria-hidden />
            إضافة مكان
          </button>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم..."
            className={`${CRM_INPUT} ps-9`}
          />
        </div>
        <select
          value={filterCountry}
          onChange={(e) => {
            setFilterCountry(e.target.value)
            setFilterCity('')
          }}
          className={CRM_INPUT}
        >
          <option value="">كل الدول ({countries.length})</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          className={CRM_INPUT}
        >
          <option value="">كل المدن ({cities.length})</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className={CRM_INPUT}
        >
          <option value="">كل التصنيفات</option>
          {categoryOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm font-medium text-slate-400">جارٍ التحميل...</div>
      ) : (
        <>
          <div className="crm-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {places.map((p) => (
              <div
                key={p.id}
                className="group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-[#2D3F3A] dark:bg-[#22302C]"
              >
                <Folder
                  className="mb-3 h-12 w-12 text-slate-400 dark:text-[#D4AF37]/80"
                  aria-hidden
                />
                <div className="flex w-full flex-wrap items-center justify-center gap-1.5">
                  {p.branch_name ? (
                    <span className="rounded-md border border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300">
                      {p.branch_name}
                    </span>
                  ) : null}
                  <p className="line-clamp-2 text-sm font-bold text-slate-900 dark:text-white">
                    {p.name}
                  </p>
                </div>
                <p className="mt-1 line-clamp-1 text-[11px] font-medium text-slate-500">
                  {p.city}
                  {p.branch_name ? ` · ${p.branch_name}` : ''}
                  {p.country ? ` · ${p.country}` : ''}
                </p>
                <span className="mt-2 rounded-md bg-slate-50 px-2 py-1 text-[10px] text-slate-700 dark:bg-[#1A2421] dark:text-slate-300">
                  {categoryLabel(p.category)}
                </span>

                <div className="mt-3 flex flex-wrap items-center justify-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => openMaps(p)}
                    className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300"
                    title="خريطة"
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing({ ...p })}
                    className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300"
                    title="تعديل"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => void deletePlace(p.id)}
                    className="rounded-lg border border-rose-200 bg-white p-1.5 text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:bg-transparent"
                    title="حذف"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <a
                    href={
                      String(p.map_url || p.maps_url || p.google_maps_url || '').trim() ||
                      `https://www.google.com/maps/search/${encodeURIComponent(
                        [p.name, p.branch_name, p.city, p.country].filter(Boolean).join(' '),
                      )}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300"
                    title="معاينة"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </div>

                <select
                  value={p.category || 'o'}
                  disabled={updatingCategoryId === String(p.id)}
                  onChange={(e) => void handleCategoryChange(String(p.id), e.target.value)}
                  className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-700 outline-none dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300"
                  title="تصحيح فئة المكان"
                  aria-label={`تصنيف ${p.name}`}
                >
                  {!categoryOptions.some((opt) => opt.id === p.category) && p.category ? (
                    <option value={p.category}>غير معروف ({p.category})</option>
                  ) : null}
                  {categoryOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 disabled:opacity-40 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-slate-300"
            >
              السابق
            </button>
            <span className="text-xs font-medium text-slate-500">
              {page + 1} / {totalPages || 1}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min((totalPages || 1) - 1, p + 1))}
              disabled={page >= (totalPages || 1) - 1}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 disabled:opacity-40 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-slate-300"
            >
              التالي
            </button>
          </div>
        </>
      )}

      {editing ? (
        <EditPlaceModal
          place={editing}
          categoryOptions={categoryOptions}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setOpNotice({ type: 'ok', text: 'تم حفظ التعديلات.' })
            loadPlaces()
          }}
        />
      ) : null}

      {adding ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setAdding(false)}
        >
          <div className={CRM_MODAL_PANEL} onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">إضافة مكان جديد</h2>
            <label className="mb-3 block text-xs font-semibold text-slate-500">
              الاسم *
              <input
                value={newPlace.name}
                onChange={(e) => setNewPlace({ ...newPlace, name: e.target.value })}
                className={`${CRM_INPUT} mt-1`}
              />
            </label>
            <label className="mb-3 block text-xs font-semibold text-slate-500">
              الدولة *
              <input
                value={newPlace.country}
                onChange={(e) => setNewPlace({ ...newPlace, country: e.target.value })}
                className={`${CRM_INPUT} mt-1`}
              />
            </label>
            <label className="mb-3 block text-xs font-semibold text-slate-500">
              المدينة *
              <input
                value={newPlace.city}
                onChange={(e) => setNewPlace({ ...newPlace, city: e.target.value })}
                className={`${CRM_INPUT} mt-1`}
              />
            </label>
            <label className="mb-3 block text-xs font-semibold text-slate-500">
              الوصف
              <input
                value={newPlace.sub_tag}
                onChange={(e) => setNewPlace({ ...newPlace, sub_tag: e.target.value })}
                className={`${CRM_INPUT} mt-1`}
              />
            </label>
            <label className="mb-4 block text-xs font-semibold text-slate-500">
              التصنيف
              <select
                value={newPlace.category}
                onChange={(e) => setNewPlace({ ...newPlace, category: e.target.value })}
                className={`${CRM_INPUT} mt-1`}
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => void addNewPlace()} className={`${CRM_BTN_PRIMARY} w-full`}>
              إضافة المكان
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
