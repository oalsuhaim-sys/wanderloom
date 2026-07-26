'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  fetchPipelineLeadsByStatuses,
  joinDestinations,
  type CrmLeadWithIntake,
} from '@/lib/crm-leads'
import { ITINERARY_PIPELINE_STATUSES } from '@/lib/leads-kanban'
import { setLeadPipelineStatus } from '@/lib/lead-pipeline-automation'
import {
  Award,
  Copy,
  ExternalLink,
  Filter,
  Link2,
  Loader2,
  Lock,
  MessageCircle,
  Pencil,
  Plus,
  Power,
  Route,
  Search,
  Trash2,
  Unlock,
} from 'lucide-react'

import {
  openVipPortalWhatsAppShare,
  resolveItineraryPortalPin,
} from '@/lib/vip-portal-share'

import { FeaturesAchievementsModal } from '@/app/crm/itineraries/_components/FeaturesAchievementsModal'
import { parseBypass24hLock } from '@/lib/vip-vault-reveal'
import { buildItineraryPortalPath, copyItineraryPortalUrl } from '@/lib/itinerary-client-crm'

const STATUS_FILTER = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'draft', label: 'draft' },
  { value: 'sent', label: 'sent' },
  { value: 'active', label: 'active' },
  { value: 'archived', label: 'archived' },
] as const

const BTN_BASE =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold leading-none transition whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-xs'
const BTN_WHITE = `${BTN_BASE} border border-gray-200 bg-white text-gray-700 hover:bg-gray-50`
const BTN_GOLD = `${BTN_BASE} border border-[#cda04c] bg-[#cda04c] font-bold text-white hover:bg-[#b3893d]`
const BTN_PORTAL = `${BTN_BASE} border border-[#1C4532] bg-[#1C4532] font-bold text-white hover:bg-[#163828]`
const BTN_DELETE = `${BTN_BASE} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`

function statusBadgeClass(st: string): string {
  const s = st.trim().toLowerCase()
  if (s === 'archived' || s === 'cancelled') return 'bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold'
  if (s === 'draft' || s === 'pending' || s === 'sent') {
    return 'bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold'
  }
  if (s === 'confirmed' || s === 'active' || s === 'completed' || s === 'approved') {
    return 'bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold'
  }
  return 'bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-bold'
}

type Row = {
  id: number
  client_id?: number | null
  title: string | null
  dates: string | null
  passcode: string | null
  magic_link_id?: string | null
  status: string | null
  bypass_24h_lock?: boolean | null
  clients?: { name?: string | null; phone_wa?: string | null } | null
  itinerary_days?: { id: number }[] | null
}

