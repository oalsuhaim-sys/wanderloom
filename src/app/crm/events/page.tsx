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
        style={{
          minHeight: '100vh',
          background: '#F6F4F0',
          fontFamily: 'sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center', color: '#6B7280' }}>
          <Loader2 size={22} style={{ marginBottom: 10, animation: 'spin 1s linear infinite' }} />
          جارٍ تحميل الفعاليات...
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div dir="rtl" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 1000, color: '#1C4532' }}>الفعاليات</div>
          <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 800, marginTop: 4 }}>
            فلترة متسلسلة، بطاقات ملونة، إضافة وتعديل
          </div>
        </div>
        <button
          type="button"
          onClick={openAdd}
          style={{
            padding: '10px 14px',
            borderRadius: 14,
            background: 'linear-gradient(135deg,#8A6B2A,#C9A84C)',
            color: '#1C4532',
            fontSize: 12,
            fontWeight: 1000,
            border: '1px solid rgba(201,168,76,.55)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Plus size={16} /> إضافة فعالية
        </button>
      </div>

      {error && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#991B1B',
            borderRadius: 14,
            padding: 12,
            fontSize: 12,
            fontWeight: 900,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* Filters */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #F3F0EB',
          borderRadius: 16,
          padding: 14,
          boxShadow: '0 1px 6px rgba(0,0,0,.04)',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Filter size={16} color="#C9A84C" />
          <div style={{ fontSize: 13, fontWeight: 900, color: '#1C4532' }}>فلترة</div>
          {listLoading ? <span style={{ fontSize: 11, color: '#9CA3AF' }}>جارٍ التحديث...</span> : null}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 10, border: '1px solid #EEF2F7' }}>
            <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 900, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Globe size={14} /> الدولة
            </div>
            <select
              value={filterCountry}
              onChange={(e) => {
                setFilterCountry(e.target.value)
                setFilterCity('all')
                setFilterSeason('all')
              }}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 12,
                border: '1.5px solid #E5E0D6',
                background: '#fff',
                fontSize: 12,
                fontWeight: 900,
                color: '#1C4532',
                outline: 'none',
              }}
            >
              <option value="all">كل الدول</option>
              {countryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 10, border: '1px solid #EEF2F7' }}>
            <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 900, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={14} /> المدينة
            </div>
            <select
              value={filterCity}
              onChange={(e) => {
                setFilterCity(e.target.value)
                setFilterSeason('all')
              }}
              disabled={filterCountry === 'all' || cityOptionsForFilter.length === 0}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 12,
                border: '1.5px solid #E5E0D6',
                background: '#fff',
                fontSize: 12,
                fontWeight: 900,
                color: '#1C4532',
                outline: 'none',
                opacity: filterCountry === 'all' || cityOptionsForFilter.length === 0 ? 0.55 : 1,
              }}
            >
              <option value="all">{filterCountry === 'all' ? 'اختر الدولة أولاً' : 'كل المدن'}</option>
              {cityOptionsForFilter.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 10, border: '1px solid #EEF2F7' }}>
            <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 900, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalendarDays size={14} /> الموسم
            </div>
            <select
              value={filterSeason}
              onChange={(e) => setFilterSeason(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 12,
                border: '1.5px solid #E5E0D6',
                background: '#fff',
                fontSize: 12,
                fontWeight: 900,
                color: '#1C4532',
                outline: 'none',
              }}
            >
              <option value="all">كل المواسم (حسب الدولة/المدينة)</option>
              {seasonOptionsForFilter.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 10, border: '1px solid #EEF2F7' }}>
            <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 900, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={14} /> التأثير
            </div>
            <select
              value={filterImpact}
              onChange={(e) => setFilterImpact(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 12,
                border: '1.5px solid #E5E0D6',
                background: '#fff',
                fontSize: 12,
                fontWeight: 900,
                color: '#1C4532',
                outline: 'none',
              }}
            >
              <option value="all">الكل</option>
              <option value="feature">feature — اذهب</option>
              <option value="obstacle">obstacle — تجنب</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, fontWeight: 900, color: '#6B7280' }}>
          النتائج: {events.length}
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 28 }}>
        {events.length === 0 && !listLoading ? (
          <div
            style={{
              background: '#fff',
              border: '1px dashed #E5E0D6',
              borderRadius: 16,
              padding: 14,
              color: '#9CA3AF',
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            لا توجد فعاليات مطابقة.
          </div>
        ) : (
          events.map((e, i) => {
            const imp = String(e.impact || '')
            const isFeature = imp === 'feature'
            const isObstacle = imp === 'obstacle'
            const borderColor = isFeature ? '#059669' : isObstacle ? '#DC2626' : '#9CA3AF'
            const headerBg = isFeature ? '#ECFDF5' : isObstacle ? '#FEF2F2' : '#F3F4F6'
            const badgeBg = isFeature ? '#D1FAE5' : isObstacle ? '#FEE2E2' : '#E5E7EB'
            const badgeColor = isFeature ? '#047857' : isObstacle ? '#B91C1C' : '#4B5563'
            const badgeText = isFeature ? 'اذهب' : isObstacle ? 'تجنب' : imp || '—'

            return (
              <div
                key={e.id ?? i}
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  overflow: 'hidden',
                  border: `2px solid ${borderColor}`,
                  boxShadow: '0 2px 10px rgba(0,0,0,.06)',
                  borderRight: `8px solid ${borderColor}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: 14, background: headerBg }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 1000, color: '#1C4532', marginBottom: 8, lineHeight: 1.35 }}>
                      {e.name || `فعالية #${e.id}`}
                    </div>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '6px 12px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 1000,
                        background: badgeBg,
                        color: badgeColor,
                      }}
                    >
                      {isFeature ? '✓ ' : isObstacle ? '✗ ' : ''}
                      {badgeText}
                    </span>
                  </div>
                  <button
                    type="button"
                    title="تعديل"
                    onClick={() => openEdit(e)}
                    style={{
                      flexShrink: 0,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid #E5E0D6',
                      background: '#fff',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 1000,
                      color: '#1C4532',
                    }}
                  >
                    <Pencil size={14} /> تعديل
                  </button>
                </div>

                <div style={{ padding: 14, display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {e.country ? (
                      <span style={{ fontSize: 10, padding: '5px 10px', borderRadius: 10, background: '#EDE9FE', color: '#5B21B6', fontWeight: 900 }}>
                        🌍 {e.country}
                      </span>
                    ) : null}
                    {e.city ? (
                      <span style={{ fontSize: 10, padding: '5px 10px', borderRadius: 10, background: '#DBEAFE', color: '#1E40AF', fontWeight: 900 }}>
                        📍 {e.city}
                      </span>
                    ) : null}
                    {e.season != null && String(e.season) !== '' ? (
                      <span style={{ fontSize: 10, padding: '5px 10px', borderRadius: 10, background: '#FFFBEB', color: '#92400E', fontWeight: 900 }}>
                        📅 {e.season}
                      </span>
                    ) : null}
                    {e.category ? (
                      <span style={{ fontSize: 10, padding: '5px 10px', borderRadius: 10, background: '#F0FDF4', color: '#166534', fontWeight: 900 }}>
                        <Tags size={12} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
                        {e.category}
                      </span>
                    ) : null}
                    {e.crowd_level ? (
                      <span style={{ fontSize: 10, padding: '5px 10px', borderRadius: 10, background: '#F3F4F6', color: '#374151', fontWeight: 900 }}>
                        👥 {e.crowd_level}
                      </span>
                    ) : null}
                    {e.is_recurring ? (
                      <span style={{ fontSize: 10, padding: '5px 10px', borderRadius: 999, background: '#EEF2FF', color: '#4338CA', fontWeight: 900 }}>
                        <Repeat size={12} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
                        متكررة
                      </span>
                    ) : null}
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 900, color: '#6B7280' }}>
                    {e.start_date || e.end_date ? (
                      <>
                        📆 {e.start_date ? String(e.start_date).slice(0, 10) : '—'}
                        {e.end_date ? ` → ${String(e.end_date).slice(0, 10)}` : ''}
                      </>
                    ) : (
                      '— لا تواريخ'
                    )}
                  </div>

                  {e.notes ? (
                    <div style={{ fontSize: 12, color: '#374151', fontWeight: 700, lineHeight: 1.75, background: '#FAFAF8', borderRadius: 12, padding: 12, border: '1px solid #F3F0EB' }}>
                      {e.notes}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 800 }}>لا ملاحظات</div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add / Edit modal */}
      {showAdd && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 300,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            background: 'rgba(0,0,0,.55)',
            backdropFilter: 'blur(6px)',
          }}
          onClick={closeModal}
        >
          <div
            onClick={(ev) => ev.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '24px 24px 0 0',
              width: '100%',
              maxWidth: 640,
              padding: '24px 22px',
              maxHeight: '92vh',
              overflowY: 'auto',
              position: 'relative',
            }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 2, background: '#DDD', margin: '0 auto 16px' }} />
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              style={{
                position: 'absolute',
                top: 18,
                left: 18,
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'rgba(0,0,0,.06)',
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>

            <div style={{ fontSize: 20, fontWeight: 1000, color: '#1C4532', marginBottom: 16 }}>
              {editRow ? 'تعديل فعالية' : 'إضافة فعالية جديدة'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, fontWeight: 900, color: '#6B7280', display: 'block', marginBottom: 4 }}>الاسم *</label>
                <input
                  value={form.name}
                  onChange={(ev) => setForm({ ...form, name: ev.target.value })}
                  style={{ width: '100%', padding: 12, borderRadius: 12, border: '1.5px solid #E5E0D6', fontSize: 13, fontWeight: 900, direction: 'rtl' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 900, color: '#6B7280', display: 'block', marginBottom: 4 }}>الدولة</label>
                <select
                  value={form.country}
                  onChange={(ev) => setForm({ ...form, country: ev.target.value, city: '' })}
                  style={{ width: '100%', padding: 12, borderRadius: 12, border: '1.5px solid #E5E0D6', fontSize: 12, fontWeight: 900, color: '#1C4532' }}
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
                <label style={{ fontSize: 11, fontWeight: 900, color: '#6B7280', display: 'block', marginBottom: 4 }}>المدينة</label>
                <select
                  value={form.city}
                  onChange={(ev) => setForm({ ...form, city: ev.target.value })}
                  style={{ width: '100%', padding: 12, borderRadius: 12, border: '1.5px solid #E5E0D6', fontSize: 12, fontWeight: 900, color: '#1C4532' }}
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
                <label style={{ fontSize: 11, fontWeight: 900, color: '#6B7280', display: 'block', marginBottom: 4 }}>تاريخ البداية</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(ev) => setForm({ ...form, start_date: ev.target.value })}
                  style={{ width: '100%', padding: 12, borderRadius: 12, border: '1.5px solid #E5E0D6', fontSize: 13, fontWeight: 900 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 900, color: '#6B7280', display: 'block', marginBottom: 4 }}>تاريخ النهاية</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(ev) => setForm({ ...form, end_date: ev.target.value })}
                  style={{ width: '100%', padding: 12, borderRadius: 12, border: '1.5px solid #E5E0D6', fontSize: 13, fontWeight: 900 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 900, color: '#6B7280', display: 'block', marginBottom: 4 }}>الموسم</label>
                <input
                  list="event-seasons-list"
                  value={form.season}
                  onChange={(ev) => setForm({ ...form, season: ev.target.value })}
                  placeholder="أو اختر من القائمة"
                  style={{ width: '100%', padding: 12, borderRadius: 12, border: '1.5px solid #E5E0D6', fontSize: 13, fontWeight: 900, direction: 'rtl' }}
                />
                <datalist id="event-seasons-list">
                  {seasonOptionsForForm.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 900, color: '#6B7280', display: 'block', marginBottom: 4 }}>التصنيف</label>
                <input
                  value={form.category}
                  onChange={(ev) => setForm({ ...form, category: ev.target.value })}
                  placeholder="festival..."
                  style={{ width: '100%', padding: 12, borderRadius: 12, border: '1.5px solid #E5E0D6', fontSize: 13, fontWeight: 900, direction: 'rtl' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 900, color: '#6B7280', display: 'block', marginBottom: 4 }}>مستوى الازدحام</label>
                <input
                  value={form.crowd_level}
                  onChange={(ev) => setForm({ ...form, crowd_level: ev.target.value })}
                  placeholder="low / medium / high"
                  style={{ width: '100%', padding: 12, borderRadius: 12, border: '1.5px solid #E5E0D6', fontSize: 13, fontWeight: 900, direction: 'rtl' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 900, color: '#6B7280', display: 'block', marginBottom: 4 }}>التأثير</label>
                <select
                  value={form.impact}
                  onChange={(ev) => setForm({ ...form, impact: ev.target.value as 'feature' | 'obstacle' })}
                  style={{ width: '100%', padding: 12, borderRadius: 12, border: '1.5px solid #E5E0D6', fontSize: 12, fontWeight: 1000, color: '#1C4532' }}
                >
                  <option value="feature">feature — اذهب</option>
                  <option value="obstacle">obstacle — تجنب</option>
                </select>
              </div>
              <label
                style={{
                  gridColumn: '1 / -1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#F8FAFC',
                  border: '1px solid #EEF2F7',
                  padding: '12px 14px',
                  borderRadius: 14,
                }}
              >
                <input
                  type="checkbox"
                  checked={form.is_recurring}
                  onChange={(ev) => setForm({ ...form, is_recurring: ev.target.checked })}
                  style={{ width: 18, height: 18 }}
                />
                <span style={{ fontSize: 12, fontWeight: 1000, color: '#1C4532' }}>فعالية متكررة</span>
              </label>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, fontWeight: 900, color: '#6B7280', display: 'block', marginBottom: 4 }}>ملاحظات</label>
                <textarea
                  value={form.notes}
                  onChange={(ev) => setForm({ ...form, notes: ev.target.value })}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 14,
                    border: '1.5px solid #E5E0D6',
                    fontSize: 13,
                    fontWeight: 900,
                    direction: 'rtl',
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={saveEvent}
                disabled={saving || !form.name.trim()}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 14,
                  border: 'none',
                  background: '#1C4532',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 1000,
                  cursor: saving || !form.name.trim() ? 'not-allowed' : 'pointer',
                  opacity: saving || !form.name.trim() ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Save size={16} /> {saving ? 'جارٍ الحفظ...' : editRow ? 'حفظ التعديل' : 'إضافة'}
              </button>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                style={{
                  padding: '14px 18px',
                  borderRadius: 14,
                  border: 'none',
                  background: '#F3F0EB',
                  color: '#6B7280',
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
