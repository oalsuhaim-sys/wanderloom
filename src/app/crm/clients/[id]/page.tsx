'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { fetchUnifiedClientTrips, sumUnifiedTripProfit, type UnifiedTripRow } from '@/lib/client-trips-crm'
import { clientDnaSupabasePatch } from '@/lib/client-dna-columns'
import { parseTravelDnaFromClient, serializeTravelDna, buildReferralCodeUpdatePayload, clientDnaAdvancedPayload, isInfluencerClient, isLeaderClient, resolveClientTargetTrip, type ClientDnaAdvancedFields } from '@/lib/clientsTravelDna'
import ClientDnaAdvancedDisplay from '@/app/crm/clients/_components/ClientDnaAdvancedDisplay'
import ClientDnaAdvancedFieldsEditor from '@/app/crm/clients/_components/ClientDnaAdvancedFieldsEditor'
import ClientDnaSmartEventRecommendations from '@/app/crm/clients/_components/ClientDnaSmartEventRecommendations'
import ClientPaymentWhatsAppButton from '@/app/crm/clients/_components/ClientPaymentWhatsAppButton'
import ClientSalesStageControl from '@/app/crm/clients/_components/ClientSalesStageControl'
import ClientTargetTripBadge from '@/app/crm/clients/_components/ClientTargetTripBadge'
import { formatBirthdayDisplayDate } from '@/lib/birthday-radar'
import ClientWalletLedgerCard from '@/app/crm/clients/_components/ClientWalletLedgerCard';
import ReferralQrCard from '@/app/crm/clients/_components/ReferralQrCard';
import VipSpendingTierBadge from '@/components/VipSpendingTierBadge';
import {
  formatWalletAmount,
  parseWalletBalance,
} from '@/lib/vip-wallet-ledger';
import {
  ensureClientOnboardingToken,
} from '@/lib/client-onboarding';
import { launchClientTrip } from '@/lib/client-trip-launch';
import {
  ArrowRight,
  Phone,
  Mail,
  Pencil,
  Trash2,
  Save,
  X,
  Plus,
  MessageCircle,
  PhoneCall,
  Gift,
  Plane,
  Sparkles,
  Loader2,
  UsersRound,
  Wallet,
  Link2,
} from 'lucide-react'

type UnifiedTrip = UnifiedTripRow

type JoinedGroupRow = {
  id: number
  displayName: string
  title: string | null
  group_name: string | null
}

