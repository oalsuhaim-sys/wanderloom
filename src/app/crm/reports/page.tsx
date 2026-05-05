'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import { Download, Loader2, Plus, Save, Trash2 } from 'lucide-react'

type TripRow = {
  id: number
  client_id: number | null
  destination: string | null
  profit: number | null
  trip_date: string | null
  clients?: { name?: string | null } | { name?: string | null }[] | null
}

type ClientRow = {
  id: number
  name: string | null
}

export default function CRMReportsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [trips, setTrips] = useState<TripRow[]>([])
  const [clients, setClients] = useState<ClientRow[]>([])
  const [savingIds, setSavingIds] = useState<Record<number, boolean>>({})
  const [deletingIds, setDeletingIds] = useState<Record<number, boolean>>({})
  const [drafts, setDrafts] = useState<Record<number, { destination: string; profit: string }>>({})
  const [adding, setAdding] = useState(false)
  const [newTrip, setNewTrip] = useState({
    client_id: '',
    destination: '',
    profit: '',
  })

  const loadTrips = async () => {
    setError('')
    if (!supabase) {
      setError('Supabase غير متصل. تأكد من إعداد NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY.')
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error: err } = await supabase
      .from('client_trips')
      .select('id, client_id, destination, profit, trip_date, clients(name)')
      .order('trip_date', { ascending: false })

    if (err) {
      setError(err.message || 'تعذر تحميل بيانات التقارير.')
      setTrips([])
      setLoading(false)
      return
    }

    setTrips((data as TripRow[]) || [])
    setLoading(false)
  }

  const loadClients = async () => {
    if (!supabase) return
    const { data, error: err } = await supabase.from('clients').select('id, name').order('name', { ascending: true })
    if (err) {
      setError(err.message || 'تعذر تحميل قائمة العملاء.')
      setClients([])
      return
    }
    setClients((data as ClientRow[]) || [])
  }

  useEffect(() => {
    void Promise.all([loadTrips(), loadClients()])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const nextDrafts: Record<number, { destination: string; profit: string }> = {}
    trips.forEach((trip) => {
      nextDrafts[trip.id] = {
        destination: String(trip.destination || ''),
        profit: String(trip.profit ?? ''),
      }
    })
    setDrafts(nextDrafts)
  }, [trips])

  const normalizedTrips = useMemo(() => {
    return trips.map((trip) => {
      const relation = Array.isArray(trip.clients) ? trip.clients[0] : trip.clients
      return {
        id: trip.id,
        destination: String(trip.destination || ''),
        profit: Number(trip.profit || 0),
        trip_date: String(trip.trip_date || ''),
        clientName: String(relation?.name || 'عميل غير معروف'),
      }
    })
  }, [trips])

  const summary = useMemo(() => {
    const totalRevenue = normalizedTrips.reduce((sum, trip) => sum + trip.profit, 0)
    const tripCount = normalizedTrips.length
    const avgProfit = tripCount ? totalRevenue / tripCount : 0

    const clientProfits = new Map<string, number>()
    normalizedTrips.forEach((trip) => {
      clientProfits.set(trip.clientName, (clientProfits.get(trip.clientName) || 0) + trip.profit)
    })

    let topClient = '—'
    let topClientProfit = 0
    clientProfits.forEach((profit, name) => {
      if (profit > topClientProfit) {
        topClient = name
        topClientProfit = profit
      }
    })

    return { totalRevenue, tripCount, avgProfit, topClient, topClientProfit }
  }, [normalizedTrips])

  const updateTrip = async (tripId: number) => {
    if (!supabase) return
    const draft = drafts[tripId]
    if (!draft) return

    const profitNumber = Number(draft.profit)
    if (Number.isNaN(profitNumber)) {
      setError('الرجاء إدخال رقم صحيح في خانة الربح.')
      return
    }

    setSavingIds((prev) => ({ ...prev, [tripId]: true }))
    setError('')

    const { error: err } = await supabase
      .from('client_trips')
      .update({
        destination: draft.destination.trim() || null,
        profit: profitNumber,
      })
      .eq('id', tripId)

    if (err) {
      setError(err.message || 'تعذر تحديث الرحلة.')
      setSavingIds((prev) => ({ ...prev, [tripId]: false }))
      return
    }

    await loadTrips()
    setSavingIds((prev) => ({ ...prev, [tripId]: false }))
  }

  const deleteTrip = async (tripId: number) => {
    if (!supabase) return
    const confirmed = window.confirm('هل أنت متأكد من حذف هذه الرحلة؟')
    if (!confirmed) return

    setDeletingIds((prev) => ({ ...prev, [tripId]: true }))
    setError('')

    const { error: err } = await supabase.from('client_trips').delete().eq('id', tripId)
    if (err) {
      setError(err.message || 'تعذر حذف الرحلة.')
      setDeletingIds((prev) => ({ ...prev, [tripId]: false }))
      return
    }

    await loadTrips()
    setDeletingIds((prev) => ({ ...prev, [tripId]: false }))
  }

  const addTrip = async () => {
    if (!supabase) return
    const clientId = Number(newTrip.client_id)
    const profitNumber = Number(newTrip.profit)
    if (!clientId || !newTrip.destination.trim() || Number.isNaN(profitNumber)) {
      setError('املأ بيانات الرحلة الجديدة بشكل صحيح.')
      return
    }

    setAdding(true)
    setError('')

    const { error: err } = await supabase.from('client_trips').insert({
      client_id: clientId,
      destination: newTrip.destination.trim(),
      profit: profitNumber,
      trip_date: new Date().toISOString().slice(0, 10),
    })

    if (err) {
      setError(err.message || 'تعذر إضافة الرحلة.')
      setAdding(false)
      return
    }

    setNewTrip({ client_id: '', destination: '', profit: '' })
    await loadTrips()
    setAdding(false)
  }

  const exportExcel = () => {
    const rows = normalizedTrips.map((trip) => ({
      العميل: trip.clientName,
      الوجهة: trip.destination,
      الربح: trip.profit,
      تاريخ_الرحلة: trip.trip_date,
    }))

    const sheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Financial Report')
    XLSX.writeFile(workbook, 'financial-reports.xlsx')
  }

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #E5E0D6',
    boxShadow: '0 1px 6px rgba(0,0,0,.04)',
    padding: 14,
  }

  if (loading) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#6B7280', fontWeight: 900 }}>
          <Loader2 size={22} style={{ marginBottom: 10, animation: 'spin 1s linear infinite' }} />
          جارٍ تحميل التقارير...
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div dir="rtl" style={{ maxWidth: 1100, margin: '0 auto', color: '#1C4532' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 1000, color: '#1C4532' }}>التقارير المالية</div>
          <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 800, marginTop: 4 }}>ملخص الإيرادات وأرباح الرحلات مع تصدير Excel.</div>
        </div>
        <button
          onClick={exportExcel}
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
          <Download size={16} /> تصدير Excel
        </button>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: 16, padding: 12, fontSize: 12, fontWeight: 900, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Plus size={16} color="#C9A84C" />
          <div style={{ fontSize: 16, fontWeight: 1000, color: '#1C4532' }}>إضافة رحلة جديدة</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10 }}>
          <select
            value={newTrip.client_id}
            onChange={(e) => setNewTrip((prev) => ({ ...prev, client_id: e.target.value }))}
            style={{ padding: 10, borderRadius: 12, border: '1.5px solid #E5E0D6', background: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 900, color: '#1C4532', outline: 'none' }}
          >
            <option value="">اختر العميل</option>
            {clients.map((client) => (
              <option key={client.id} value={String(client.id)}>
                {client.name || `عميل #${client.id}`}
              </option>
            ))}
          </select>
          <input
            value={newTrip.destination}
            onChange={(e) => setNewTrip((prev) => ({ ...prev, destination: e.target.value }))}
            placeholder="الوجهة"
            style={{ padding: 10, borderRadius: 12, border: '1.5px solid #E5E0D6', fontFamily: 'inherit', fontSize: 12, fontWeight: 900, color: '#1C4532', outline: 'none', direction: 'rtl' }}
          />
          <input
            type="number"
            value={newTrip.profit}
            onChange={(e) => setNewTrip((prev) => ({ ...prev, profit: e.target.value }))}
            placeholder="المبلغ"
            style={{ padding: 10, borderRadius: 12, border: '1.5px solid #E5E0D6', fontFamily: 'inherit', fontSize: 12, fontWeight: 900, color: '#1C4532', outline: 'none', direction: 'rtl' }}
          />
          <button
            onClick={addTrip}
            disabled={adding}
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: 'linear-gradient(135deg,#8A6B2A,#C9A84C)',
              color: '#1C4532',
              fontSize: 12,
              fontWeight: 1000,
              border: '1px solid rgba(201,168,76,.55)',
              cursor: adding ? 'not-allowed' : 'pointer',
              opacity: adding ? 0.6 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Plus size={14} /> {adding ? 'جارٍ الإضافة...' : 'إضافة رحلة جديدة'}
          </button>
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 1000, marginBottom: 10, color: '#1C4532' }}>ملخص مالي</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
          <div style={{ background: '#F6F4F0', border: '1px solid #E5E0D6', borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 900 }}>إجمالي الإيرادات</div>
            <div style={{ fontSize: 18, fontWeight: 1000, color: '#1C4532', marginTop: 6 }}>{summary.totalRevenue.toLocaleString()} ر.س</div>
          </div>
          <div style={{ background: '#F6F4F0', border: '1px solid #E5E0D6', borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 900 }}>عدد الرحلات</div>
            <div style={{ fontSize: 18, fontWeight: 1000, color: '#1C4532', marginTop: 6 }}>{summary.tripCount}</div>
          </div>
          <div style={{ background: '#F6F4F0', border: '1px solid #E5E0D6', borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 900 }}>متوسط الربح</div>
            <div style={{ fontSize: 18, fontWeight: 1000, color: '#1C4532', marginTop: 6 }}>{summary.avgProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })} ر.س</div>
          </div>
          <div style={{ background: '#F6F4F0', border: '1px solid #E5E0D6', borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 900 }}>أعلى عميل ربحاً</div>
            <div style={{ fontSize: 16, fontWeight: 1000, color: '#1C4532', marginTop: 6 }}>{summary.topClient}</div>
            <div style={{ fontSize: 12, color: '#C9A84C', fontWeight: 1000, marginTop: 4 }}>{summary.topClientProfit.toLocaleString()} ر.س</div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 16, fontWeight: 1000, marginBottom: 10, color: '#1C4532' }}>جدول الرحلات التفصيلي</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
            <thead>
              <tr style={{ background: '#F6F4F0' }}>
                <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #E5E0D6', color: '#1C4532', fontSize: 12 }}>#</th>
                <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #E5E0D6', color: '#1C4532', fontSize: 12 }}>العميل</th>
                <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #E5E0D6', color: '#1C4532', fontSize: 12 }}>الوجهة</th>
                <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #E5E0D6', color: '#1C4532', fontSize: 12 }}>الربح</th>
                <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #E5E0D6', color: '#1C4532', fontSize: 12 }}>تاريخ الرحلة</th>
                <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #E5E0D6', color: '#1C4532', fontSize: 12 }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {normalizedTrips.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#6B7280', fontWeight: 900 }}>
                    لا توجد بيانات رحلات حالياً.
                  </td>
                </tr>
              ) : (
                normalizedTrips.map((trip, index) => (
                  <tr key={trip.id} style={{ borderBottom: '1px solid #F3F0EB' }}>
                    <td style={{ padding: 10, fontSize: 12, color: '#6B7280', fontWeight: 900 }}>{index + 1}</td>
                    <td style={{ padding: 10, fontSize: 12, color: '#1C4532', fontWeight: 900 }}>{trip.clientName}</td>
                    <td style={{ padding: 10 }}>
                      <input
                        value={drafts[trip.id]?.destination || ''}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [trip.id]: { destination: e.target.value, profit: prev[trip.id]?.profit || '' },
                          }))
                        }
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: '1.5px solid #E5E0D6', fontFamily: 'inherit', fontSize: 12, fontWeight: 900, color: '#1C4532', outline: 'none', direction: 'rtl' }}
                      />
                    </td>
                    <td style={{ padding: 10 }}>
                      <input
                        type="number"
                        value={drafts[trip.id]?.profit || ''}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [trip.id]: { destination: prev[trip.id]?.destination || '', profit: e.target.value },
                          }))
                        }
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: '1.5px solid #E5E0D6', fontFamily: 'inherit', fontSize: 12, fontWeight: 900, color: '#1C4532', outline: 'none' }}
                      />
                    </td>
                    <td style={{ padding: 10, fontSize: 12, color: '#1C4532', fontWeight: 900 }}>{trip.trip_date || '—'}</td>
                    <td style={{ padding: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={() => updateTrip(trip.id)}
                          disabled={Boolean(savingIds[trip.id])}
                          style={{
                            padding: '7px 10px',
                            borderRadius: 10,
                            border: '1px solid rgba(201,168,76,.55)',
                            background: '#fff',
                            color: '#1C4532',
                            fontSize: 11,
                            fontWeight: 900,
                            cursor: savingIds[trip.id] ? 'not-allowed' : 'pointer',
                            opacity: savingIds[trip.id] ? 0.6 : 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Save size={13} /> {savingIds[trip.id] ? 'حفظ...' : 'حفظ'}
                        </button>
                        <button
                          onClick={() => deleteTrip(trip.id)}
                          disabled={Boolean(deletingIds[trip.id])}
                          style={{
                            padding: '7px 10px',
                            borderRadius: 10,
                            border: '1px solid #FECACA',
                            background: '#FEF2F2',
                            color: '#991B1B',
                            fontSize: 11,
                            fontWeight: 900,
                            cursor: deletingIds[trip.id] ? 'not-allowed' : 'pointer',
                            opacity: deletingIds[trip.id] ? 0.6 : 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Trash2 size={13} /> {deletingIds[trip.id] ? 'حذف...' : 'حذف'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
