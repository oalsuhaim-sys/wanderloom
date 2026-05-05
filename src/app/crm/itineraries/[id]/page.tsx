'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react'

type ClientRow = { id: number; name: string | null; phone_wa: string | null }
type PlaceRow = {
  id: number
  name: string | null
  city: string | null
  country: string | null
  category: string | null
  image_url: string | null
}

type StopEdit = {
  id: number | null
  place_id: string
  place_name: string
  category: string
  time_slot: string
  note: string
  image_url: string
  transit_mode: string
  transit_duration: string
  transit_distance: string
}

type DayEdit = {
  id: number | null
  title: string
  city: string
  color: string
  stops: StopEdit[]
}

const emptyStop = (): StopEdit => ({
  id: null,
  place_id: '',
  place_name: '',
  category: 'o',
  time_slot: '',
  note: '',
  image_url: '',
  transit_mode: '',
  transit_duration: '',
  transit_distance: '',
})

const STATUSES = ['draft', 'sent', 'active', 'archived'] as const

function parseDates(s: string | null): { from: string; to: string } {
  if (!s) return { from: '', to: '' }
  const parts = s.split('→').map((x) => x.trim())
  if (parts.length >= 2) return { from: parts[0].slice(0, 10), to: parts[1].slice(0, 10) }
  return { from: s.slice(0, 10), to: '' }
}

