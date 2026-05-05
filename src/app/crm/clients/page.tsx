'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import { Loader2, Plus, Search, Phone, Mail, Filter, X, Download } from 'lucide-react'

type StatusKey =
  | 'new'
  | 'contacted'
  | 'designing'
  | 'sent'
  | 'confirmed'
  | 'visa'
  | 'booked'
  | 'logistics'
  | 'boxSent'
  | 'traveling'
  | 'followup'
  | 'completed'
  | string

const STATUS_LABELS: Record<StatusKey, { label: string; color: string; bg: string }> = {
  new: { label: 'جديد', color: '#2563EB', bg: '#DBEAFE' },
  contacted: { label: 'تم التواصل', color: '#7C3AED', bg: '#EDE9FE' },
  designing: { label: 'تصميم المسار', color: '#D97706', bg: '#FEF3C7' },
  sent: { label: 'تم الإرسال', color: '#0891B2', bg: '#ECFEFF' },
  confirmed: { label: 'مؤكد', color: '#059669', bg: '#D1FAE5' },
  visa: { label: 'تأشيرة', color: '#C2410C', bg: '#FFEDD5' },
  booked: { label: 'تم الحجز', color: '#0F766E', bg: '#CCFBF1' },
  logistics: { label: 'لوجستيات', color: '#1D4ED8', bg: '#DBEAFE' },
  boxSent: { label: 'تم إرسال البوكس', color: '#9333EA', bg: '#F3E8FF' },
  traveling: { label: 'مسافر', color: '#16A34A', bg: '#DCFCE7' },
  followup: { label: 'متابعة', color: '#6B7280', bg: '#F3F4F6' },
  completed: { label: 'مكتمل', color: '#374151', bg: '#F3F4F6' },
}

const TRAVEL_TYPES = ['فردي', 'قروب عائلي', 'قروب سياحي', 'قروب خاص']

