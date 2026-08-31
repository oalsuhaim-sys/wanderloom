'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CalendarDays, Filter, Globe, Loader2, MapPin, Pencil, Plus, Repeat, Save, Tags, X, Zap } from 'lucide-react'

type EventRow = {
  id: number
  name: string | null
  country: string | null
  city: string | null
  start_date: string | null
  end_date: string | null
  season: string | null
  category: string | null
  crowd_level: string | null
  impact: string | null
  notes: string | null
  is_recurring: boolean | null
}

type MetaRow = { country: string | null; city: string | null; season: string | null }

const CARD =
  'bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm mb-4 hover:border-[#D4AF37]/40 transition-all'
const INNER = 'bg-slate-50 border border-slate-200 rounded-xl p-4'
const INPUT =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/25'
const TAG = 'bg-slate-100 text-slate-700 border border-slate-200 rounded-lg px-3 py-1 text-xs font-bold'
const TAG_GO = 'bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-3 py-1 text-xs font-bold'
const TAG_AVOID = 'bg-rose-50 text-rose-700 border border-rose-200 rounded-lg px-3 py-1 text-xs font-bold'
const BTN_PRIMARY =
  'bg-[#D4AF37] hover:bg-[#b8952d] text-black font-extrabold py-2.5 px-4 rounded-xl text-sm inline-flex items-center justify-center gap-2 transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-60'
const EDIT_LINK = 'text-slate-500 hover:text-[#b8952d] text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition-colors'
const BTN_SECONDARY =
  'rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50'
const NOTE_BOX =
  'bg-amber-50/70 text-amber-900 border border-amber-200/80 rounded-xl p-3 text-sm font-semibold leading-relaxed'

const emptyForm = () => ({
  name: '',
  country: '',
  city: '',
  start_date: '',
  end_date: '',
  season: '',
  category: '',
  crowd_level: '',
  impact: 'feature' as 'feature' | 'obstacle',
  notes: '',
  is_recurring: false,
})

async function fetchEventsMeta(client: NonNullable<typeof supabase>) {
  const batch = 1000
  let from = 0
  const rows: MetaRow[] = []
  for (;;) {
    const { data, error } = await client.from('events').select('country, city, season').range(from, from + batch - 1)
    if (error) throw error
    if (!data?.length) break
    rows.push(...(data as MetaRow[]))
    if (data.length < batch) break
    from += batch
  }
  return rows
}

function buildCountryCityMap(rows: MetaRow[]) {
  const countrySet = new Set<string>()
  const map: Record<string, Set<string>> = {}
  rows.forEach((r) => {
    const ctry = r.country ? String(r.country) : ''
    const cty = r.city ? String(r.city) : ''
    if (ctry) {
      countrySet.add(ctry)
      if (!map[ctry]) map[ctry] = new Set()
      if (cty) map[ctry].add(cty)
    }
  })
  const countries = Array.from(countrySet).sort((a, b) => a.localeCompare(b))
  const citiesByCountry: Record<string, string[]> = {}
  Object.entries(map).forEach(([k, set]) => {
    citiesByCountry[k] = Array.from(set).sort((a, b) => a.localeCompare(b))
  })
  return { countries, citiesByCountry }
}

