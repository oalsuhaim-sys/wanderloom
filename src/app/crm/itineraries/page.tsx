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
  CopyPlus,
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
import {
  readItineraryExpertDisplayName,
  readItineraryExpertId,
} from '@/lib/itinerary-builder-model'
import { duplicateItineraryAction } from '@/app/actions/itineraryDuplicateActions'
import { getClientAccessToken } from '@/lib/crm-session-token'
import { CRM_CARD_GRID, CRM_FILTER_BAR, CRM_INPUT, crmStatusBadgeClass } from '@/lib/crm-luxury-ui'
import { subscribeCrmRealtimeRefresh } from '@/lib/crm-realtime-events'
import { useRouter } from 'next/navigation'

const STATUS_FILTER = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'draft', label: 'draft' },
  { value: 'sent', label: 'sent' },
  { value: 'active', label: 'active' },
  { value: 'archived', label: 'archived' },
] as const

/** Card / toolbar secondary — light theme (no dark olive) */
const BTN_SECONDARY =
  'flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-200 active:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50'
const BTN_PRIMARY =
  'flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-[#D4AF37] px-3 py-2 text-xs font-bold text-black shadow-sm transition-all hover:bg-[#B8952B] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50'
const BTN_DELETE =
  'flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 shadow-sm transition-all hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50'

function itineraryThemeTags(r: {
  title: string | null
  status: string | null
}): string[] {
  const title = String(r.title ?? '')
  const tags: string[] = []
  if (/vip|في\s*آي\s*بي|في\s*اي\s*بي/i.test(title)) tags.push('VIP')
  if (/عائلي|عائلة|family/i.test(title)) tags.push('عائلي')
  if (/honeymoon|شهر\s*عسل|رومان/i.test(title)) tags.push('رومانسي')
  if (/group|مجموعة|جماع/i.test(title)) tags.push('جماعي')
  const st = String(r.status ?? '').trim()
  if (st) tags.push(st)
  return [...new Set(tags)].slice(0, 4)
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
  customer_name?: string | null
  expert_name?: string | null
  expert_id?: string | null
  quote_id?: string | null
  days_data?: unknown
  flight_details?: unknown
  clients?: { name?: string | null; phone_wa?: string | null } | null
  experts?: { name?: string | null; full_name?: string | null } | null
  itinerary_days?: { id: number }[] | null
}