export default function CRMItinerariesPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [pipelineLeads, setPipelineLeads] = useState<CrmLeadWithIntake[]>([])

  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [bypassBusyId, setBypassBusyId] = useState<number | null>(null)
  const [showAchievementsModal, setShowAchievementsModal] = useState(false)
  const [magicToast, setMagicToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    if (!supabase) {
      setError('Supabase غير متصل. تأكد من إعداد NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY.')
      setLoading(false)
      return
    }

    setLoading(true)
    const [itinerariesRes, pipeline] = await Promise.all([
      supabase
        .from('itineraries')
        .select(
          'id, client_id, title, dates, passcode, magic_link_id, status, bypass_24h_lock, created_at, clients(name, phone_wa), itinerary_days(id)',
        )
        .order('created_at', { ascending: false }),
      fetchPipelineLeadsByStatuses(supabase, ITINERARY_PIPELINE_STATUSES),
    ])

    setPipelineLeads(pipeline)

    const { data, error: err } = itinerariesRes

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

  const toggleBypassLock = async (row: Row) => {
    if (!supabase || !row?.id) return
    const current = parseBypass24hLock(row.bypass_24h_lock)
    const next = !current
    setBypassBusyId(row.id)
    setError('')
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, bypass_24h_lock: next } : r)),
    )
    const { error: err } = await supabase
      .from('itineraries')
      .update({ bypass_24h_lock: next })
      .eq('id', row.id)
    if (err) {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, bypass_24h_lock: current } : r)),
      )
      const msg = err.message ?? ''
      if (/bypass_24h_lock|column|schema cache|does not exist/i.test(msg)) {
        setError('عمود bypass_24h_lock غير موجود. نفّذ supabase/sql/itineraries_bypass_24h_lock.sql')
      } else {
        setError(msg || 'تعذر تحديث قفل المسار.')
      }
    } else {
      setMagicToast(
        next
          ? 'تم فتح المسار للعميل فوراً — يتجاوز قفل 24 ساعة ✨'
          : 'تم تفعيل قفل 24 ساعة للعميل 🔒',
      )
    }
    setBypassBusyId(null)
  }

  const toggleStatus = async (row: Row) => {
    if (!supabase || !row?.id) return
    const next = String(row.status || '') === 'archived' ? 'active' : 'archived'
    setBusyId(row.id)
    setError('')
    const { error: err } = await supabase.from('itineraries').update({ status: next }).eq('id', row.id)
    if (err) setError(err.message || 'تعذر تغيير الحالة.')
    if (!err && next === 'active' && row.client_id != null) {
      await setLeadPipelineStatus(
        supabase,
        { clientId: row.client_id, force: true },
        'delivered',
      ).catch(() => undefined)
    }
    await load()
    setBusyId(null)
  }

  const copyPasscode = async (pc: string) => {
    if (!pc) return
    await navigator.clipboard.writeText(pc)
  }

  const copyPortalLink = async (row: Row) => {
    const tripId = row.id != null ? String(row.id).trim() : '';
    if (!tripId) {
      setError('لا يوجد معرّف للمسار — احفظ المسار أولاً.')
      return
    }

    const result = await copyItineraryPortalUrl({
      itinerarySlug: tripId,
      clientId: row.client_id,
      itineraryId: tripId,
    })

    if (!result.ok) {
      setError(result.error)
      return
    }

    setMagicToast(
      result.url.includes('trip_id=')
        ? 'تم نسخ رابط المسار مع trip_id ✨'
        : 'تم نسخ رابط المسار ✨',
    )
  }

  const shareWhatsApp = (row: Row) => {
    const passcode = resolveItineraryPortalPin(row)
    if (!passcode) {
      setError('لا يوجد passcode — أضفه من تعديل المسار.')
      return
    }
    const opened = openVipPortalWhatsAppShare({
      passcode: row.passcode,
      phone_wa: row.clients?.phone_wa,
    })
    if (opened) {
      setMagicToast('تم فتح واتساب برسالة البوابة الآمنة ومفتاح الرحلة ✨')
    }
  }

  useEffect(() => {
    if (!magicToast) return
    const t = window.setTimeout(() => setMagicToast(null), 4200)
    return () => window.clearTimeout(t)
  }, [magicToast])

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
    <div dir="rtl" className="mx-auto max-w-[1100px]">
      <FeaturesAchievementsModal open={showAchievementsModal} onClose={() => setShowAchievementsModal(false)} />

      {magicToast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[200] w-[min(100%,22rem)] -translate-x-1/2 rounded-2xl border border-[#C5A059]/45 bg-[#1A3B2A] px-5 py-4 text-center shadow-2xl wl-magic-toast-in"
        >
          <p className="text-sm font-black leading-relaxed text-[#F9F9F6]">{magicToast}</p>
        </div>
      ) : null}

      {pipelineLeads.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
          <p className="text-xs font-black text-violet-900">
            طابور المسار — تجهيز المسار / تم التسليم ({pipelineLeads.length})
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {pipelineLeads.map((lead) => (
              <li
                key={lead.id}
                className="rounded-xl border border-white bg-white px-3 py-2.5 text-right shadow-sm"
              >
                <p className="truncate text-sm font-black text-[#1C4532]">{lead.full_name}</p>
                <p className="text-[10px] font-bold text-slate-500">
                  {joinDestinations(lead.destinations)} · {lead.status}
                </p>
                {lead.client_id != null ? (
                  <Link
                    href={`/crm/itineraries/builder?clientId=${lead.client_id}`}
                    className="mt-2 inline-flex text-[10px] font-black text-violet-800 underline"
                  >
                    بناء مسار للعميل
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <style>{`
        @keyframes wl-magic-toast-in {
          from { opacity: 0; transform: translate(-50%, 12px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .wl-magic-toast-in {
          animation: wl-magic-toast-in 0.35s ease-out forwards;
        }
      `}</style>

      <div className="mb-3 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between md:mb-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#C5A059]">Routes</p>
          <div className="text-lg font-black text-[#1A3B2A] sm:text-xl md:text-[22px]">مركز قيادة المسارات</div>
          <div className="mt-1 text-xs font-extrabold text-gray-500 sm:text-sm">إدارة المسارات والرابط السحري VIP</div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => setShowAchievementsModal(true)}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#C5A059]/35 bg-white px-4 py-2.5 text-xs font-black text-[#1A3B2A] transition hover:bg-[#F9F9F6] sm:w-auto sm:text-sm"
          >
            <Award size={16} color="#C5A059" />
            دليل ميزات النظام
          </button>
          <Link
            href="/crm/itineraries/builder"
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#1A3B2A] px-4 py-2.5 text-xs font-black text-white no-underline transition hover:bg-[#152e21] sm:w-auto sm:text-sm"
          >
            <Plus size={16} className="text-[#C5A059]" /> مسار جديد +
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-black text-red-800 sm:mb-4 sm:p-4 sm:text-sm">
          {error}
        </div>
      )}

      <div className="mb-3.5 rounded-2xl border border-[#F3F0EB] bg-white p-4 shadow-sm sm:mb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_0.8fr] md:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Search size={16} color="#C9A84C" className="shrink-0" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث بالعنوان أو passcode أو اسم العميل..."
              className="w-full rounded-lg border border-gray-200 bg-white p-3 text-[13px] font-semibold text-[#1A3B2A] outline-none transition-all [direction:rtl] placeholder:text-gray-400 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/50"
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold text-slate-600 sm:text-xs">
              <Filter size={14} aria-hidden /> الحالة
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white p-3 text-xs font-semibold text-[#1A3B2A] outline-none transition-all focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/50 sm:text-sm"
            >
              {STATUS_FILTER.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-2.5 text-xs font-black text-gray-500 sm:mt-3 sm:text-sm">النتائج: {filtered.length}</div>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-xs font-bold text-gray-400">
            لا توجد مسارات.
          </div>
        ) : (
          filtered.map((r) => {
            const clientName = r?.clients?.name || '—'
            const dayCount = Array.isArray(r.itinerary_days) ? r.itinerary_days.length : 0
            const pc = resolveItineraryPortalPin(r) || r.passcode || ''
            const portalSlug = r.id != null ? String(r.id) : ''
            const st = String(r.status || 'active')
            const busy = busyId === r.id
            const bypassBusy = bypassBusyId === r.id
            const bypassUnlocked = parseBypass24hLock(r.bypass_24h_lock)

            return (
              <div
                key={r.id}
                className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(0,0,0,0.05)] sm:p-5 xl:flex-row xl:items-center xl:justify-between"
              >
                <div className="flex w-full min-w-0 flex-col gap-2 xl:w-auto">
                  <div className="flex flex-wrap items-center gap-2 text-lg font-bold text-[#1A3B2A]">
                    <Route className="h-5 w-5 shrink-0 text-[#C5A059]" aria-hidden />
                    <span className="truncate">{r.title || 'بدون عنوان'}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span>👤 {clientName}</span>
                    <span>📅 {r.dates || '—'}</span>
                    <span>🗓️ {dayCount} يوم</span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span
                      className={statusBadgeClass(st)}
                    >
                      {st || 'active'}
                    </span>
                    {pc ? (
                      <span className="rounded bg-gray-100 px-2 py-1 font-mono text-[10px] font-bold tracking-wider text-gray-700">
                        {pc}
                      </span>
                    ) : (
                      <span className="rounded bg-gray-50 px-2 py-1 text-[10px] font-bold text-gray-400">
                        بدون passcode
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex w-full flex-wrap items-center gap-1.5 sm:justify-end xl:w-auto">
                  <button
                    type="button"
                    onClick={() => shareWhatsApp(r)}
                    disabled={busy || !pc}
                    title="مشاركة البوابة الآمنة عبر واتساب"
                    className={BTN_GOLD}
                  >
                    <MessageCircle className="h-3 w-3 shrink-0" aria-hidden />
                    مشاركة واتساب
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleStatus(r)}
                    disabled={busy}
                    className={BTN_WHITE}
                  >
                    <Power className="h-3 w-3 shrink-0" aria-hidden />
                    {st === 'archived' ? 'تفعيل' : 'إيقاف'}
                  </button>

                  <button
                    type="button"
                    onClick={() => void toggleBypassLock(r)}
                    disabled={busy || bypassBusy}
                    title={
                      bypassUnlocked
                        ? 'إعادة قفل 24 ساعة للعميل'
                        : 'فتح المسار للعميل فوراً (تجاوز القفل)'
                    }
                    className={`${BTN_WHITE}${bypassUnlocked ? ' border-[#1C4532] text-[#1C4532]' : ''}`}
                  >
                    {bypassBusy ? (
                      <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
                    ) : bypassUnlocked ? (
                      <Lock className="h-3 w-3 shrink-0" aria-hidden />
                    ) : (
                      <Unlock className="h-3 w-3 shrink-0" aria-hidden />
                    )}
                    {bypassUnlocked ? 'قفل المسار' : 'فتح المسار'}
                  </button>

                  <Link href={`/crm/itineraries/${r.id}/edit`} className={BTN_WHITE}>
                    <Pencil className="h-3 w-3 shrink-0" aria-hidden />
                    تعديل
                  </Link>

                  <button
                    type="button"
                    onClick={() => void deleteItinerary(r)}
                    disabled={busy}
                    className={BTN_DELETE}
                  >
                    <Trash2 className="h-3 w-3 shrink-0" aria-hidden />
                    حذف
                  </button>

                  <button
                    type="button"
                    onClick={() => void copyPortalLink(r)}
                    disabled={busy || !portalSlug}
                    title="نسخ رابط المسار للعميل (مع trip_id)"
                    className={BTN_GOLD}
                  >
                    <Copy className="h-3 w-3 shrink-0" aria-hidden />
                    نسخ الرابط
                  </button>

                  <button
                    type="button"
                    onClick={() => void copyPasscode(pc)}
                    disabled={!pc}
                    className={BTN_WHITE}
                  >
                    <Copy className="h-3 w-3 shrink-0" aria-hidden />
                    نسخ PIN
                  </button>

                  <a href="/portal" target="_blank" rel="noreferrer" className={BTN_PORTAL}>
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                    البوابة
                  </a>

                  {portalSlug ? (
                    <a
                      href={buildItineraryPortalPath({
                        itinerarySlug: portalSlug,
                        clientId: r.client_id,
                        itineraryId: r.id,
                      })}
                      target="_blank"
                      rel="noreferrer"
                      title="معاينة داخلية للموظفين فقط"
                      className={BTN_WHITE}
                    >
                      <Link2 className="h-3 w-3 shrink-0" aria-hidden />
                      معاينة
                    </a>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