export default function EditItineraryPage() {
  const params = useParams()
  const router = useRouter()
  const itineraryId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingItinerary, setDeletingItinerary] = useState(false)
  const [error, setError] = useState('')

  const [clients, setClients] = useState<ClientRow[]>([])
  const [clientId, setClientId] = useState('')
  const [title, setTitle] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [status, setStatus] = useState<string>('draft')
  const [passcode, setPasscode] = useState('')

  const [days, setDays] = useState<DayEdit[]>([])

  const [placeSearch, setPlaceSearch] = useState('')
  const [placeHits, setPlaceHits] = useState<PlaceRow[]>([])
  const [placeTarget, setPlaceTarget] = useState<{ dayIdx: number; stopIdx: number } | null>(null)

  const datesLabel = useMemo(() => {
    if (dateFrom && dateTo) return `${dateFrom} → ${dateTo}`
    if (dateFrom) return dateFrom
    return ''
  }, [dateFrom, dateTo])

  const loadClients = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.from('clients').select('id, name, phone_wa').order('name', { ascending: true })
    setClients((data as ClientRow[]) || [])
  }, [])

  const loadItinerary = useCallback(async () => {
    if (!supabase || !itineraryId) return
    setError('')
    setLoading(true)
    const { data, error: err } = await supabase
      .from('itineraries')
      .select(
        `
        id, client_id, title, dates, passcode, status,
        itinerary_days (
          id, day_num, title, city, color, sort_order,
          itinerary_stops (
            id, place_id, place_name, category, time_slot, note, image_url,
            transit_mode, transit_duration, transit_distance, sort_order
          )
        )
      `,
      )
      .eq('id', itineraryId)
      .single()

    if (err || !data) {
      setError(err?.message || 'تعذر تحميل المسار.')
      setLoading(false)
      return
    }

    const row = data as any
    setClientId(String(row.client_id ?? ''))
    setTitle(String(row.title || ''))
    const { from, to } = parseDates(row.dates)
    setDateFrom(from)
    setDateTo(to)
    setStatus(String(row.status || 'draft'))
    setPasscode(String(row.passcode || ''))

    const rawDays: any[] = Array.isArray(row.itinerary_days) ? row.itinerary_days : []
    rawDays.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    setDays(
      rawDays.map((d) => {
        const stops: any[] = Array.isArray(d.itinerary_stops) ? [...d.itinerary_stops] : []
        stops.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        return {
          id: d.id,
          title: String(d.title || ''),
          city: String(d.city || ''),
          color: String(d.color || '#2563EB'),
          stops: stops.map((s) => ({
            id: s.id,
            place_id: s.place_id != null ? String(s.place_id) : '',
            place_name: String(s.place_name || ''),
            category: String(s.category || 'o'),
            time_slot: String(s.time_slot || ''),
            note: String(s.note || ''),
            image_url: String(s.image_url || ''),
            transit_mode: String(s.transit_mode || ''),
            transit_duration: String(s.transit_duration ?? ''),
            transit_distance: String(s.transit_distance ?? ''),
          })),
        }
      }),
    )

    if (rawDays.length === 0) {
      setDays([
        {
          id: null,
          title: 'اليوم 1',
          city: '',
          color: '#2563EB',
          stops: [emptyStop()],
        },
      ])
    }

    setLoading(false)
  }, [itineraryId])

  useEffect(() => {
    void loadClients()
  }, [loadClients])

  useEffect(() => {
    if (!itineraryId) {
      setError('معرّف غير صالح.')
      setLoading(false)
      return
    }
    void loadItinerary()
  }, [itineraryId, loadItinerary])

  useEffect(() => {
    if (!supabase || !placeSearch.trim() || !placeTarget) {
      setPlaceHits([])
      return
    }
    const sb = supabase
    const t = window.setTimeout(async () => {
      const q = placeSearch.trim()
      const { data } = await sb
        .from('places')
        .select('id,name,city,country,category,image_url')
        .ilike('name', `%${q}%`)
        .limit(10)
      setPlaceHits((data as PlaceRow[]) || [])
    }, 280)
    return () => window.clearTimeout(t)
  }, [placeSearch, placeTarget, supabase])

  const applyPlace = (p: PlaceRow) => {
    if (!placeTarget) return
    const { dayIdx, stopIdx } = placeTarget
    setDays((prev) =>
      prev.map((day, i) => {
        if (i !== dayIdx) return day
        return {
          ...day,
          stops: day.stops.map((s, j) =>
            j !== stopIdx
              ? s
              : {
                  ...s,
                  place_id: String(p.id),
                  place_name: String(p.name || ''),
                  category: String(p.category || 'o'),
                  image_url: String(p.image_url || ''),
                },
          ),
        }
      }),
    )
    setPlaceTarget(null)
    setPlaceSearch('')
    setPlaceHits([])
  }

  const saveAll = async () => {
    if (!supabase || !itineraryId) return
    if (!clientId) {
      setError('اختر العميل.')
      return
    }
    if (!title.trim()) {
      setError('العنوان مطلوب.')
      return
    }

    setSaving(true)
    setError('')

    const { error: upErr } = await supabase
      .from('itineraries')
      .update({
        client_id: Number(clientId),
        title: title.trim(),
        dates: datesLabel || null,
        status,
        passcode: passcode.trim() || null,
      })
      .eq('id', itineraryId)

    if (upErr) {
      setError(upErr.message || 'تعذر حفظ بيانات المسار.')
      setSaving(false)
      return
    }

    const { data: dbDays, error: dErr } = await supabase.from('itinerary_days').select('id').eq('itinerary_id', itineraryId)
    if (dErr) {
      setError(dErr.message || 'تعذر مزامنة الأيام.')
      setSaving(false)
      return
    }

    const stateDayIds = days.map((d) => d.id).filter((x): x is number => x != null)
    const toDeleteDays = (dbDays || []).map((d) => d.id).filter((id) => !stateDayIds.includes(id))
    for (const did of toDeleteDays) {
      await supabase.from('itinerary_stops').delete().eq('day_id', did)
      await supabase.from('itinerary_days').delete().eq('id', did)
    }

    for (let i = 0; i < days.length; i += 1) {
      const day = days[i]
      const dayPayload = {
        itinerary_id: itineraryId,
        day_num: i + 1,
        title: day.title.trim() || `اليوم ${i + 1}`,
        city: day.city.trim() || null,
        color: day.color || '#2563EB',
        sort_order: i,
      }

      let dayId = day.id
      if (dayId) {
        const { error: e2 } = await supabase.from('itinerary_days').update(dayPayload).eq('id', dayId)
        if (e2) {
          setError(e2.message || 'تعذر تحديث يوم.')
          setSaving(false)
          return
        }
      } else {
        const { data: ins, error: e3 } = await supabase.from('itinerary_days').insert(dayPayload).select('id').single()
        if (e3 || !ins) {
          setError(e3?.message || 'تعذر إضافة يوم.')
          setSaving(false)
          return
        }
        dayId = ins.id
      }

      const { data: dbStops, error: sErr } = await supabase.from('itinerary_stops').select('id').eq('day_id', dayId)
      if (sErr) {
        setError(sErr.message || 'تعذر قراءة المحطات.')
        setSaving(false)
        return
      }

      const stateStopIds = day.stops.map((s) => s.id).filter((x): x is number => x != null)
      const toDelStops = (dbStops || []).map((s) => s.id).filter((id) => !stateStopIds.includes(id))
      for (const sid of toDelStops) {
        await supabase.from('itinerary_stops').delete().eq('id', sid)
      }

      for (let j = 0; j < day.stops.length; j += 1) {
        const st = day.stops[j]
        if (!st.place_name.trim()) continue
        const sp = {
          day_id: dayId,
          place_id: st.place_id ? Number(st.place_id) : null,
          place_name: st.place_name.trim(),
          category: st.category || 'o',
          time_slot: st.time_slot.trim() || null,
          note: st.note.trim() || null,
          image_url: st.image_url.trim() || null,
          transit_mode: st.transit_mode || null,
          transit_duration: st.transit_duration.trim() || null,
          transit_distance: st.transit_distance.trim() || null,
          sort_order: j,
        }
        if (st.id) {
          const { error: e4 } = await supabase.from('itinerary_stops').update(sp).eq('id', st.id)
          if (e4) {
            setError(e4.message || 'تعذر تحديث محطة.')
            setSaving(false)
            return
          }
        } else {
          const { error: e5 } = await supabase.from('itinerary_stops').insert(sp)
          if (e5) {
            setError(e5.message || 'تعذر إضافة محطة.')
            setSaving(false)
            return
          }
        }
      }
    }

    await loadItinerary()
    setSaving(false)
  }

  const deleteItinerary = async () => {
    if (!supabase || !itineraryId) return
    if (!window.confirm('هل أنت متأكد من حذف هذا المسار بالكامل؟ لا يمكن التراجع.')) return
    setDeletingItinerary(true)
    setError('')

    const { data: dayRows, error: dErr } = await supabase.from('itinerary_days').select('id').eq('itinerary_id', itineraryId)
    if (dErr) {
      setError(dErr.message || 'تعذر قراءة الأيام.')
      setDeletingItinerary(false)
      return
    }
    for (const row of dayRows || []) {
      await supabase.from('itinerary_stops').delete().eq('day_id', row.id)
    }
    await supabase.from('itinerary_days').delete().eq('itinerary_id', itineraryId)
    const { error: delErr } = await supabase.from('itineraries').delete().eq('id', itineraryId)
    if (delErr) {
      setError(delErr.message || 'تعذر حذف المسار.')
      setDeletingItinerary(false)
      return
    }
    router.push('/crm/itineraries')
  }

  const removeDayAt = (dayIdx: number) => {
    if (!window.confirm('حذف هذا اليوم وجميع محطاته؟')) return
    setDays((d) => (d.length <= 1 ? d : d.filter((_, i) => i !== dayIdx)))
  }

  const removeStopAt = (dayIdx: number, stopIdx: number) => {
    if (!window.confirm('حذف هذه المحطة؟')) return
    setDays((prev) =>
      prev.map((day, i) => {
        if (i !== dayIdx) return day
        if (day.stops.length <= 1) return day
        return { ...day, stops: day.stops.filter((_, j) => j !== stopIdx) }
      }),
    )
  }

  if (loading) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div dir="rtl" style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
      <Link href="/crm/itineraries" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#1C4532', fontWeight: 1000, fontSize: 12, textDecoration: 'none', marginBottom: 12 }}>
        <ArrowLeft size={16} /> المسارات
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 1000, color: '#1C4532', margin: 0 }}>تعديل المسار</h1>
        <button
          type="button"
          onClick={deleteItinerary}
          disabled={deletingItinerary}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid #FECACA',
            background: '#FEF2F2',
            color: '#991B1B',
            fontWeight: 1000,
            fontSize: 12,
            cursor: deletingItinerary ? 'not-allowed' : 'pointer',
            opacity: deletingItinerary ? 0.65 : 1,
          }}
        >
          {deletingItinerary ? 'جارٍ الحذف...' : 'حذف المسار'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: 12, padding: 12, fontSize: 12, fontWeight: 900, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <section style={{ background: '#fff', border: '1px solid #F3F0EB', borderRadius: 16, padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 1000, color: '#1C4532', marginBottom: 10 }}>بيانات المسار</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, fontWeight: 900, color: '#6B7280' }}>العنوان</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1.5px solid #E5E0D6', fontWeight: 900 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 900, color: '#6B7280' }}>العميل</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={{ width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1.5px solid #E5E0D6', fontWeight: 900 }}>
              <option value="">—</option>
              {clients.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name || `#${c.id}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 900, color: '#6B7280' }}>الحالة</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1.5px solid #E5E0D6', fontWeight: 900 }}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 900, color: '#6B7280' }}>من تاريخ</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1.5px solid #E5E0D6', fontWeight: 900 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 900, color: '#6B7280' }}>إلى تاريخ</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1.5px solid #E5E0D6', fontWeight: 900 }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, fontWeight: 900, color: '#6B7280' }}>Passcode</label>
            <input value={passcode} onChange={(e) => setPasscode(e.target.value.toUpperCase())} style={{ width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1.5px solid #E5E0D6', fontWeight: 900, letterSpacing: 2 }} />
          </div>
        </div>
      </section>

      {days.map((day, dayIdx) => (
        <section key={day.id ?? `new-${dayIdx}`} style={{ background: '#fff', border: '1px solid #F3F0EB', borderRadius: 16, padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 1000, color: '#1C4532' }}>يوم {dayIdx + 1}</span>
            <button
              type="button"
              onClick={() => removeDayAt(dayIdx)}
              disabled={days.length <= 1}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#991B1B', fontSize: 11, fontWeight: 1000, cursor: days.length <= 1 ? 'not-allowed' : 'pointer' }}
            >
              <Trash2 size={12} style={{ verticalAlign: 'middle' }} /> حذف اليوم
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 8, marginBottom: 10 }}>
            <input
              placeholder="المدينة"
              value={day.city}
              onChange={(e) => setDays((prev) => prev.map((d, i) => (i === dayIdx ? { ...d, city: e.target.value } : d)))}
              style={{ padding: 10, borderRadius: 10, border: '1.5px solid #E5E0D6', fontWeight: 900 }}
            />
            <input
              placeholder="عنوان اليوم"
              value={day.title}
              onChange={(e) => setDays((prev) => prev.map((d, i) => (i === dayIdx ? { ...d, title: e.target.value } : d)))}
              style={{ padding: 10, borderRadius: 10, border: '1.5px solid #E5E0D6', fontWeight: 900 }}
            />
            <input
              placeholder="لون"
              value={day.color}
              onChange={(e) => setDays((prev) => prev.map((d, i) => (i === dayIdx ? { ...d, color: e.target.value } : d)))}
              style={{ padding: 10, borderRadius: 10, border: '1.5px solid #E5E0D6', fontWeight: 900 }}
            />
          </div>

          {day.stops.map((st, stopIdx) => (
            <div key={st.id ?? `s-${dayIdx}-${stopIdx}`} style={{ background: '#F8FAFC', borderRadius: 12, padding: 10, marginBottom: 8, border: '1px solid #EEF2F7' }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#6B7280', marginBottom: 6 }}>محطة {stopIdx + 1}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Search size={14} color="#C9A84C" />
                    <input
                      placeholder="بحث في بنك الأماكن (اسم)..."
                      value={placeTarget?.dayIdx === dayIdx && placeTarget?.stopIdx === stopIdx ? placeSearch : ''}
                      onFocus={() => {
                        setPlaceTarget({ dayIdx, stopIdx })
                        setPlaceSearch('')
                      }}
                      onChange={(e) => {
                        setPlaceTarget({ dayIdx, stopIdx })
                        setPlaceSearch(e.target.value)
                      }}
                      style={{ flex: 1, padding: 8, borderRadius: 8, border: '1.5px solid #E5E0D6', fontWeight: 900 }}
                    />
                  </div>
                  {placeTarget?.dayIdx === dayIdx && placeTarget?.stopIdx === stopIdx && placeHits.length > 0 ? (
                    <div style={{ marginTop: 6, maxHeight: 140, overflowY: 'auto', border: '1px solid #E5E0D6', borderRadius: 8, background: '#fff' }}>
                      {placeHits.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => applyPlace(p)}
                          style={{ display: 'block', width: '100%', textAlign: 'right', padding: 8, border: 'none', borderBottom: '1px solid #F3F0EB', background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 900 }}
                        >
                          {p.name} {p.city ? `· ${p.city}` : ''}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <input
                  placeholder="اسم المحطة"
                  value={st.place_name}
                  onChange={(e) =>
                    setDays((prev) =>
                      prev.map((d, i) =>
                        i !== dayIdx
                          ? d
                          : {
                              ...d,
                              stops: d.stops.map((s, j) => (j === stopIdx ? { ...s, place_name: e.target.value } : s)),
                            },
                      ),
                    )
                  }
                  style={{ padding: 8, borderRadius: 8, border: '1.5px solid #E5E0D6', fontWeight: 900 }}
                />
                <input
                  placeholder="معرّف place (اختياري)"
                  value={st.place_id}
                  onChange={(e) =>
                    setDays((prev) =>
                      prev.map((d, i) =>
                        i !== dayIdx
                          ? d
                          : {
                              ...d,
                              stops: d.stops.map((s, j) => (j === stopIdx ? { ...s, place_id: e.target.value } : s)),
                            },
                      ),
                    )
                  }
                  style={{ padding: 8, borderRadius: 8, border: '1.5px solid #E5E0D6', fontWeight: 900 }}
                />
                <input
                  placeholder="وقت"
                  value={st.time_slot}
                  onChange={(e) =>
                    setDays((prev) =>
                      prev.map((d, i) =>
                        i !== dayIdx
                          ? d
                          : {
                              ...d,
                              stops: d.stops.map((s, j) => (j === stopIdx ? { ...s, time_slot: e.target.value } : s)),
                            },
                      ),
                    )
                  }
                  style={{ padding: 8, borderRadius: 8, border: '1.5px solid #E5E0D6', fontWeight: 900 }}
                />
                <input
                  placeholder="صورة URL"
                  value={st.image_url}
                  onChange={(e) =>
                    setDays((prev) =>
                      prev.map((d, i) =>
                        i !== dayIdx
                          ? d
                          : {
                              ...d,
                              stops: d.stops.map((s, j) => (j === stopIdx ? { ...s, image_url: e.target.value } : s)),
                            },
                      ),
                    )
                  }
                  style={{ padding: 8, borderRadius: 8, border: '1.5px solid #E5E0D6', fontWeight: 900 }}
                />
                <select
                  value={st.transit_mode}
                  onChange={(e) =>
                    setDays((prev) =>
                      prev.map((d, i) =>
                        i !== dayIdx
                          ? d
                          : {
                              ...d,
                              stops: d.stops.map((s, j) => (j === stopIdx ? { ...s, transit_mode: e.target.value } : s)),
                            },
                      ),
                    )
                  }
                  style={{ padding: 8, borderRadius: 8, border: '1.5px solid #E5E0D6', fontWeight: 900 }}
                >
                  <option value="">تنقل</option>
                  <option value="walk">walk</option>
                  <option value="subway">subway</option>
                  <option value="car">car</option>
                  <option value="bus">bus</option>
                </select>
                <input
                  placeholder="مدة التنقل"
                  value={st.transit_duration}
                  onChange={(e) =>
                    setDays((prev) =>
                      prev.map((d, i) =>
                        i !== dayIdx
                          ? d
                          : {
                              ...d,
                              stops: d.stops.map((s, j) => (j === stopIdx ? { ...s, transit_duration: e.target.value } : s)),
                            },
                      ),
                    )
                  }
                  style={{ padding: 8, borderRadius: 8, border: '1.5px solid #E5E0D6', fontWeight: 900 }}
                />
                <input
                  placeholder="مسافة التنقل"
                  value={st.transit_distance}
                  onChange={(e) =>
                    setDays((prev) =>
                      prev.map((d, i) =>
                        i !== dayIdx
                          ? d
                          : {
                              ...d,
                              stops: d.stops.map((s, j) => (j === stopIdx ? { ...s, transit_distance: e.target.value } : s)),
                            },
                      ),
                    )
                  }
                  style={{ padding: 8, borderRadius: 8, border: '1.5px solid #E5E0D6', fontWeight: 900 }}
                />
                <input
                  placeholder="فئة l/r/c/..."
                  value={st.category}
                  onChange={(e) =>
                    setDays((prev) =>
                      prev.map((d, i) =>
                        i !== dayIdx
                          ? d
                          : {
                              ...d,
                              stops: d.stops.map((s, j) => (j === stopIdx ? { ...s, category: e.target.value } : s)),
                            },
                      ),
                    )
                  }
                  style={{ padding: 8, borderRadius: 8, border: '1.5px solid #E5E0D6', fontWeight: 900 }}
                />
                <textarea
                  placeholder="ملاحظة"
                  value={st.note}
                  onChange={(e) =>
                    setDays((prev) =>
                      prev.map((d, i) =>
                        i !== dayIdx
                          ? d
                          : {
                              ...d,
                              stops: d.stops.map((s, j) => (j === stopIdx ? { ...s, note: e.target.value } : s)),
                            },
                      ),
                    )
                  }
                  rows={2}
                  style={{ gridColumn: '1 / -1', padding: 8, borderRadius: 8, border: '1.5px solid #E5E0D6', fontWeight: 900 }}
                />
              </div>
              <button
                type="button"
                onClick={() => removeStopAt(dayIdx, stopIdx)}
                disabled={day.stops.length <= 1}
                style={{ marginTop: 8, padding: '6px 10px', fontSize: 11, fontWeight: 1000, borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#991B1B', cursor: day.stops.length <= 1 ? 'not-allowed' : 'pointer' }}
              >
                حذف المحطة
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              setDays((prev) =>
                prev.map((d, i) => (i === dayIdx ? { ...d, stops: [...d.stops, emptyStop()] } : d)),
              )
            }
            style={{ marginTop: 6, padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(201,168,76,.55)', background: '#fff', fontWeight: 1000, fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} /> إضافة محطة
          </button>
        </section>
      ))}

      <button
        type="button"
        onClick={() =>
          setDays((d) => [
            ...d,
            { id: null, title: `اليوم ${d.length + 1}`, city: '', color: '#2563EB', stops: [emptyStop()] },
          ])
        }
        style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid #E5E0D6', background: '#fff', fontWeight: 1000, marginBottom: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
      >
        <Plus size={16} /> إضافة يوم
      </button>

      <button
        type="button"
        onClick={saveAll}
        disabled={saving}
        style={{
          width: '100%',
          padding: 14,
          borderRadius: 14,
          border: 'none',
          background: '#1C4532',
          color: '#fff',
          fontWeight: 1000,
          fontSize: 13,
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <Save size={18} /> {saving ? 'جارٍ الحفظ...' : 'حفظ كل التغييرات'}
      </button>
    </div>
  )
}