export default function CRMItinerariesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [pipelineLeads, setPipelineLeads] = useState<CrmLeadWithIntake[]>([])

  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null)
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
    const pipelinePromise = fetchPipelineLeadsByStatuses(
      supabase,
      ITINERARY_PIPELINE_STATUSES,
    )

    // Force-fetch expert fields: * includes expert_name, expert_id, days_data, flight_details.
    // Avoid experts(...) embed as primary — broken FK/relationship kills the whole query.
    const selectAttempts = [
      '*, clients(name, phone_wa), itinerary_days(id)',
      '*, itinerary_days(id)',
      '*',
    ] as const

    let data: Row[] | null = null
    let err: { message?: string } | null = null
    for (const cols of selectAttempts) {
      const res = await supabase
        .from('itineraries')
        .select(cols)
        .order('created_at', { ascending: false })
      if (!res.error) {
        data = (res.data as Row[]) ?? []
        err = null
        break
      }
      err = res.error
      // Keep trying if join/column shape fails
      if (
        !/relationship|embed|clients|itinerary_days|column|schema cache|does not exist|expert/i.test(
          res.error.message ?? '',
        )
      ) {
        break
      }
    }

    setPipelineLeads(await pipelinePromise)

    if (err || !data) {
      setError(err?.message || 'تعذر تحميل المسارات.')
      setRows([])
      setLoading(false)
      return
    }

    let mapped: Row[] = data.map((row) => {
      const resolvedName = readItineraryExpertDisplayName(row)
      const resolvedId = readItineraryExpertId(row)
      return {
        ...row,
        expert_id: resolvedId || row.expert_id || null,
        expert_name: resolvedName || row.expert_name || null,
      }
    })

    const needNames = mapped.filter(
      (r) =>
        Boolean(String(r.expert_id ?? '').trim()) &&
        !String(r.expert_name ?? '').trim(),
    )

    if (needNames.length) {
      const nameById = new Map<string, string>()

      // 1) Browser RLS may block experts — try direct first
      const ids = [
        ...new Set(
          needNames
            .map((r) => String(r.expert_id ?? '').trim())
            .filter(Boolean),
        ),
      ]
      const expertsRes = await supabase
        .from('experts')
        .select('id, name, full_name')
        .in('id', ids)
      if (!expertsRes.error && expertsRes.data?.length) {
        for (const ex of expertsRes.data as Array<Record<string, unknown>>) {
          const id = String(ex.id ?? '').trim()
          const name =
            String(ex.name ?? '').trim() || String(ex.full_name ?? '').trim()
          if (id && name) nameById.set(id, name)
        }
      }

      // 2) Service-role API (same source as builder dropdown)
      if ([...needNames].some((r) => !nameById.has(String(r.expert_id)))) {
        try {
          const token = await getClientAccessToken()
          const apiRes = await fetch('/api/crm/experts', {
            cache: 'no-store',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          })
          const payload = (await apiRes.json()) as {
            ok?: boolean
            rows?: Array<{ id?: string; name?: string }>
          }
          if (payload.ok && Array.isArray(payload.rows)) {
            for (const ex of payload.rows) {
              const id = String(ex.id ?? '').trim()
              const name = String(ex.name ?? '').trim()
              if (id && name) nameById.set(id, name)
            }
          }
        } catch {
          /* optional enrich */
        }
      }

      mapped = mapped.map((r) => {
        if (String(r.expert_name ?? '').trim()) return r
        const n = r.expert_id ? nameById.get(String(r.expert_id)) : ''
        return n ? { ...r, expert_name: n } : r
      })
    }

    setRows(mapped)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return subscribeCrmRealtimeRefresh((detail) => {
      if (
        detail.source === 'itineraries' ||
        detail.source === 'quotations' ||
        detail.reason === 'approved' ||
        detail.reason === 'from_quote_approval'
      ) {
        void load()
      }
    })
  }, [load])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return rows.filter((r) => {
      const okStatus = status === 'all' ? true : String(r?.status || '') === status
      if (!okStatus) return false
      if (!query) return true
      const clientName = String(r.customer_name ?? '').trim() || r?.clients?.name || ''
      const expertName = readItineraryExpertDisplayName(r)
      const blob = `${r?.title || ''} ${r?.passcode || ''} ${clientName} ${expertName}`.toLowerCase()
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

  const duplicateItinerary = async (row: Row) => {
    if (!row.id) return
    if (
      !window.confirm(
        `إنشاء نسخة جديدة من «${row.title || row.id}»؟\nالمسار الأصلي لن يتأثر.`,
      )
    ) {
      return
    }
    setDuplicatingId(row.id)
    setError('')
    setMagicToast('جاري استنساخ الرحلة بكل تفاصيلها...')
    try {
      const token = await getClientAccessToken()
      const result = await duplicateItineraryAction(row.id, token)
      if (!result.ok) {
        setError(result.error)
        setMagicToast(null)
        return
      }
      setMagicToast(`تم إنشاء النسخة: ${result.title}`)
      router.push(`/crm/itineraries/${result.newId}/edit`)
    } catch (err) {
      console.error(err)
      setError('تعذر استنساخ المسار.')
      setMagicToast(null)
    } finally {
      setDuplicatingId(null)
    }
  }

  if (loading) {
    return (
      <div
        dir="rtl"
        className="flex min-h-[70vh] items-center justify-center bg-[#F9FAFB] dark:bg-slate-50"
      >
        <div className="text-center text-sm font-semibold text-slate-500">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-[#D4AF37]" aria-hidden />
          جارٍ تحميل المسارات...
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="mx-auto max-w-7xl bg-[#F9FAFB] dark:bg-slate-50">
      <FeaturesAchievementsModal open={showAchievementsModal} onClose={() => setShowAchievementsModal(false)} />

      {magicToast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[200] w-[min(100%,22rem)] -translate-x-1/2 rounded-2xl border border-slate-200 bg-slate-900 px-5 py-4 text-center shadow-2xl dark:border-[#D4AF37]/40 dark:bg-slate-50"
        >
          <p className="text-sm font-semibold leading-relaxed text-white dark:text-[#D4AF37]">
            {magicToast}
          </p>
        </div>
      ) : null}

      {pipelineLeads.length > 0 ? (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-200 dark:bg-slate-50">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-500">
            طابور المسار — تجهيز المسار / تم التسليم ({pipelineLeads.length})
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {pipelineLeads.map((lead) => (
              <li
                key={lead.id}
                className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-right dark:border-slate-200 dark:bg-slate-50"
              >
                <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-800">
                  {lead.full_name}
                </p>
                <p className="text-[10px] font-medium text-slate-500">
                  {joinDestinations(lead.destinations)} · {lead.status}
                </p>
                {lead.client_id != null ? (
                  <Link
                    href={`/crm/itineraries/builder?clientId=${lead.client_id}`}
                    className="mt-2 inline-flex text-[10px] font-semibold text-slate-700 underline dark:text-[#D4AF37]"
                  >
                    بناء مسار للعميل
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-[#D4AF37]/80">
            Routes
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-800">المسارات</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">
            كتالوج مسارات السفر الفاخرة والبوابة VIP
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setShowAchievementsModal(true)}
            className={BTN_SECONDARY + ' px-4'}
          >
            <Award className="h-4 w-4 text-[#b8952d]" aria-hidden />
            دليل ميزات النظام
          </button>
          <Link href="/crm/itineraries/builder" className={BTN_PRIMARY + ' no-underline px-4'}>
            <Plus className="h-4 w-4" aria-hidden /> مسار جديد
          </Link>
        </div>
      </header>

      {error ? (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-200 dark:bg-slate-50">
        <div className={CRM_FILTER_BAR}>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <Search className="h-4 w-4 shrink-0 text-slate-500 dark:text-[#D4AF37]/80" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث بالعنوان أو passcode أو اسم العميل أو الخبير..."
              className={CRM_INPUT}
            />
          </div>
          <div className="w-full sm:w-auto sm:min-w-[12rem]">
            <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Filter className="h-3.5 w-3.5" aria-hidden /> الحالة
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={CRM_INPUT}
            >
              {STATUS_FILTER.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-3 text-xs font-medium text-slate-500">النتائج: {filtered.length}</p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-medium text-slate-500 dark:border-slate-200 dark:bg-slate-50">
          لا توجد مسارات.
        </div>
      ) : (
        <div className={`crm-stagger ${CRM_CARD_GRID}`}>
          {filtered.map((r) => {
            const clientName =
              String(r.customer_name ?? '').trim() || r?.clients?.name || '—'
            const expertName =
              readItineraryExpertDisplayName(r) ||
              String(r.expert_name ?? '').trim() ||
              '—'
            const dayCount = Array.isArray(r.itinerary_days) ? r.itinerary_days.length : 0
            const pc = resolveItineraryPortalPin(r) || r.passcode || ''
            const portalSlug = r.id != null ? String(r.id) : ''
            const st = String(r.status || 'active')
            const busy = busyId === r.id
            const bypassBusy = bypassBusyId === r.id
            const bypassUnlocked = parseBypass24hLock(r.bypass_24h_lock)
            const tags = itineraryThemeTags(r)

            return (
              <article
                key={r.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-200 dark:bg-slate-50"
              >
                <div className="flex h-32 items-end rounded-t-xl bg-gradient-to-r from-slate-800 to-slate-900 p-4 dark:from-[#1A2421] dark:to-[#22302C]">
                  <div className="flex items-center gap-2 text-slate-800">
                    <Route className="h-5 w-5 text-[#D4AF37]" aria-hidden />
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${crmStatusBadgeClass(st)}`}>
                      {st || 'active'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-5">
                  <h2 className="line-clamp-2 text-lg font-bold text-slate-900 dark:text-slate-800">
                    {r.title || 'بدون عنوان'}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-500">
                    {dayCount > 0 ? `${dayCount} يوم` : 'المدة غير محددة'}
                    {' · '}
                    {r.dates || 'بدون تواريخ'}
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    {clientName} · خبير: {expertName}
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:bg-slate-50 dark:text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                    {pc ? (
                      <span className="rounded-md bg-slate-50 px-2 py-1 font-mono text-xs text-slate-600 dark:bg-slate-50 dark:text-slate-600">
                        PIN {pc}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3">
                    <Link href={`/crm/itineraries/${r.id}/edit`} className={BTN_PRIMARY}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      تعديل
                    </Link>
                    <button
                      type="button"
                      onClick={() => shareWhatsApp(r)}
                      disabled={busy || !pc}
                      className={BTN_SECONDARY}
                      title="مشاركة واتساب"
                    >
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                      واتساب
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyPortalLink(r)}
                      disabled={busy || !portalSlug}
                      className={BTN_SECONDARY}
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      رابط
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleStatus(r)}
                      disabled={busy}
                      className={BTN_SECONDARY}
                    >
                      <Power className="h-3.5 w-3.5" aria-hidden />
                      {st === 'archived' ? 'تفعيل' : 'إيقاف'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleBypassLock(r)}
                      disabled={busy || bypassBusy}
                      className={BTN_SECONDARY}
                      title={bypassUnlocked ? 'قفل المسار' : 'فتح المسار'}
                    >
                      {bypassBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : bypassUnlocked ? (
                        <Lock className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Unlock className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {bypassUnlocked ? 'قفل' : 'فتح'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void duplicateItinerary(r)}
                      disabled={busy || duplicatingId === r.id}
                      className={BTN_SECONDARY}
                    >
                      {duplicatingId === r.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <CopyPlus className="h-3.5 w-3.5" aria-hidden />
                      )}
                      نسخ
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyPasscode(pc)}
                      disabled={!pc}
                      className={BTN_SECONDARY}
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      PIN
                    </button>
                    <a href="/portal" target="_blank" rel="noreferrer" className={BTN_SECONDARY}>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      بوابة
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
                        className={BTN_SECONDARY}
                      >
                        <Link2 className="h-3.5 w-3.5" aria-hidden />
                        معاينة
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void deleteItinerary(r)}
                      disabled={busy}
                      className={BTN_DELETE}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      حذف
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