export default function CRMEventsPage() {
  const [initLoading, setInitLoading] = useState(true)
  const [listLoading, setListLoading] = useState(false)
  const [error, setError] = useState('')

  const [metaRows, setMetaRows] = useState<MetaRow[]>([])
  const [countryOptions, setCountryOptions] = useState<string[]>([])
  const [citiesByCountry, setCitiesByCountry] = useState<Record<string, string[]>>({})

  const [filterCountry, setFilterCountry] = useState('all')
  const [filterCity, setFilterCity] = useState('all')
  const [filterSeason, setFilterSeason] = useState('all')
  const [filterImpact, setFilterImpact] = useState('all')

  const [events, setEvents] = useState<EventRow[]>([])

  const [showAdd, setShowAdd] = useState(false)
  const [editRow, setEditRow] = useState<EventRow | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const cityOptionsForFilter = useMemo(() => {
    if (filterCountry === 'all') return []
    return citiesByCountry[filterCountry] || []
  }, [filterCountry, citiesByCountry])

  const seasonOptionsForFilter = useMemo(() => {
    const s = new Set<string>()
    metaRows.forEach((r) => {
      if (filterCountry !== 'all' && String(r.country || '') !== filterCountry) return
      if (filterCity !== 'all' && String(r.city || '') !== filterCity) return
      if (r.season != null && String(r.season).trim() !== '') s.add(String(r.season))
    })
    return Array.from(s).sort((a, b) => {
      const na = Number(a)
      const nb = Number(b)
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return nb - na
      return a.localeCompare(b)
    })
  }, [metaRows, filterCountry, filterCity])

  const seasonOptionsForForm = useMemo(() => {
    const s = new Set<string>()
    metaRows.forEach((r) => {
      if (form.country.trim() && String(r.country || '') !== form.country.trim()) return
      if (form.city.trim() && String(r.city || '') !== form.city.trim()) return
      if (r.season != null && String(r.season).trim() !== '') s.add(String(r.season))
    })
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [metaRows, form.country, form.city])

  const cityOptionsForForm = useMemo(() => {
    const c = form.country.trim()
    if (!c) {
      const all = new Set<string>()
      Object.values(citiesByCountry).forEach((arr) => arr.forEach((x) => all.add(x)))
      return Array.from(all).sort((a, b) => a.localeCompare(b))
    }
    const list = citiesByCountry[c] || []
    const cur = form.city.trim()
    if (cur && !list.includes(cur)) return [...list, cur].sort((a, b) => a.localeCompare(b))
    return list
  }, [form.country, form.city, citiesByCountry])

  const loadEvents = useCallback(async () => {
    if (!supabase) return
    setListLoading(true)
    setError('')

    let q = supabase
      .from('events')
      .select(
        'id, name, country, city, start_date, end_date, season, category, crowd_level, impact, notes, is_recurring',
      )
      .order('start_date', { ascending: false })

    if (filterCountry !== 'all') q = q.eq('country', filterCountry)
    if (filterCity !== 'all') q = q.eq('city', filterCity)
    if (filterSeason !== 'all') q = q.eq('season', filterSeason)
    if (filterImpact !== 'all') q = q.eq('impact', filterImpact)

    const { data, error: err } = await q

    if (err) {
      setError(err.message || 'تعذر تحميل الفعاليات.')
      setEvents([])
    } else {
      setEvents((data as EventRow[]) || [])
    }
    setListLoading(false)
  }, [filterCountry, filterCity, filterSeason, filterImpact])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!supabase) {
        setError('Supabase غير متصل. تأكد من إعداد NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY.')
        setInitLoading(false)
        return
      }
      setInitLoading(true)
      setError('')
      try {
        const rows = await fetchEventsMeta(supabase)
        if (cancelled) return
        setMetaRows(rows)
        const { countries, citiesByCountry: cbc } = buildCountryCityMap(rows)
        setCountryOptions(countries)
        setCitiesByCountry(cbc)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'تعذر تهيئة الفعاليات.')
      } finally {
        if (!cancelled) setInitLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (initLoading) return
    void loadEvents()
  }, [initLoading, loadEvents])

  useEffect(() => {
    if (filterCountry === 'all') {
      if (filterCity !== 'all') setFilterCity('all')
      return
    }
    if (filterCity !== 'all' && cityOptionsForFilter.length && !cityOptionsForFilter.includes(filterCity)) {
      setFilterCity('all')
    }
  }, [filterCountry, filterCity, cityOptionsForFilter])

  useEffect(() => {
    if (filterSeason !== 'all' && seasonOptionsForFilter.length && !seasonOptionsForFilter.includes(filterSeason)) {
      setFilterSeason('all')
    }
  }, [filterSeason, seasonOptionsForFilter])

  const openAdd = () => {
    setEditRow(null)
    setForm(emptyForm())
    setShowAdd(true)
  }

  const openEdit = (e: EventRow) => {
    setEditRow(e)
    setForm({
      name: String(e.name || ''),
      country: String(e.country || ''),
      city: String(e.city || ''),
      start_date: e.start_date ? String(e.start_date).slice(0, 10) : '',
      end_date: e.end_date ? String(e.end_date).slice(0, 10) : '',
      season: e.season != null ? String(e.season) : '',
      category: String(e.category || ''),
      crowd_level: String(e.crowd_level || ''),
      impact: e.impact === 'obstacle' ? 'obstacle' : 'feature',
      notes: String(e.notes || ''),
      is_recurring: Boolean(e.is_recurring),
    })
    setShowAdd(true)
  }

  const closeModal = () => {
    if (saving) return
    setShowAdd(false)
    setEditRow(null)
    setForm(emptyForm())
  }

  const saveEvent = async () => {
    if (!supabase) return
    const name = form.name.trim()
    if (!name) {
      setError('اسم الفعالية مطلوب.')
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      name,
      country: form.country.trim() || null,
      city: form.city.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      season: form.season.trim() || null,
      category: form.category.trim() || null,
      crowd_level: form.crowd_level.trim() || null,
      impact: form.impact,
      notes: form.notes.trim() || null,
      is_recurring: Boolean(form.is_recurring),
    }

    const refreshMeta = async () => {
      try {
        if (!supabase) return
        const rows = await fetchEventsMeta(supabase)
        setMetaRows(rows)
        const { countries, citiesByCountry: cbc } = buildCountryCityMap(rows)
        setCountryOptions(countries)
        setCitiesByCountry(cbc)
      } catch {
        /* ignore */
      }
    }

    if (editRow?.id) {
      const { error: err } = await supabase.from('events').update(payload).eq('id', editRow.id)
      if (err) setError(err.message || 'تعذر تحديث الفعالية.')
      else {
        setShowAdd(false)
        setEditRow(null)
        setForm(emptyForm())
        await refreshMeta()
        await loadEvents()
      }
    } else {
      const { error: err } = await supabase.from('events').insert(payload)
      if (err) setError(err.message || 'تعذر إضافة الفعالية.')
      else {
        setShowAdd(false)
        setEditRow(null)
        setForm(emptyForm())
        await refreshMeta()
        await loadEvents()
      }
    }
    setSaving(false)
  }

  if (initLoading) {
    return (
      <div
        dir="rtl"
        className="mx-auto flex min-h-screen max-w-[1100px] items-center justify-center bg-slate-50 p-6 font-sans text-slate-800"
      >
        <div className="text-center text-slate-500">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#b8952d]" />
          <p className="text-sm">جارٍ تحميل الفعاليات...</p>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="mx-auto min-h-screen max-w-[1100px] bg-slate-50 p-6 pb-14 font-sans text-slate-800">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 sm:text-2xl">الفعاليات</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">فلترة متسلسلة، بطاقات ملونة، إضافة وتعديل</p>
        </div>
        <button type="button" onClick={openAdd} className={BTN_PRIMARY}>
          <Plus size={16} /> إضافة فعالية
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
          {error}
        </div>
      ) : null}

      {/* Filters */}
      <div className={`${CARD} mb-4 !p-4 sm:!p-6`}>
        <div className="mb-4 flex items-center gap-2">
          <Filter size={16} className="text-[#b8952d]" />
          <span className="text-lg font-extrabold text-slate-900">فلترة</span>
          {listLoading ? <span className="text-xs text-slate-500">جارٍ التحديث...</span> : null}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className={INNER}>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Globe size={14} className="text-[#b8952d]" /> الدولة
            </label>
            <select
              value={filterCountry}
              onChange={(e) => {
                setFilterCountry(e.target.value)
                setFilterCity('all')
                setFilterSeason('all')
              }}
              className={INPUT}
            >
              <option value="all">كل الدول</option>
              {countryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className={INNER}>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <MapPin size={14} className="text-[#b8952d]" /> المدينة
            </label>
            <select
              value={filterCity}
              onChange={(e) => {
                setFilterCity(e.target.value)
                setFilterSeason('all')
              }}
              disabled={filterCountry === 'all' || cityOptionsForFilter.length === 0}
              className={`${INPUT} disabled:cursor-not-allowed disabled:opacity-55`}
            >
              <option value="all">{filterCountry === 'all' ? 'اختر الدولة أولاً' : 'كل المدن'}</option>
              {cityOptionsForFilter.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className={INNER}>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <CalendarDays size={14} className="text-[#b8952d]" /> الموسم
            </label>
            <select value={filterSeason} onChange={(e) => setFilterSeason(e.target.value)} className={INPUT}>
              <option value="all">كل المواسم (حسب الدولة/المدينة)</option>
              {seasonOptionsForFilter.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className={INNER}>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Zap size={14} className="text-[#b8952d]" /> التأثير
            </label>
            <select value={filterImpact} onChange={(e) => setFilterImpact(e.target.value)} className={INPUT}>
              <option value="all">الكل</option>
              <option value="feature">feature — اذهب</option>
              <option value="obstacle">obstacle — تجنب</option>
            </select>
          </div>
        </div>

        <p className="mt-4 text-sm font-semibold text-slate-500">النتائج: {events.length}</p>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-4">
        {events.length === 0 && !listLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-10 text-center text-sm font-semibold text-slate-500">
            لا توجد فعاليات مطابقة.
          </div>
        ) : (
          events.map((e, i) => {
            const imp = String(e.impact || '')
            const isFeature = imp === 'feature'
            const isObstacle = imp === 'obstacle'
            const badgeClass = isFeature ? TAG_GO : isObstacle ? TAG_AVOID : TAG
            const badgeText = isFeature ? 'اذهب' : isObstacle ? 'تجنب' : imp || '—'

            return (
              <article key={e.id ?? i} className={`${CARD} overflow-hidden !p-0`}>
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 sm:p-6">
                  <div className="min-w-0 flex-1">
                    <h2 className="mb-2 text-xl font-black leading-snug text-slate-900">
                      {e.name || `فعالية #${e.id}`}
                    </h2>
                    <span className={`inline-flex items-center ${badgeClass}`}>
                      {isFeature ? '✓ ' : isObstacle ? '✗ ' : ''}
                      {badgeText}
                    </span>
                  </div>
                  <button type="button" title="تعديل" onClick={() => openEdit(e)} className={EDIT_LINK}>
                    <Pencil size={14} /> تعديل
                  </button>
                </div>

                <div className="grid gap-4 p-4 sm:p-6">
                  <div className="flex flex-wrap gap-2">
                    {e.country ? (
                      <span className={TAG}>🌍 {e.country}</span>
                    ) : null}
                    {e.city ? (
                      <span className={TAG}>📍 {e.city}</span>
                    ) : null}
                    {e.season != null && String(e.season) !== '' ? (
                      <span className={TAG}>📅 {e.season}</span>
                    ) : null}
                    {e.category ? (
                      <span className={`${TAG} inline-flex items-center gap-1`}>
                        <Tags size={12} />
                        {e.category}
                      </span>
                    ) : null}
                    {e.crowd_level ? (
                      <span className={TAG}>👥 {e.crowd_level}</span>
                    ) : null}
                    {e.is_recurring ? (
                      <span className={`${TAG} inline-flex items-center gap-1`}>
                        <Repeat size={12} />
                        متكررة
                      </span>
                    ) : null}
                  </div>

                  <p className="text-sm font-semibold text-slate-500">
                    {e.start_date || e.end_date ? (
                      <>
                        📆 {e.start_date ? String(e.start_date).slice(0, 10) : '—'}
                        {e.end_date ? ` → ${String(e.end_date).slice(0, 10)}` : ''}
                      </>
                    ) : (
                      '— لا تواريخ'
                    )}
                  </p>

                  {e.notes ? (
                    <div className={NOTE_BOX}>{e.notes}</div>
                  ) : (
                    <p className="text-xs font-medium text-slate-500">لا ملاحظات</p>
                  )}
                </div>
              </article>
            )
          })
        )}
      </div>

      {/* Add / Edit modal */}
      {showAdd ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-6"
          onClick={closeModal}
        >
          <div
            onClick={(ev) => ev.stopPropagation()}
            className="relative my-auto w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:max-w-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
                {editRow ? 'تعديل فعالية' : 'إضافة فعالية جديدة'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="إغلاق"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">الاسم *</label>
                <input
                  value={form.name}
                  onChange={(ev) => setForm({ ...form, name: ev.target.value })}
                  className={INPUT}
                  dir="rtl"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">الدولة</label>
                <select
                  value={form.country}
                  onChange={(ev) => setForm({ ...form, country: ev.target.value, city: '' })}
                  className={INPUT}
                >
                  <option value="">—</option>
                  {countryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">المدينة</label>
                <select
                  value={form.city}
                  onChange={(ev) => setForm({ ...form, city: ev.target.value })}
                  className={INPUT}
                >
                  <option value="">—</option>
                  {cityOptionsForForm.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">تاريخ البداية</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(ev) => setForm({ ...form, start_date: ev.target.value })}
                  className={INPUT}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">تاريخ النهاية</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(ev) => setForm({ ...form, end_date: ev.target.value })}
                  className={INPUT}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">الموسم</label>
                <input
                  list="event-seasons-list"
                  value={form.season}
                  onChange={(ev) => setForm({ ...form, season: ev.target.value })}
                  placeholder="أو اختر من القائمة"
                  className={INPUT}
                  dir="rtl"
                />
                <datalist id="event-seasons-list">
                  {seasonOptionsForForm.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">التصنيف</label>
                <input
                  value={form.category}
                  onChange={(ev) => setForm({ ...form, category: ev.target.value })}
                  placeholder="festival..."
                  className={INPUT}
                  dir="rtl"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">مستوى الازدحام</label>
                <input
                  value={form.crowd_level}
                  onChange={(ev) => setForm({ ...form, crowd_level: ev.target.value })}
                  placeholder="low / medium / high"
                  className={INPUT}
                  dir="rtl"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">التأثير</label>
                <select
                  value={form.impact}
                  onChange={(ev) => setForm({ ...form, impact: ev.target.value as 'feature' | 'obstacle' })}
                  className={INPUT}
                >
                  <option value="feature">feature — اذهب</option>
                  <option value="obstacle">obstacle — تجنب</option>
                </select>
              </div>
              <label
                className={`${INNER} sm:col-span-2 flex cursor-pointer items-center gap-3 !py-3`}
              >
                <input
                  type="checkbox"
                  checked={form.is_recurring}
                  onChange={(ev) => setForm({ ...form, is_recurring: ev.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 bg-white accent-[#D4AF37]"
                />
                <span className="text-sm font-semibold text-slate-800">فعالية متكررة</span>
              </label>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">ملاحظات</label>
                <textarea
                  value={form.notes}
                  onChange={(ev) => setForm({ ...form, notes: ev.target.value })}
                  rows={4}
                  className={`${INPUT} resize-y`}
                  dir="rtl"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={saveEvent}
                disabled={saving || !form.name.trim()}
                className={`${BTN_PRIMARY} flex-1`}
              >
                <Save size={16} /> {saving ? 'جارٍ الحفظ...' : editRow ? 'حفظ التعديل' : 'إضافة'}
              </button>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className={BTN_SECONDARY}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
