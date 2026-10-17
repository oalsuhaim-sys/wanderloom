'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Folder,
  MapPin,
  Pencil,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import { usePlacesBankDestinations } from '@/hooks/usePlacesBankDestinations'
import { supabase } from '@/lib/supabase'
import {
  PLACE_CATEGORY_OPTIONS,
  PLACES_BANK_CATEGORIES,
} from '@/lib/places-bank'
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
  const {
    countries,
    citiesForCountry,
    citiesForCountries,
    reload: reloadDestinations,
  } = usePlacesBankDestinations()
  const [search, setSearch] = useState('')
  const [filterCountry, setFilterCountry] = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const activeCities = useMemo(() => {
    if (!filterCountry) return citiesForCountries([])
    return citiesForCountry(filterCountry)
  }, [citiesForCountry, citiesForCountries, filterCountry])
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
    setPage(0)
  }, [search, filterCountry, filterCity, filterCat])
  useEffect(() => {
    void loadPlaces()
  }, [search, filterCountry, filterCity, filterCat, page])

  const japanDefaultApplied = useRef(false)
  useEffect(() => {
    if (japanDefaultApplied.current || !countries.length) return
    japanDefaultApplied.current = true
    const japan = countries.find((country) => {
      const name = country.trim().toLowerCase()
      return name === 'اليابان' || name === 'japan'
    })
    if (japan) setFilterCountry(japan)
  }, [countries])

  useEffect(() => {
    if (filterCity && !activeCities.includes(filterCity)) {
      setFilterCity('')
    }
  }, [activeCities, filterCity])

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

  const openAddModal = () => {
    setNewPlace({
      name: '',
      country: filterCountry,
      city: filterCity,
      sub_tag: '',
      category: filterCat || 'o',
    })
    setAdding(true)
  }

  const addNewPlace = async () => {
    if (!supabase || !newPlace.name.trim() || !newPlace.country.trim() || !newPlace.city.trim()) {
      setOpNotice({ type: 'err', text: 'الاسم والدولة والمدينة مطلوبة.' })
      return
    }
    setOpNotice(null)
    const { error } = await supabase.from('places').insert(newPlace)
    if (error) {
      setOpNotice({ type: 'err', text: error.message || 'تعذر إضافة المكان.' })
      return
    }
    setAdding(false)
    setNewPlace({ name: '', country: '', city: '', category: 'o', sub_tag: '' })
    setOpNotice({ type: 'ok', text: 'تمت إضافة المكان.' })
    void loadPlaces()
    void reloadDestinations()
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
    <div dir="rtl" className="min-h-screen space-y-6 bg-[#F8F5EE] p-6">
      <div className="mx-auto max-w-7xl space-y-6">
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

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-2 rounded-2xl bg-[#C59B4B] px-6 py-3 text-xs font-bold text-slate-900 shadow-sm transition-all hover:bg-[#B2883A]"
          >
            <span>+ إضافة مكان</span>
          </button>
          <PlacesCsvUploader
            onImported={() => {
              void loadPlaces()
              void reloadDestinations()
            }}
          />
        </div>
        <div className="text-right">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            RESOURCE BANK
          </span>
          <h1 className="text-2xl font-bold text-[#111827]">بنك الأماكن</h1>
          <p className="text-xs text-slate-500">{total} مكان · مستكشف موارد فاخر</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-xs shadow-sm md:grid-cols-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم..."
          className="rounded-2xl border border-slate-200 bg-[#F8F5EE]/60 px-4 py-3 outline-none focus:border-[#C59B4B]"
        />
        <select
          value={filterCountry}
          onChange={(e) => {
            setFilterCountry(e.target.value)
            setFilterCity('')
          }}
          className="rounded-2xl border border-slate-200 bg-[#F8F5EE]/60 px-4 py-3 font-bold text-slate-800 outline-none focus:border-[#C59B4B]"
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
          className="rounded-2xl border border-slate-200 bg-[#F8F5EE]/60 px-4 py-3 font-bold text-slate-800 outline-none focus:border-[#C59B4B]"
        >
          <option value="">كل المدن ({activeCities.length})</option>
          {activeCities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="rounded-2xl border border-slate-200 bg-[#F8F5EE]/60 px-4 py-3 font-bold text-slate-800 outline-none focus:border-[#C59B4B]"
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {places.length === 0 ? (
              <div className="col-span-full rounded-3xl border border-slate-200 bg-white p-12 text-center text-xs font-bold text-slate-500">
                لا توجد أماكن مسجلة تنطبق عليها التصفية الحالية.
              </div>
            ) : null}
            {places.map((p) => (
              <div
                key={p.id}
                className="group relative space-y-3 rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm transition-all hover:border-[#C59B4B]"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-[#F8F5EE] text-xl text-slate-600">
                  <Folder className="h-5 w-5" aria-hidden />
                </div>
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
                <span className="mt-2 inline-block rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold text-[#8C6D2D]">
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
            void loadPlaces()
            void reloadDestinations()
          }}
        />
      ) : null}

      {adding ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={() => setAdding(false)}
        >
          <div
            className="w-full max-w-lg space-y-4 rounded-3xl border border-slate-200 bg-white p-6 text-right shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-[#111827]">إضافة مكان جديد</h2>
            {opNotice?.type === 'err' ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">
                {opNotice.text}
              </p>
            ) : null}
            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-bold text-slate-700">الاسم *</label>
                <input
                  type="text"
                  value={newPlace.name}
                  onChange={(e) => setNewPlace({ ...newPlace, name: e.target.value })}
                  placeholder="اسم المكان"
                  className="w-full rounded-2xl border border-slate-300 bg-[#F8F5EE]/40 p-3 outline-none focus:border-[#C59B4B]"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">الدولة *</label>
                <input
                  type="text"
                  value={newPlace.country}
                  onChange={(e) => setNewPlace({ ...newPlace, country: e.target.value })}
                  placeholder="اسم الدولة"
                  className="w-full rounded-2xl border border-slate-300 bg-[#F8F5EE]/40 p-3 font-bold text-slate-900 outline-none focus:border-[#C59B4B]"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">المدينة *</label>
                <input
                  type="text"
                  value={newPlace.city}
                  onChange={(e) => setNewPlace({ ...newPlace, city: e.target.value })}
                  placeholder="اسم المدينة"
                  className="w-full rounded-2xl border border-slate-300 bg-[#F8F5EE]/40 p-3 font-bold text-slate-900 outline-none focus:border-[#C59B4B]"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">الوصف</label>
                <textarea
                  value={newPlace.sub_tag}
                  onChange={(e) => setNewPlace({ ...newPlace, sub_tag: e.target.value })}
                  rows={3}
                  className="w-full rounded-2xl border border-slate-300 bg-[#F8F5EE]/40 p-3 outline-none focus:border-[#C59B4B]"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">التصنيف</label>
                <select
                  value={newPlace.category}
                  onChange={(e) => setNewPlace({ ...newPlace, category: e.target.value })}
                  className="w-full rounded-2xl border border-slate-300 bg-[#F8F5EE]/40 p-3 font-bold outline-none focus:border-[#C59B4B]"
                >
                  {categoryOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => void addNewPlace()}
                className="flex-1 rounded-2xl bg-[#C59B4B] py-3.5 text-xs font-bold text-slate-900 shadow-sm transition-all hover:bg-[#B2883A]"
              >
                إضافة المكان
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-2xl bg-slate-100 px-6 py-3.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  )
}