export default function CRMClientsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [clients, setClients] = useState<any[]>([])

  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string>('all')

  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newClient, setNewClient] = useState({
    name: '',
    phone_wa: '',
    email: '',
    travel_type: '',
    job_type: '',
    status: 'new' as StatusKey,
  })

  const loadClients = async () => {
    setError('')
    if (!supabase) {
      setError('Supabase غير متصل. تأكد من إعداد NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY.')
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error: err } = await supabase
      .from('clients')
      .select('id, name, phone_wa, email, job_type, status, ref_code, travel_type, created_at, client_trips(destination, trip_date), client_preferences(interests)')
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message || 'تعذر تحميل العملاء.')
      setClients([])
      setLoading(false)
      return
    }

    setClients(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadClients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return clients.filter((c) => {
      const okStatus = status === 'all' ? true : String(c.status || '') === status
      if (!okStatus) return false
      if (!query) return true
      const blob = `${c?.name || ''} ${c?.phone_wa || ''} ${c?.email || ''}`.toLowerCase()
      return blob.includes(query)
    })
  }, [clients, q, status])

  const addClient = async () => {
    if (!supabase) return
    const name = newClient.name.trim()
    if (!name) return

    setSaving(true)
    setError('')

    const { data, error: err } = await supabase
      .from('clients')
      .insert({
        name,
        phone_wa: newClient.phone_wa.trim() || null,
        email: newClient.email.trim() || null,
        travel_type: newClient.travel_type || null,
        job_type: newClient.job_type.trim() || null,
        status: newClient.status || 'new',
      })
      .select('id')
      .single()

    if (err || !data) {
      setError(err?.message || 'تعذر إضافة العميل.')
      setSaving(false)
      return
    }

    // Ensure preferences row exists
    await supabase.from('client_preferences').insert({ client_id: data.id })

    setShowAdd(false)
    setNewClient({ name: '', phone_wa: '', email: '', travel_type: '', job_type: '', status: 'new' })
    await loadClients()
    setSaving(false)
  }

  const exportExcel = () => {
    const rows = filtered.map((client) => ({
      الاسم: String(client?.name || ''),
      واتساب: String(client?.phone_wa || ''),
      البريد_الإلكتروني: String(client?.email || ''),
      نوع_السفر: String(client?.travel_type || ''),
      المجال: String(client?.job_type || ''),
      الحالة: String(STATUS_LABELS[client?.status as StatusKey]?.label || client?.status || ''),
    }))

    const sheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Clients')
    XLSX.writeFile(workbook, 'clients.xlsx')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#6B7280', fontWeight: 900 }}>
          <Loader2 size={22} style={{ marginBottom: 10, animation: 'spin 1s linear infinite' }} />
          جارٍ تحميل العملاء...
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div dir="rtl" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 1000, color: '#1C4532' }}>العملاء</div>
          <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 800, marginTop: 4 }}>ابحث وفلتر وادخل إلى ملف العميل.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={exportExcel}
            style={{
              padding: '10px 14px',
              borderRadius: 14,
              background: '#fff',
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
            <Download size={16} /> تصدير Excel
          </button>
          <button
            onClick={() => setShowAdd(true)}
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
            <Plus size={16} /> عميل جديد
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: 16, padding: 12, fontSize: 12, fontWeight: 900, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Search + Filter */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 14, boxShadow: '0 1px 6px rgba(0,0,0,.04)', border: '1px solid #F3F0EB', marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F8FAFC', borderRadius: 14, padding: '10px 12px', border: '1px solid #EEF2F7' }}>
            <Search size={16} color="#C9A84C" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث بالاسم أو الرقم أو الإيميل..."
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
              <option value="all">الكل</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, fontWeight: 900, color: '#6B7280' }}>النتائج: {filtered.length}</div>
      </div>

      {/* List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        {filtered.map((c) => {
          const st = STATUS_LABELS[c.status as StatusKey] || STATUS_LABELS.new
          const trips: any[] = Array.isArray(c?.client_trips) ? c.client_trips : []
          const destinations = Array.from(new Set(trips.map((t) => t?.destination).filter(Boolean))).slice(0, 3)
          const interests: string[] = Array.isArray(c?.client_preferences?.[0]?.interests) ? c.client_preferences[0].interests : []

          return (
            <Link
              key={c.id}
              href={`/crm/clients/${c.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ background: '#fff', borderRadius: 16, padding: 14, boxShadow: '0 1px 6px rgba(0,0,0,.04)', border: '1px solid #F3F0EB' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 1000, color: '#1C4532', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 10, color: '#6B7280', fontWeight: 800, marginTop: 6 }}>
                      {c.phone_wa && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <Phone size={12} /> {c.phone_wa}
                        </span>
                      )}
                      {c.email && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <Mail size={12} /> {c.email}
                        </span>
                      )}
                    </div>
                  </div>

                  <span style={{ padding: '5px 10px', borderRadius: 999, fontSize: 10, fontWeight: 1000, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                    {st.label}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {c.travel_type && (
                    <span style={{ fontSize: 10, padding: '5px 10px', borderRadius: 10, background: '#F0FDF4', color: '#166534', fontWeight: 900, border: '1px solid #BBF7D0' }}>
                      🧳 {c.travel_type}
                    </span>
                  )}
                  {destinations.map((d) => (
                    <span key={d} style={{ fontSize: 10, padding: '5px 10px', borderRadius: 10, background: '#DBEAFE', color: '#1E40AF', fontWeight: 900, border: '1px solid #BFDBFE' }}>
                      ✈️ {d}
                    </span>
                  ))}
                  {interests.slice(0, 2).map((x, i) => (
                    <span key={`${x}-${i}`} style={{ fontSize: 10, padding: '5px 10px', borderRadius: 10, background: '#EDE9FE', color: '#5B21B6', fontWeight: 900, border: '1px solid #DDD6FE' }}>
                      🌍 {x}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowAdd(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 560, padding: '24px 22px', maxHeight: '85vh', overflowY: 'auto', position: 'relative' }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 2, background: '#DDD', margin: '0 auto 20px' }} />
            <button
              onClick={() => setShowAdd(false)}
              style={{ position: 'absolute', top: 18, left: 18, width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={14} />
            </button>

            <div style={{ fontSize: 20, fontWeight: 1000, color: '#1C4532', marginBottom: 16 }}>إضافة عميل جديد</div>

            {[
              { key: 'name', label: 'الاسم *', placeholder: 'مثال: أحمد العمري' },
              { key: 'phone_wa', label: 'واتساب', placeholder: '05XXXXXXXX' },
              { key: 'email', label: 'إيميل', placeholder: 'email@example.com' },
              { key: 'job_type', label: 'المجال', placeholder: 'طبيب، مهندس، عسكري...' },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 900, color: '#6B7280', marginBottom: 4, display: 'block' }}>{f.label}</label>
                <input
                  value={(newClient as any)[f.key]}
                  onChange={(e) => setNewClient({ ...newClient, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  style={{ width: '100%', padding: 12, border: '1.5px solid #E5E0D6', borderRadius: 12, fontSize: 13, fontFamily: 'inherit', outline: 'none', direction: 'rtl', fontWeight: 900 }}
                />
              </div>
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 900, color: '#6B7280', marginBottom: 4, display: 'block' }}>نوع السفر</label>
                <select
                  value={newClient.travel_type}
                  onChange={(e) => setNewClient({ ...newClient, travel_type: e.target.value })}
                  style={{ width: '100%', padding: 12, border: '1.5px solid #E5E0D6', borderRadius: 12, fontSize: 12, fontFamily: 'inherit', outline: 'none', fontWeight: 1000, color: '#1C4532' }}
                >
                  <option value="">—</option>
                  {TRAVEL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 900, color: '#6B7280', marginBottom: 4, display: 'block' }}>الحالة</label>
                <select
                  value={newClient.status}
                  onChange={(e) => setNewClient({ ...newClient, status: e.target.value })}
                  style={{ width: '100%', padding: 12, border: '1.5px solid #E5E0D6', borderRadius: 12, fontSize: 12, fontFamily: 'inherit', outline: 'none', fontWeight: 1000, color: '#1C4532' }}
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={addClient}
                disabled={saving || !newClient.name.trim()}
                style={{
                  flex: 1,
                  padding: 14,
                  background: '#1C4532',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 14,
                  fontSize: 13,
                  fontWeight: 1000,
                  cursor: saving || !newClient.name.trim() ? 'not-allowed' : 'pointer',
                  opacity: saving || !newClient.name.trim() ? 0.5 : 1,
                }}
              >
                {saving ? 'جارٍ الحفظ...' : '✅ إضافة العميل'}
              </button>
              <button
                onClick={() => setShowAdd(false)}
                style={{ padding: '14px 18px', background: '#F3F0EB', color: '#6B7280', border: 'none', borderRadius: 14, fontSize: 12, cursor: 'pointer', fontWeight: 900 }}
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

