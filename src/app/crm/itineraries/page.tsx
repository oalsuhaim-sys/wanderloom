'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  Copy,
  ExternalLink,
  Filter,
  Loader2,
  Pencil,
  Plus,
  Power,
  Route,
  Search,
  Trash2,
} from 'lucide-react'

const STATUS_FILTER = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'draft', label: 'draft' },
  { value: 'sent', label: 'sent' },
  { value: 'active', label: 'active' },
  { value: 'archived', label: 'archived' },
] as const

type Row = {
  id: number
  title: string | null
  dates: string | null
  passcode: string | null
  status: string | null
  clients?: { name?: string | null; phone_wa?: string | null } | null
  itinerary_days?: { id: number }[] | null
}

export default function CRMItinerariesPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<Row[]>([])

  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError('')
    if (!supabase) {
      setError('Supabase غير متصل. تأكد من إعداد NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY.')
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error: err } = await supabase
      .from('itineraries')
      .select('id, client_id, title, dates, passcode, status, created_at, clients(name, phone_wa), itinerary_days(id)')
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message || 'تعذر تحميل المسارات.')
      setRows([])
    } else {
      setRows((data as Row[]) || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return rows.filter((r) => {
      const okStatus = status === 'all' ? true : String(r?.status || '') === status
      if (!okStatus) return false
      if (!query) return true
      const clientName = r?.clients?.name || ''
      const blob = `${r?.title || ''} ${r?.passcode || ''} ${clientName}`.toLowerCase()
      return blob.includes(query)
    })
  }, [rows, q, status])

  const toggleStatus = async (row: Row) => {
    if (!supabase || !row?.id) return
    const next = String(row.status || '') === 'archived' ? 'active' : 'archived'
    setBusyId(row.id)
    setError('')
    const { error: err } = await supabase.from('itineraries').update({ status: next }).eq('id', row.id)
    if (err) setError(err.message || 'تعذر تغيير الحالة.')
    await load()
    setBusyId(null)
  }

  const copyPasscode = async (pc: string) => {
    if (!pc) return
    await navigator.clipboard.writeText(pc)
  }

  const deleteItinerary = async (row: Row) => {
    if (!supabase || !row.id) return
    if (!window.confirm(`حذف المسار «${row.title || row.id}» نهائياً؟`)) return
    setBusyId(row.id)
    setError('')
    const { data: days, error: dErr } = await supabase.from('itinerary_days').select('id').eq('itinerary_id', row.id)
    if (dErr) {
      setError(dErr.message || 'تعذر تحضير الحذف.')
      setBusyId(null)
      return
    }
    for (const d of days || []) {
      await supabase.from('itinerary_stops').delete().eq('day_id', d.id)
    }
    await supabase.from('itinerary_days').delete().eq('itinerary_id', row.id)
    const { error: delErr } = await supabase.from('itineraries').delete().eq('id', row.id)
    if (delErr) setError(delErr.message || 'تعذر حذف المسار.')
    await load()
    setBusyId(null)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#6B7280', fontWeight: 900 }}>
          <Loader2 size={22} style={{ marginBottom: 10, animation: 'spin 1s linear infinite' }} />
          جارٍ تحميل المسارات...
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div dir="rtl" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 1000, color: '#1C4532' }}>المسارات</div>
          <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 800, marginTop: 4 }}>إدارة المسارات والبورتال</div>
        </div>
        <Link
          href="/crm/itineraries/new"
          style={{
            textDecoration: 'none',
            padding: '10px 16px',
            borderRadius: 14,
            background: 'linear-gradient(135deg,#8A6B2A,#C9A84C)',
            color: '#1C4532',
            fontSize: 12,
            fontWeight: 1000,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            border: '1px solid rgba(201,168,76,.55)',
          }}
        >
          <Plus size={16} /> مسار جديد +
        </Link>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: 16, padding: 12, fontSize: 12, fontWeight: 900, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 16, padding: 14, boxShadow: '0 1px 6px rgba(0,0,0,.04)', border: '1px solid #F3F0EB', marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F8FAFC', borderRadius: 14, padding: '10px 12px', border: '1px solid #EEF2F7' }}>
            <Search size={16} color="#C9A84C" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث بالعنوان أو passcode أو اسم العميل..."
              style={{ border: 'none', outline: 'none', width: '100%', background: 'transparent', fontFamily: 'inherit', fontSize: 13, fontWeight: 900, direction: 'rtl' }}
            />
          </div>
          <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 10, border: '1px solid #EEF2F7' }}>
            <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Filter size={14} /> الحالة
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 12, border: '1.5px solid #E5E0D6', background: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 1000, color: '#1C4532', outline: 'none' }}
            >
              {STATUS_FILTER.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, fontWeight: 900, color: '#6B7280' }}>النتائج: {filtered.length}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.length === 0 ? (
          <div style={{ background: '#fff', border: '1px dashed #E5E0D6', borderRadius: 16, padding: 14, color: '#9CA3AF', fontSize: 12, fontWeight: 900 }}>لا توجد مسارات.</div>
        ) : (
          filtered.map((r) => {
            const clientName = r?.clients?.name || '—'
            const dayCount = Array.isArray(r.itinerary_days) ? r.itinerary_days.length : 0
            const pc = r.passcode || ''
            const st = String(r.status || '')
            const busy = busyId === r.id

            return (
              <div key={r.id} style={{ background: '#fff', borderRadius: 16, padding: 14, boxShadow: '0 1px 6px rgba(0,0,0,.04)', border: '1px solid #F3F0EB' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 1000, color: '#1C4532', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Route size={18} color="#C9A84C" /> {r.title || 'بدون عنوان'}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#6B7280', marginTop: 8 }}>
                      👤 {clientName} · 📅 {r.dates || '—'} · 🗓️ {dayCount} يوم
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <code style={{ fontSize: 12, fontWeight: 1000, background: '#F6F4F0', padding: '4px 10px', borderRadius: 8, border: '1px solid #E5E0D6' }}>{pc || '—'}</code>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 1000,
                          background: st === 'archived' ? '#FEE2E2' : st === 'draft' ? '#FEF3C7' : '#D1FAE5',
                          color: st === 'archived' ? '#991B1B' : st === 'draft' ? '#92400E' : '#166534',
                        }}
                      >
                        {st || '—'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => toggleStatus(r)}
                      disabled={busy}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid #E5E0D6',
                        background: '#fff',
                        fontSize: 11,
                        fontWeight: 1000,
                        color: '#1C4532',
                        cursor: busy ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Power size={13} />
                      {st === 'archived' ? 'تفعيل' : 'إيقاف'}
                    </button>
                    <Link
                      href={`/crm/itineraries/${r.id}`}
                      style={{
                        textDecoration: 'none',
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid rgba(201,168,76,.55)',
                        background: '#FFFBF0',
                        fontSize: 11,
                        fontWeight: 1000,
                        color: '#1C4532',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Pencil size={13} /> تعديل
                    </Link>
                    <button
                      type="button"
                      onClick={() => deleteItinerary(r)}
                      disabled={busy}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid #FECACA',
                        background: '#FEF2F2',
                        color: '#991B1B',
                        fontSize: 11,
                        fontWeight: 1000,
                        cursor: busy ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Trash2 size={13} /> حذف
                    </button>
                    <button
                      type="button"
                      onClick={() => copyPasscode(pc)}
                      disabled={!pc}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid #E5E0D6',
                        background: '#fff',
                        fontSize: 11,
                        fontWeight: 1000,
                        cursor: !pc ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Copy size={13} /> نسخ
                    </button>
                    {pc ? (
                      <a
                        href={`/portal/${encodeURIComponent(pc)}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          textDecoration: 'none',
                          padding: '8px 10px',
                          borderRadius: 10,
                          border: 'none',
                          background: '#1C4532',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 1000,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <ExternalLink size={13} /> البورتال
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
