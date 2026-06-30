'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
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

const STATUS_FILTER = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'draft', label: 'draft' },
  { value: 'sent', label: 'sent' },
  { value: 'active', label: 'active' },
  { value: 'archived', label: 'archived' },
] as const

const BTN_BASE =
  'flex min-h-10 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed sm:text-sm'
const BTN_WHITE = `${BTN_BASE} bg-white border border-gray-200 text-gray-700 hover:bg-gray-50`
const BTN_GOLD = `${BTN_BASE} font-bold bg-[#cda04c] text-white hover:bg-[#b3893d] border border-[#cda04c] transition-colors`
const BTN_PORTAL = `${BTN_BASE} font-bold bg-[#1C4532] text-white hover:bg-[#163828] border border-[#1C4532]`
const BTN_DELETE = `${BTN_BASE} bg-red-50 border border-red-200 text-red-700 hover:bg-red-100`

function statusBadgeClass(st: string): string {
  if (st === 'archived') return 'bg-red-100 text-red-700'
  if (st === 'draft') return 'bg-amber-100 text-amber-800'
  if (st.toLowerCase() === 'confirmed' || st === 'sent') return 'bg-amber-100 text-amber-800'
  return 'bg-green-100 text-green-700'
}

type Row = {
  id: number
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
    const { data, error: err } = await supabase
      .from('itineraries')
      .select(
        'id, client_id, title, dates, passcode, magic_link_id, status, bypass_24h_lock, created_at, clients(name, phone_wa), itinerary_days(id)',
      )
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
    await load()
    setBusyId(null)
  }

  const copyPasscode = async (pc: string) => {
    if (!pc) return
    await navigator.clipboard.writeText(pc)
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
    <div dir="rtl" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <FeaturesAchievementsModal open={showAchievementsModal} onClose={() => setShowAchievementsModal(false)} />

      {magicToast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[200] w-[min(100%,22rem)] -translate-x-1/2 rounded-2xl border border-[#d4af37]/45 bg-gradient-to-br from-[#001f3f] via-[#0a1830] to-[#001f3f] px-5 py-4 text-center shadow-[0_20px_60px_rgba(0,31,63,0.55)] ring-1 ring-[#d4af37]/25 backdrop-blur-md wl-magic-toast-in"
        >
          <p className="text-sm font-black leading-relaxed text-[#f5e6c8]">{magicToast}</p>
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
          <div className="text-lg font-black text-[#1C4532] sm:text-xl md:text-[22px]">مركز قيادة المسارات ✈️</div>
          <div className="mt-1 text-xs font-extrabold text-gray-500 sm:text-sm">إدارة المسارات والرابط السحري VIP</div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => setShowAchievementsModal(true)}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[14px] border border-[#C9A84C]/45 bg-gradient-to-br from-[#0f1c35] to-[#060b14] px-4 py-2.5 text-xs font-black text-[#F5E6C8] sm:w-auto sm:text-sm"
          >
            <Award size={16} color="#C9A84C" />
            دليل ميزات النظام 🏆
          </button>
          <Link
            href="/crm/itineraries/builder"
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[14px] border border-[#C9A84C]/55 bg-gradient-to-br from-[#8A6B2A] to-[#C9A84C] px-4 py-2.5 text-xs font-black text-[#1C4532] no-underline sm:w-auto sm:text-sm"
          >
            <Plus size={16} /> مسار جديد +
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
              className="w-full rounded-xl border border-gray-400 bg-white p-3 text-[13px] font-black text-gray-900 outline-none [direction:rtl] placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold text-slate-600 sm:text-xs">
              <Filter size={14} aria-hidden /> الحالة
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-gray-400 bg-white p-3 text-xs font-black text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
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
            const portalSlug = r.magic_link_id || String(r.id)
            const st = String(r.status || 'active')
            const busy = busyId === r.id
            const bypassBusy = bypassBusyId === r.id
            const bypassUnlocked = parseBypass24hLock(r.bypass_24h_lock)

            return (
              <div
                key={r.id}
                className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5 xl:flex-row xl:items-center xl:justify-between"
              >
                <div className="flex w-full min-w-0 flex-col gap-2 xl:w-auto">
                  <div className="flex flex-wrap items-center gap-2 text-lg font-bold text-gray-800">
                    <Route className="h-5 w-5 shrink-0 text-[#C9A84C]" aria-hidden />
                    <span className="truncate">{r.title || 'بدون عنوان'}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span>👤 {clientName}</span>
                    <span>📅 {r.dates || '—'}</span>
                    <span>🗓️ {dayCount} يوم</span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-2 py-1 text-[10px] font-bold ${statusBadgeClass(st)}`}
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

                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end xl:w-auto">
                  <button
                    type="button"
                    onClick={() => shareWhatsApp(r)}
                    disabled={busy || !pc}
                    title="مشاركة البوابة الآمنة عبر واتساب"
                    className={BTN_GOLD}
                  >
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                    مشاركة واتساب
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleStatus(r)}
                    disabled={busy}
                    className={BTN_WHITE}
                  >
                    <Power className="h-3.5 w-3.5" aria-hidden />
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
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : bypassUnlocked ? (
                      <Lock className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Unlock className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {bypassUnlocked ? 'قفل المسار' : 'فتح المسار'}
                  </button>

                  <Link href={`/crm/itineraries/${r.id}/edit`} className={BTN_WHITE}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    تعديل
                  </Link>

                  <button
                    type="button"
                    onClick={() => void deleteItinerary(r)}
                    disabled={busy}
                    className={BTN_DELETE}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    حذف
                  </button>

                  <button
                    type="button"
                    onClick={() => void copyPasscode(pc)}
                    disabled={!pc}
                    className={BTN_WHITE}
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    نسخ
                  </button>

                  <a href="/portal" target="_blank" rel="noreferrer" className={BTN_PORTAL}>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    البوابة
                  </a>

                  {portalSlug ? (
                    <a
                      href={`/itinerary/${encodeURIComponent(portalSlug)}`}
                      target="_blank"
                      rel="noreferrer"
                      title="معاينة داخلية للموظفين فقط"
                      className={BTN_WHITE}
                    >
                      <Link2 className="h-3.5 w-3.5" aria-hidden />
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