function clientQuickStatNum(value: unknown): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function formatPassportExpiryForInput(raw: unknown): string {
  if (raw == null || raw === '') return ''
  const s = String(raw).trim()
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  if (iso) return iso[1]
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return s.slice(0, 10)
}

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.id as string

  const [client, setClient] = useState<any>(null)
  const [trips, setTrips] = useState<UnifiedTrip[]>([])
  const [tripCount, setTripCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [editingCode, setEditingCode] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [codeCount, setCodeCount] = useState(0)
  const [editingTrip, setEditingTrip] = useState<string | null>(null)
  const [editTripData, setEditTripData] = useState({ destination: '', cost: 0, trip_date: '' })
  const [showLaunchTripModal, setShowLaunchTripModal] = useState(false)
  const [launchTripForm, setLaunchTripForm] = useState({
    destination: '',
    start_date: '',
    end_date: '',
    expected_profit: '',
  })
  const [launchTripSaving, setLaunchTripSaving] = useState(false)
  const [launchTripNotice, setLaunchTripNotice] = useState<string | null>(null)
  const [launchTripSuccess, setLaunchTripSuccess] = useState<string | null>(null)
  const [passportExpiry, setPassportExpiry] = useState('')
  const [tripNotice, setTripNotice] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)

  const [travelDnaForm, setTravelDnaForm] = useState({
    preferred_seat: '',
    food_allergies: '',
    hotel_style: '',
    drink_coffee: '',
  })
  const [dnaAdvancedForm, setDnaAdvancedForm] = useState<ClientDnaAdvancedFields>({
    dna_interests: '',
    dna_special_requests: '',
    dna_activity_level: '',
  })
  const [savingTravelDna, setSavingTravelDna] = useState(false)

  const [joinedGroups, setJoinedGroups] = useState<JoinedGroupRow[]>([])
  const [copyingOnboardingLink, setCopyingOnboardingLink] = useState(false)
  const [deletingClient, setDeletingClient] = useState(false)

  const loadTrips = useCallback(async () => {
    const rows = await fetchUnifiedClientTrips(clientId)
    setTrips(rows)
    setTripCount(rows.length)
    return rows
  }, [clientId])

  const load = async () => {
    setLoadError(null)
    if (!supabase) {
      setLoadError('قاعدة البيانات غير مهيأة. أضف مفاتيح Supabase في البيئة.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const idNum = Number(clientId)
      const clientKey = Number.isFinite(idNum) ? idNum : clientId
      const { data: c, error: cErr } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientKey)
        .single()
      if (cErr) {
        setClient(null)
        if (cErr.code === 'PGRST116') {
          setLoadError(null)
        } else {
          setLoadError(cErr.message || 'تعذر تحميل بيانات العميل.')
        }
        setJoinedGroups([])
        return
      }

      const tripRows = await loadTrips()

      if (c) {
        const normalizedClient = {
          ...c,
          total_profit: clientQuickStatNum(c.total_profit),
          total_spent: clientQuickStatNum(c.total_spent),
          wallet_balance: clientQuickStatNum(c.wallet_balance),
          vip_tier: String(c.vip_tier ?? 'gold').trim().toLowerCase(),
        }
        setClient(normalizedClient)
        setTravelDnaForm(parseTravelDnaFromClient(normalizedClient))
        setDnaAdvancedForm({
          dna_interests: String(c.dna_interests ?? ''),
          dna_special_requests: String(c.dna_special_requests ?? ''),
          dna_activity_level: String(c.dna_activity_level ?? ''),
        })
        setPassportExpiry(formatPassportExpiryForInput(c.passport_expiry))
        setNewCode(c.ref_code || c.referral_code || '')
      } else {
        setClient(null)
        setTravelDnaForm({
          preferred_seat: '',
          food_allergies: '',
          hotel_style: '',
          drink_coffee: '',
        })
        setDnaAdvancedForm({
          dna_interests: '',
          dna_special_requests: '',
          dna_activity_level: '',
        })
        setPassportExpiry('')
      }

      if (Number.isFinite(idNum)) {
        const { count: itineraryCount } = await supabase
          .from('itineraries')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', idNum)
          .or('is_template.is.null,is_template.eq.false')
        setTripCount(tripRows.length + (itineraryCount ?? 0))
      }

      if (Number.isFinite(idNum)) {
        const seen = new Map<number, JoinedGroupRow>()
        const mem = await supabase
          .from('itinerary_client_members')
          .select('itinerary_id, itineraries ( id, title, group_name, trip_type, is_template )')
          .eq('client_id', idNum)
        if (!mem.error && mem.data) {
          for (const row of mem.data as unknown as { itineraries: unknown }[]) {
            const rawIt = row.itineraries
            const it = (Array.isArray(rawIt) ? rawIt[0] : rawIt) as {
              id: number
              title: string | null
              group_name: string | null
              trip_type: string | null
              is_template: boolean | null
            } | null
            if (!it || it.is_template === true) continue
            if (String(it.trip_type ?? '').trim().toLowerCase() !== 'group') continue
            const displayName = it.group_name?.trim() || it.title?.trim() || `قروب #${it.id}`
            seen.set(it.id, { id: it.id, displayName, title: it.title, group_name: it.group_name })
          }
        } else if (mem.error) {
          const em = String(mem.error.message ?? '').toLowerCase()
          if (!em.includes('itinerary_client_members') && !em.includes('schema cache')) console.warn(mem.error)
        }

        const direct = await supabase
          .from('itineraries')
          .select('id, title, group_name, trip_type, is_template')
          .eq('client_id', idNum)
          .or('is_template.is.null,is_template.eq.false')
        if (!direct.error && direct.data) {
          for (const it of direct.data as {
            id: number
            title: string | null
            group_name: string | null
            trip_type: string | null
            is_template: boolean | null
          }[]) {
            if (it.is_template === true) continue
            if (String(it.trip_type ?? '').trim().toLowerCase() !== 'group') continue
            if (seen.has(it.id)) continue
            const displayName = it.group_name?.trim() || it.title?.trim() || `قروب #${it.id}`
            seen.set(it.id, { id: it.id, displayName, title: it.title, group_name: it.group_name })
          }
        }
        setJoinedGroups([...seen.values()].sort((a, b) => b.id - a.id))
      } else {
        setJoinedGroups([])
      }

      if (c?.ref_code) {
        const { count } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('used_code', c.ref_code)
        setCodeCount(count || 0)
      } else {
        setCodeCount(0)
      }
    } catch (e) {
      setClient(null)
      setLoadError(e instanceof Error ? e.message : 'حدث خطأ غير متوقع أثناء التحميل.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setTripCount(trips.length)
  }, [trips])

  useEffect(() => {
    void load()
  }, [clientId])

  const saveTravelDna = async () => {
    if (!supabase || !client) return
    setSavingTravelDna(true)
    setSaveNotice(null)
    try {
      const passport_expiry = passportExpiry.trim() || null
      const dnaPatch = clientDnaAdvancedPayload(dnaAdvancedForm)
      const directPatch = clientDnaSupabasePatch({
        flight_seat: travelDnaForm.preferred_seat,
        food_allergies: travelDnaForm.food_allergies,
        favorite_drink: travelDnaForm.drink_coffee,
        hotel_preference: travelDnaForm.hotel_style,
        passport_expiry,
        dna_interests: dnaAdvancedForm.dna_interests,
        dna_activity_level: dnaAdvancedForm.dna_activity_level,
      })
      const travel_dna = {
        ...(typeof directPatch.travel_dna === 'object' && directPatch.travel_dna
          ? (directPatch.travel_dna as Record<string, string>)
          : {}),
        ...serializeTravelDna(travelDnaForm),
      }
      const idNum = Number(clientId)
      const dbClientId = client.id ?? (Number.isFinite(idNum) ? idNum : clientId)
      const updatePayload = {
        ...directPatch,
        travel_dna,
        passport_expiry,
        ...dnaPatch,
      }
      const { error } = await supabase.from('clients').update(updatePayload).eq('id', dbClientId)
      if (error) {
        setSaveNotice(
          error.message ||
            'تعذر حفظ تفاصيل الـ DNA السياحي. نفّذ سكربت clients_dna_direct_columns.sql في Supabase.',
        )
        return
      }
      setClient({ ...client, ...updatePayload })
      setSaveNotice('تم حفظ تفاصيل الـ DNA السياحي وتاريخ الجواز.')
    } finally {
      setSavingTravelDna(false)
    }
  }

  const saveCode = async () => {
    if (!supabase) return
    setSaveNotice(null)
    const code = newCode.trim() || null
    const { error } = await supabase
      .from('clients')
      .update(buildReferralCodeUpdatePayload(code))
      .eq('id', clientId)
    if (error) {
      setSaveNotice(error.message || 'تعذر حفظ كود الإحالة.')
      return
    }
    setClient({ ...client, ref_code: code, referral_code: code })
    setEditingCode(false)
    setSaveNotice('تم حفظ كود الإحالة.')
  }

  const deleteCode = async () => {
    if (!supabase || !window.confirm('حذف كود الإحالة؟')) return
    setSaveNotice(null)
    const { error } = await supabase
      .from('clients')
      .update(buildReferralCodeUpdatePayload(null))
      .eq('id', clientId)
    if (error) {
      setSaveNotice(error.message || 'تعذر حذف كود الإحالة.')
      return
    }
    setClient({ ...client, ref_code: null, referral_code: null })
    setNewCode('')
    setSaveNotice('تم حذف كود الإحالة.')
  }

  const generateCode = async () => {
    if (!supabase || !client) return
    setSaveNotice(null)
    const name = (client.name ?? 'WL').slice(0, 4).replace(/\s/g, '')
    const num = Math.floor(Math.random() * 900 + 100)
    const code = `WL-${name}-${num}`
    const { error } = await supabase
      .from('clients')
      .update(buildReferralCodeUpdatePayload(code))
      .eq('id', clientId)
    if (error) {
      setSaveNotice(error.message || 'تعذر إنشاء كود الإحالة.')
      return
    }
    setClient({ ...client, ref_code: code, referral_code: code })
    setNewCode(code)
    setSaveNotice('تم إنشاء كود إحالة جديد.')
  }

  const deleteTrip = async (trip: UnifiedTrip) => {
    if (!supabase || !window.confirm('هل أنت متأكد من حذف هذه الرحلة؟')) return
    const table = trip.backend
    const { error } = await supabase.from(table).delete().eq('id', trip.id)
    if (error) {
      console.error(error)
      setTripNotice(error.message || 'تعذر حذف الرحلة.')
      return
    }
    setTrips((prev) => prev.filter((t) => t.id !== trip.id))
    setTripNotice(null)
  }

  const startEditTrip = (trip: UnifiedTrip) => {
    setEditingTrip(trip.id)
    setEditTripData({ destination: trip.destination, cost: trip.cost, trip_date: trip.trip_date || '' })
  }

  const saveEditTrip = async () => {
    if (!supabase || !editingTrip) return
    const row = trips.find((t) => t.id === editingTrip)
    if (!row) return
    const costNum = Number(editTripData.cost)
    if (Number.isNaN(costNum) || costNum < 0) {
      setTripNotice('أدخل تكلفة صحيحة (رقماً غير سالب).')
      return
    }
    const payload =
      row.backend === 'customer_trips'
        ? {
            destination: editTripData.destination,
            cost: costNum,
            trip_date: editTripData.trip_date || null,
          }
        : {
            destination: editTripData.destination,
            profit: costNum,
            trip_date: editTripData.trip_date || null,
          }
    const { error } = await supabase.from(row.backend).update(payload).eq('id', editingTrip)
    if (error) {
      console.error(error)
      setTripNotice(error.message || 'تعذر تحديث الرحلة.')
      return
    }
    setTrips((prev) =>
      prev.map((t) =>
        t.id === editingTrip
          ? {
              ...t,
              destination: editTripData.destination,
              cost: costNum,
              trip_date: editTripData.trip_date || null,
            }
          : t,
      ),
    )
    setEditingTrip(null)
    setTripNotice(null)
  }

  const submitLaunchTrip = async () => {
    if (!supabase || !client) return
    const expectedProfit = Number(launchTripForm.expected_profit)
    if (Number.isNaN(expectedProfit) || expectedProfit < 0) {
      setLaunchTripNotice('أدخل فائدة / رسوم خدمة صحيحة (رقماً غير سالب).')
      return
    }
    setLaunchTripSaving(true)
    setLaunchTripNotice(null)
    setLaunchTripSuccess(null)
    try {
      const result = await launchClientTrip({
        clientId,
        clientName: String(client.name ?? ''),
        destination: launchTripForm.destination,
        startDate: launchTripForm.start_date,
        endDate: launchTripForm.end_date,
        expectedProfit,
        currentTotalProfit: clientQuickStatNum(client.total_profit),
      })
      setClient({
        ...client,
        total_profit: result.newTotalProfit,
        vip_tier: result.newVipTier,
      })
      setTripCount((prev) => prev + 1)
      setShowLaunchTripModal(false)
      setLaunchTripForm({ destination: '', start_date: '', end_date: '', expected_profit: '' })
      setLaunchTripSuccess('تم إطلاق الرحلة بنجاح. ستظهر الآن في الرادار وتقارير الأرباح.')
    } catch (e) {
      setLaunchTripNotice(e instanceof Error ? e.message : 'تعذر إطلاق الرحلة.')
    } finally {
      setLaunchTripSaving(false)
    }
  }

  const deleteClient = async () => {
    if (!supabase || !client) return

    const confirmed = window.confirm(
      'هل أنت متأكد من حذف هذا العميل بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.',
    )
    if (!confirmed) return

    setDeletingClient(true)
    setSaveNotice(null)
    try {
      const idNum = Number(clientId)
      const dbId = Number.isFinite(idNum) ? idNum : client.id ?? clientId
      const { error } = await supabase.from('clients').delete().eq('id', dbId)

      if (error) {
        const msg = (error.message ?? '').toLowerCase()
        if (
          msg.includes('foreign key') ||
          msg.includes('violates') ||
          msg.includes('constraint') ||
          msg.includes('23503')
        ) {
          setSaveNotice('عذراً، لا يمكن حذف هذا العميل لوجود عروض أسعار أو رحلات مرتبطة به.')
        } else {
          setSaveNotice(error.message || 'تعذر حذف العميل.')
        }
        return
      }

      sessionStorage.setItem('crm_client_deleted_toast', '1')
      router.push('/crm/clients')
    } catch (e) {
      console.error('[CRM client detail] delete failed', e)
      setSaveNotice(e instanceof Error ? e.message : 'تعذر حذف العميل.')
    } finally {
      setDeletingClient(false)
    }
  }

  const copySecretOnboardingLink = async () => {
    if (!supabase || !client) return
    setCopyingOnboardingLink(true)
    try {
      const token = await ensureClientOnboardingToken(clientId, client.onboarding_token)
      if (token !== client.onboarding_token) {
        setClient({ ...client, onboarding_token: token })
      }
      const url = `${window.location.origin}/welcome/${token}`
      await navigator.clipboard.writeText(url)
      setSaveNotice('تم نسخ رابط التعارف السري 🔗')
    } catch (e) {
      setSaveNotice(e instanceof Error ? e.message : 'تعذر نسخ رابط التعارف.')
    } finally {
      setCopyingOnboardingLink(false)
    }
  }

  if (loading)
    return <div dir="rtl" style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>جارٍ التحميل...</div>
  if (loadError)
    return (
      <div dir="rtl" style={{ padding: 40, textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
        <div style={{ color: '#DC2626', fontSize: 14, fontWeight: 700, lineHeight: 1.8 }}>{loadError}</div>
        <Link
          href="/crm/clients"
          style={{
            display: 'inline-block',
            marginTop: 20,
            padding: '10px 20px',
            background: '#1C4532',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          رجوع للعملاء
        </Link>
      </div>
    )
  if (!client) return <div dir="rtl" style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>العميل غير موجود</div>

  const cardClass = 'bg-white rounded-2xl shadow-sm border border-slate-100 p-6'
  const customerPhone = String((client as { phone?: string }).phone ?? client.phone_wa ?? '').trim()
  const waUrl = customerPhone ? `https://wa.me/${customerPhone}` : ''
  const callUrl = customerPhone ? `tel:${customerPhone}` : ''
  const onboardingDone = client.onboarding_completed === true
  const tripsProfitSum = sumUnifiedTripProfit(trips)
  const targetTripLabel = resolveClientTargetTrip(client as Record<string, unknown>)
  const showSalesPipeline = !isLeaderClient(client) && !isInfluencerClient(client)

  return (
    <div dir="rtl" className="mx-auto max-w-7xl p-4 font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-slate-800">
      <Link
        href="/crm/clients"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
      >
        <ArrowRight size={14} />
        رجوع للعملاء
      </Link>

      {saveNotice && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700">
          {saveNotice}
        </div>
      )}

      {launchTripSuccess && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800">
          {launchTripSuccess}
        </div>
      )}

      {launchTripNotice && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-800">
          {launchTripNotice}
        </div>
      )}

      {tripNotice && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-800">
          {tripNotice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className={cardClass}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-black text-slate-900">{client.name}</h1>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <VipSpendingTierBadge tier={client.vip_tier} />
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${
                      onboardingDone
                        ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                        : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                    }`}
                  >
                    {onboardingDone ? '🟢 اكتمل التعارف' : '🟡 بانتظار العميل'}
                  </span>
                  {targetTripLabel ? (
                    <ClientTargetTripBadge label={targetTripLabel} className="min-w-0 shrink" />
                  ) : null}
                  {showSalesPipeline ? (
                    <ClientSalesStageControl
                      clientId={clientId}
                      value={String(client.sales_stage ?? '')}
                      compact
                      className="min-w-0 shrink"
                      onUpdated={(stage) => setClient({ ...client, sales_stage: stage || null })}
                    />
                  ) : null}
                </div>

                <ClientPaymentWhatsAppButton
                  clientId={clientId}
                  clientName={client.name ?? '—'}
                  phone={client.phone_wa}
                  targetTrip={targetTripLabel}
                  salesStage={client.sales_stage}
                  className="mt-4"
                />

                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                  {client.phone_wa && (
                    <span className="inline-flex items-center gap-1">
                      <Phone size={12} />
                      {client.phone_wa}
                    </span>
                  )}
                  {client.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail size={12} />
                      {client.email}
                    </span>
                  )}
                  {client.job_type && <span>💼 {client.job_type}</span>}
                  {client.travel_type && <span>🧳 {client.travel_type}</span>}
                </div>
                {client.birth_date ? (
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                    <span>🎂 يوم الميلاد:</span>
                    <span className="font-medium text-gray-800" dir="ltr">
                      {formatBirthdayDisplayDate(String(client.birth_date).slice(0, 10))}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {customerPhone ? (
                  <>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
                      aria-label="واتساب"
                    >
                      <MessageCircle size={16} />
                    </a>
                    <a
                      href={callUrl}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200"
                      aria-label="اتصال"
                    >
                      <PhoneCall size={16} />
                    </a>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => void deleteClient()}
                  disabled={deletingClient}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-red-500 ring-1 ring-red-100 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="حذف العميل"
                  title="حذف العميل"
                >
                  {deletingClient ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                  ) : (
                    <Trash2 size={16} aria-hidden />
                  )}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setLaunchTripNotice(null)
                setLaunchTripSuccess(null)
                setShowLaunchTripModal(true)
              }}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#D4AF37] via-[#C9A227] to-[#B8941F] px-5 py-3.5 text-sm font-black text-[#0D0F0E] shadow-lg ring-1 ring-[#D4AF37]/40 transition hover:brightness-105 sm:w-auto"
            >
              <Plane size={18} aria-hidden />
              إطلاق رحلة جديدة ✈️
            </button>
          </section>

          <section className={cardClass}>
            <div className="mb-5">
              <h2 className="inline-flex items-center gap-2 text-base font-black text-gray-900">
                <Sparkles className="h-5 w-5 text-amber-600" aria-hidden />
                🧬 تفاصيل الـ DNA السياحي للعميل
              </h2>
              <p className="mt-1 text-xs font-bold text-slate-600">
                travel_dna · dna_interests · dna_activity_level · dna_special_requests
              </p>
            </div>

            <ClientDnaAdvancedDisplay
              client={{
                dna_interests: dnaAdvancedForm.dna_interests,
                dna_special_requests: dnaAdvancedForm.dna_special_requests,
                dna_activity_level: dnaAdvancedForm.dna_activity_level,
              }}
              className="mb-4"
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-right sm:col-span-2">
                <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-700">المقعد المفضل (طيران)</span>
                <input
                  value={travelDnaForm.preferred_seat}
                  onChange={(e) => setTravelDnaForm({ ...travelDnaForm, preferred_seat: e.target.value })}
                  placeholder="نافذة، ممر…"
                  dir="rtl"
                  className="w-full rounded-xl border border-gray-400 bg-white p-3 text-sm font-bold text-gray-900 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-amber-500/35"
                />
              </label>
              <label className="block text-right sm:col-span-2">
                <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-700">الحساسية أو تفضيل الطعام</span>
                <textarea
                  value={travelDnaForm.food_allergies}
                  onChange={(e) => setTravelDnaForm({ ...travelDnaForm, food_allergies: e.target.value })}
                  placeholder="حساسية، حمية، لا شيء…"
                  rows={3}
                  dir="rtl"
                  className="w-full resize-y rounded-xl border border-gray-400 bg-white p-3 text-sm font-bold text-gray-900 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-amber-500/35"
                />
              </label>
              <label className="block text-right">
                <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-700">نوع الفنادق المفضلة</span>
                <select
                  value={travelDnaForm.hotel_style}
                  onChange={(e) => setTravelDnaForm({ ...travelDnaForm, hotel_style: e.target.value })}
                  className="w-full rounded-xl border border-gray-400 bg-white p-3 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-amber-500/35"
                >
                  <option value="">— لم يحدد —</option>
                  <option value="Ultra-Luxury">Ultra-Luxury · فائق الفخامة</option>
                  <option value="Boutique/Design">Boutique/Design · بوتيك وتصميم</option>
                  <option value="شقق فاخرة">شقق فاخرة</option>
                  <option value="هادئة">🌿 هادئة</option>
                  <option value="قريبة من السنتر">📍 قريبة من السنتر</option>
                  <option value="مودرن">🏙️ مودرن</option>
                </select>
              </label>
              <label className="block text-right">
                <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-700">المشروب / القهوة المفضلة</span>
                <input
                  value={travelDnaForm.drink_coffee}
                  onChange={(e) => setTravelDnaForm({ ...travelDnaForm, drink_coffee: e.target.value })}
                  placeholder="قهوة، شاي…"
                  dir="rtl"
                  className="w-full rounded-xl border border-gray-400 bg-white p-3 text-sm font-bold text-gray-900 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-amber-500/35"
                />
              </label>
              <label className="block text-right sm:col-span-2">
                <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-700">تاريخ انتهاء الجواز</span>
                <input
                  type="date"
                  value={passportExpiry}
                  onChange={(e) => setPassportExpiry(e.target.value)}
                  className="w-full rounded-xl border border-gray-400 bg-white p-3 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-amber-500/35 [color-scheme:light]"
                  dir="ltr"
                />
                <p className="mt-1.5 text-[10px] font-semibold text-slate-500">
                  يُغذّي الرادار الحي — تنبيهات انتهاء الجواز خلال أقل من 6 أشهر 🚨
                </p>
              </label>
            </div>

            <ClientDnaAdvancedFieldsEditor
              value={dnaAdvancedForm}
              onChange={setDnaAdvancedForm}
              fieldClassName="w-full rounded-xl border border-gray-400 bg-white p-3 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-amber-500/35"
            />

            <button
              type="button"
              onClick={() => void saveTravelDna()}
              disabled={savingTravelDna}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-amber-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {savingTravelDna ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  جاري الحفظ…
                </>
              ) : (
                <>
                  <Save size={16} aria-hidden /> حفظ DNA السياحي
                </>
              )}
            </button>
          </section>

          <ClientWalletLedgerCard
            clientId={clientId}
            initialBalance={clientQuickStatNum(client?.wallet_balance)}
            onBalanceChange={(next) => setClient({ ...client, wallet_balance: next })}
          />

          {(client.ref_code || client.referral_code) ? (
            <section className={cardClass}>
              <h2 className="mb-4 text-center text-sm font-black text-[#1c3d27]">باركود الإحالة</h2>
              <ReferralQrCard referralCode={client.ref_code || client.referral_code || ''} />
            </section>
          ) : null}

          <section className={cardClass}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="inline-flex items-center gap-2 text-base font-black text-slate-900">
                  <UsersRound size={16} />
                  القروبات المنضم إليها
                </h2>
                <p className="mt-1 text-xs font-bold text-slate-500">مسارات من نوع قروب في CRM مرتبطة بهذا العميل (جدول itineraries + itinerary_client_members).</p>
              </div>
            </div>
            {joinedGroups.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-400">لا توجد قروبات مسجّلة لهذا العميل بعد.</div>
            ) : (
              <ul className="space-y-2">
                {joinedGroups.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/crm/itineraries/${g.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 text-sm font-bold text-violet-950 transition hover:bg-violet-100"
                    >
                      <span className="font-black">{g.displayName}</span>
                      {g.group_name?.trim() && g.title?.trim() && g.group_name.trim() !== g.title.trim() ? (
                        <span className="text-xs font-semibold text-violet-700/80">{g.title}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={cardClass}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="inline-flex items-center gap-2 text-base font-black text-slate-900">
                  <Plane size={16} />
                  سجل الرحلات
                </h2>
                <p className="mt-1 text-xs font-bold text-emerald-700">
                  إجمالي الأرباح (سجل الرحلات): {tripsProfitSum.toLocaleString('ar-SA')} ر.س
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLaunchTripNotice(null)
                  setLaunchTripSuccess(null)
                  setShowLaunchTripModal(true)
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-[#D4AF37]/40 bg-[#FEFDF9] px-3 py-2 text-xs font-bold text-[#1E2720] hover:bg-amber-50"
              >
                <Plus size={12} />
                إطلاق رحلة
              </button>
            </div>

            {trips.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-400">لا توجد رحلات</div>
            ) : (
              trips.map((t) => (
                <div key={`${t.backend}-${t.id}`} className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {editingTrip === t.id ? (
                    <div>
                      <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          value={editTripData.destination}
                          onChange={(e) => setEditTripData({ ...editTripData, destination: e.target.value })}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                        />
                        <input
                          type="number"
                          value={editTripData.cost}
                          onChange={(e) => setEditTripData({ ...editTripData, cost: Number(e.target.value) })}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                        />
                      </div>
                      <input
                        type="date"
                        value={editTripData.trip_date}
                        onChange={(e) => setEditTripData({ ...editTripData, trip_date: e.target.value })}
                        className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void saveEditTrip()}
                          className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white"
                        >
                          حفظ
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTrip(null)}
                          className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-bold text-slate-700"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-800">{t.destination}</div>
                        {t.trip_date && <div className="text-xs text-slate-500">{t.trip_date}</div>}
                        {t.backend === 'client_trips' && (
                          <div className="mt-1 text-[10px] font-bold text-amber-700">سجل قديم (client_trips)</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-emerald-700">{(t.cost || 0).toLocaleString('ar-SA')} ر.س</span>
                        <button
                          type="button"
                          onClick={() => startEditTrip(t)}
                          className="rounded-lg bg-slate-200 p-2 text-slate-700"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteTrip(t)}
                          className="rounded-lg bg-rose-100 p-2 text-rose-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </section>

          <ClientDnaSmartEventRecommendations
            dnaInterests={dnaAdvancedForm.dna_interests}
            className="mt-2"
          />
        </div>

        <aside className="space-y-6 lg:col-span-1">
          <section className={cardClass}>
            <h2 className="mb-3 inline-flex items-center gap-2 text-base font-black text-slate-900">
              <Link2 size={16} className="text-[#D4AF37]" />
              رابط التعارف السري
            </h2>
            <p className="mb-3 text-xs leading-relaxed text-slate-600">
              رابط آمن ومشفّر للعميل — يملأ ملف التعارف VIP دون تسجيل دخول.
            </p>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${
                  onboardingDone
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                    : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                }`}
              >
                {onboardingDone ? '🟢 اكتمل التعارف' : '🟡 بانتظار العميل'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void copySecretOnboardingLink()}
              disabled={copyingOnboardingLink}
              className="w-full rounded-xl border border-[#D4AF37]/50 bg-[#1E2720] px-4 py-3 text-sm font-bold text-[#D4AF37] shadow-sm transition hover:bg-[#162019] disabled:opacity-60"
            >
              {copyingOnboardingLink ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  جاري التحضير…
                </span>
              ) : (
                'نسخ رابط التعارف السري ✨'
              )}
            </button>
          </section>

          <section className={cardClass}>
            <h2 className="mb-3 inline-flex items-center gap-2 text-base font-black text-slate-900">
              <Gift size={16} />
              كود الإحالة
            </h2>
            {client.ref_code || client.referral_code ? (
              <div>
                {editingCode ? (
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-sm font-bold outline-none"
                    />
                    <button type="button" onClick={() => void saveCode()} className="rounded-lg bg-slate-800 p-2 text-white">
                      <Save size={14} />
                    </button>
                    <button type="button" onClick={() => setEditingCode(false)} className="rounded-lg bg-slate-200 p-2 text-slate-700">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-lg font-black tracking-wider text-slate-900">
                      {client.ref_code || client.referral_code}
                    </div>
                    <button type="button" onClick={() => setEditingCode(true)} className="rounded-lg bg-slate-200 p-2 text-slate-700">
                      <Pencil size={12} />
                    </button>
                    <button type="button" onClick={() => void deleteCode()} className="rounded-lg bg-rose-100 p-2 text-rose-600">
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
                <p className="text-xs text-slate-600">
                  عدد استخدام الكود: <strong className="text-slate-900">{codeCount}</strong>
                </p>
              </div>
            ) : (
              <button type="button" onClick={() => void generateCode()} className="w-full rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white">
                توليد كود إحالة
              </button>
            )}
          </section>

          <section className={cardClass}>
            <h2 className="mb-3 text-base font-black text-slate-900">إحصائيات سريعة</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="inline-flex items-center gap-1.5 text-slate-600">
                  <Wallet size={14} className="text-amber-600" aria-hidden />
                  إجمالي الأرباح
                </span>
                <span className="font-black text-emerald-700" dir="ltr">
                  {Number(client?.total_profit || 0).toLocaleString('ar-SA')} ر.س
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-slate-600">شريحة VIP</span>
                <VipSpendingTierBadge tier={client.vip_tier} />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-slate-600">الرصيد الحالي (عهدة)</span>
                <span className="font-black text-slate-900" dir="ltr">
                  {formatWalletAmount(Number(client?.wallet_balance || 0))}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-slate-600">إجمالي المصروف (عهدة)</span>
                <span className="font-black text-slate-900" dir="ltr">
                  {formatWalletAmount(Number(client?.total_spent || 0))}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-slate-600">عدد الرحلات</span>
                <span className="font-black text-slate-900">{tripCount || 0}</span>
              </div>
              {client.birth_date ? (
                <div className="flex items-center justify-between rounded-lg bg-amber-50/80 px-3 py-2 ring-1 ring-amber-200/60">
                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                    <span aria-hidden>🎂</span>
                    يوم الميلاد
                  </span>
                  <span className="font-black text-slate-900" dir="ltr">
                    {formatBirthdayDisplayDate(String(client.birth_date).slice(0, 10))}
                  </span>
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      {showLaunchTripModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">إطلاق رحلة جديدة ✈️</h3>
              <button
                type="button"
                onClick={() => !launchTripSaving && setShowLaunchTripModal(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="إغلاق"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-black text-slate-600">
                وجهة الرحلة *
                <input
                  value={launchTripForm.destination}
                  onChange={(e) => setLaunchTripForm({ ...launchTripForm, destination: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold outline-none ring-slate-200 focus:ring-2"
                  placeholder="مثال: Paris"
                />
              </label>
              <label className="block text-xs font-black text-slate-600">
                تاريخ البداية *
                <input
                  type="date"
                  value={launchTripForm.start_date}
                  onChange={(e) => setLaunchTripForm({ ...launchTripForm, start_date: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-slate-200 focus:ring-2 [color-scheme:light]"
                />
              </label>
              <label className="block text-xs font-black text-slate-600">
                تاريخ النهاية *
                <input
                  type="date"
                  value={launchTripForm.end_date}
                  onChange={(e) => setLaunchTripForm({ ...launchTripForm, end_date: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-slate-200 focus:ring-2 [color-scheme:light]"
                />
              </label>
              <label className="block text-xs font-black text-slate-600">
                الفائدة / رسوم الخدمة (ر.س) *
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={launchTripForm.expected_profit}
                  onChange={(e) => setLaunchTripForm({ ...launchTripForm, expected_profit: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold outline-none ring-slate-200 focus:ring-2"
                  placeholder="0"
                />
              </label>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => !launchTripSaving && setShowLaunchTripModal(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={launchTripSaving}
                onClick={() => void submitLaunchTrip()}
                className="flex-1 rounded-xl bg-gradient-to-l from-[#D4AF37] to-[#B8941F] py-2.5 text-sm font-black text-[#0D0F0E] disabled:opacity-60"
              >
                {launchTripSaving ? 'جارٍ الإطلاق...' : 'إطلاق الرحلة'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
