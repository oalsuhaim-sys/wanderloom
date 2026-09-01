'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { deleteClientAction } from '@/app/actions/clientDirectoryActions'
import { supabase } from '@/lib/supabase'
import { buildItineraryPortalPath } from '@/lib/itinerary-client-crm'
import { getClientAccessToken } from '@/lib/crm-session-token'
import { sumUnifiedTripProfit, type UnifiedTripRow } from '@/lib/client-trips-crm'
import { clientDnaSupabasePatch } from '@/lib/client-dna-columns'
import { parseTravelDnaFromClient, serializeTravelDna, buildReferralCodeUpdatePayload, clientDnaAdvancedPayload, resolveClientTargetTrip, type ClientDnaAdvancedFields } from '@/lib/clientsTravelDna'
import ClientDnaAdvancedDisplay from '@/app/crm/clients/_components/ClientDnaAdvancedDisplay'
import ClientDnaAdvancedFieldsEditor from '@/app/crm/clients/_components/ClientDnaAdvancedFieldsEditor'
import ClientDnaSmartEventRecommendations from '@/app/crm/clients/_components/ClientDnaSmartEventRecommendations'
import AiPredictiveWishesCard from '@/app/crm/itineraries/_components/AiPredictiveWishesCard'
import { buildItineraryBuilderPath } from '@/lib/itinerary-builder-prefill'
import ClientPaymentWhatsAppButton from '@/app/crm/clients/_components/ClientPaymentWhatsAppButton'
import ClientSalesStageControl from '@/app/crm/clients/_components/ClientSalesStageControl'
import ClientTargetTripBadge from '@/app/crm/clients/_components/ClientTargetTripBadge'
import { formatBirthdayDisplayDate } from '@/lib/birthday-radar'
import Client360Profile from '@/app/crm/clients/_components/Client360Profile';
import ClientFinancialHub from '@/app/crm/clients/_components/ClientFinancialHub';
import ClientWalletLedgerCard from '@/app/crm/clients/_components/ClientWalletLedgerCard';
import ReferralQrCard from '@/app/crm/clients/_components/ReferralQrCard';
import VipSpendingTierBadge from '@/components/VipSpendingTierBadge';
import {
  formatWalletAmount,
} from '@/lib/vip-wallet-ledger';
import DnaInviteTripTypePicker from '@/app/crm/_components/DnaInviteTripTypePicker';
import ClientGroupTripManagement from '@/app/crm/clients/_components/ClientGroupTripManagement';
import { tagClientForGroupDna } from '@/app/actions/groupTripAssignmentActions';
import type { GroupMember } from '@/lib/group-members';
import {
  buildClientDnaWelcomeUrlByClientId,
  markDnaLinkSent,
  type DnaInviteTripType,
} from '@/lib/client-intake-pipeline';
import { launchClientTrip } from '@/lib/client-trip-launch';
import { formatWhatsAppPhone, whatsAppHrefWithMessage } from '@/lib/crm-lead-actions';
import {
  ArrowRight,
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
  Lock,
  PauseCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { setLeadPipelineStatus } from '@/lib/lead-pipeline-automation'

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
  const rawRouteId = params?.id
  const clientId = Array.isArray(rawRouteId) ? rawRouteId[0] ?? '' : String(rawRouteId ?? '')

  const [client, setClient] = useState<any>(null)
  const [trips, setTrips] = useState<UnifiedTrip[]>([])
  const [tripCount, setTripCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [editingCode, setEditingCode] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [editingProfileCode, setEditingProfileCode] = useState(false)
  const [newProfileCode, setNewProfileCode] = useState('')
  const [generatingProfileCode, setGeneratingProfileCode] = useState(false)
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
  const [launchTripItineraryUrl, setLaunchTripItineraryUrl] = useState<string | null>(null)
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
  const [sendingDnaWhatsApp, setSendingDnaWhatsApp] = useState(false)
  const [dnaInviteTripType, setDnaInviteTripType] = useState<DnaInviteTripType>('private')
  const [deletingClient, setDeletingClient] = useState(false)
  const [leadPipelineBusy, setLeadPipelineBusy] = useState<'postpone' | 'hardDelete' | null>(null)

  const loadTrips = useCallback(async () => {
    try {
      const accessToken = await getClientAccessToken()
      const res = await fetch(`/api/crm/clients/${encodeURIComponent(clientId)}/trips`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const payload = (await res.json()) as {
        ok?: boolean
        trips?: UnifiedTripRow[]
        error?: string
      }
      if (!res.ok || !payload.ok) {
        console.warn('[client-detail] trips API:', payload.error || res.status)
        setTrips([])
        setTripCount(0)
        return []
      }
      const rows = Array.isArray(payload.trips) ? payload.trips : []
      setTrips(rows)
      setTripCount(rows.length)
      return rows
    } catch (err) {
      console.warn('[client-detail] trips fetch failed', err)
      setTrips([])
      setTripCount(0)
      return []
    }
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
      // Kept as select('*'): `client` is untyped and dozens of columns are read
      // dynamically below (DNA, wallet, onboarding, pipeline fields) plus spread
      // wholesale into AiPredictiveWishesCard's clientRow context. Single-row
      // fetch by id — low volume, so the perf win doesn't justify the risk of
      // silently dropping a column some downstream consumer still needs.
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

      await loadTrips()

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
        setNewProfileCode(String(c.profile_code ?? '').toUpperCase())

        // Default WhatsApp DNA invite to Group when client is a group traveler
        const tags = Array.isArray(c.tags)
          ? c.tags.map((v: unknown) => String(v).trim().toLowerCase())
          : String(c.tags ?? '')
              .split(',')
              .map((v: string) => v.trim().toLowerCase())
              .filter(Boolean)
        const clientType = String(c.client_type ?? '').trim().toLowerCase()
        const intakeType = String(c.intake_trip_type ?? '').trim().toLowerCase()
        if (
          intakeType === 'group' ||
          clientType.includes('group') ||
          tags.includes('group_trip_client') ||
          tags.includes('group_onboarding_approved')
        ) {
          setDnaInviteTripType('group')
        } else {
          setDnaInviteTripType('private')
        }
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

      // tripCount is sourced only from loadTrips (no separate double-count)

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

  const saveProfileCode = async () => {
    if (!supabase || !client) return
    setSaveNotice(null)
    const code = newProfileCode.trim() || null
    const idNum = Number(clientId)
    const dbClientId = client.id ?? (Number.isFinite(idNum) ? idNum : clientId)
    const { error } = await supabase.from('clients').update({ profile_code: code }).eq('id', dbClientId)
    if (error) {
      setSaveNotice(error.message || 'تعذر حفظ رمز الملف الشخصي.')
      return
    }
    setClient({ ...client, profile_code: code })
    setEditingProfileCode(false)
    setSaveNotice('تم حفظ رمز الملف الشخصي الخاص.')
  }

  const handleGenerateProfileCode = async () => {
    if (!supabase || !client) return
    setSaveNotice(null)
    setGeneratingProfileCode(true)

    const newPin = Math.floor(100000 + Math.random() * 900000).toString()
    const idNum = Number(clientId)
    const dbClientId = client.id ?? (Number.isFinite(idNum) ? idNum : clientId)

    try {
      const { data, error } = await supabase
        .from('clients')
        .update({ profile_code: newPin })
        .eq('id', dbClientId)
        .select('profile_code')
        .single()

      if (error) {
        setSaveNotice(error.message || 'تعذر إنشاء رمز الملف الشخصي.')
        return
      }

      const savedPin = String(data?.profile_code ?? newPin)
      setClient({ ...client, profile_code: savedPin })
      setNewProfileCode(savedPin)
      setSaveNotice('تم إنشاء رمز الملف الشخصي الخاص.')
    } finally {
      setGeneratingProfileCode(false)
    }
  }

  const deleteProfileCode = async () => {
    if (!supabase || !client || !window.confirm('حذف رمز الملف الشخصي؟')) return
    setSaveNotice(null)
    const idNum = Number(clientId)
    const dbClientId = client.id ?? (Number.isFinite(idNum) ? idNum : clientId)
    const { error } = await supabase.from('clients').update({ profile_code: null }).eq('id', dbClientId)
    if (error) {
      setSaveNotice(error.message || 'تعذر حذف رمز الملف الشخصي.')
      return
    }
    setClient({ ...client, profile_code: null })
    setNewProfileCode('')
    setSaveNotice('تم حذف رمز الملف الشخصي.')
  }

  const deleteTrip = async (trip: UnifiedTrip) => {
    if (trip.backend === 'itineraries') {
      setTripNotice('حذف مسارات CRM يتم من صفحة تعديل المسار.')
      return
    }
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
    const tripClientId = client.id ?? clientId
    if (tripClientId == null || String(tripClientId).trim() === '') {
      setLaunchTripNotice('معرّف العميل غير متوفر — أعد تحميل الصفحة.')
      return
    }
    const expectedProfit = Number(launchTripForm.expected_profit)
    if (Number.isNaN(expectedProfit) || expectedProfit < 0) {
      setLaunchTripNotice('أدخل فائدة / رسوم خدمة صحيحة (رقماً غير سالب).')
      return
    }
    setLaunchTripSaving(true)
    setLaunchTripNotice(null)
    setLaunchTripSuccess(null)
    setLaunchTripItineraryUrl(null)
    try {
      const result = await launchClientTrip({
        clientId: tripClientId,
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
      const itineraryPath = buildItineraryPortalPath({
        itinerarySlug: result.publicSlug,
        clientId: tripClientId,
        itineraryId: result.itineraryId,
      })
      setLaunchTripItineraryUrl(itineraryPath)
      setLaunchTripSuccess('تم إطلاق الرحلة بنجاح. ستظهر الآن في الرادار وتقارير الأرباح.')
      router.push(itineraryPath)
    } catch (e) {
      setLaunchTripNotice(e instanceof Error ? e.message : 'تعذر إطلاق الرحلة.')
    } finally {
      setLaunchTripSaving(false)
    }
  }

  const deleteClient = async () => {
    if (!client) return

    const confirmed = window.confirm(
      'هل أنت متأكد من حذف هذا العميل بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.',
    )
    if (!confirmed) return

    setDeletingClient(true)
    setSaveNotice(null)
    try {
      const idNum = Number(clientId)
      const dbId = Number.isFinite(idNum) ? idNum : client.id ?? clientId

      // Service-role delete — only navigate away after DB confirms the row was removed
      const result = await deleteClientAction(dbId)
      if (!result.ok) {
        setSaveNotice(result.error || 'فشل حذف العميل من قاعدة البيانات.')
        console.error('[CRM client detail] delete failed:', result.error)
        return
      }

      sessionStorage.setItem('crm_client_deleted_toast', '1')
      router.push('/crm/clients')
    } catch (e) {
      console.error('[CRM client detail] delete failed', e)
      setSaveNotice(e instanceof Error ? e.message : 'فشل حذف العميل من قاعدة البيانات.')
    } finally {
      setDeletingClient(false)
    }
  }

  /** Soft-archive linked pipeline leads — real clients who dropped off */
  const handlePostponeLeads = async () => {
    if (!supabase || !client) return
    if (
      !window.confirm(
        'هل تريد تأجيل طلبات هذا العميل؟ ستختفي من اللوحة النشطة ويمكنك العودة لها لاحقاً عبر الحالة «مؤجّل».',
      )
    ) {
        return
      }

    setLeadPipelineBusy('postpone')
    try {
      const idNum = Number(clientId)
      const dbId = Number.isFinite(idNum) ? idNum : client.id ?? clientId
      await setLeadPipelineStatus(supabase, { clientId: dbId, force: true }, 'postponed')
      toast.success('تم تأجيل الطلبات بنجاح')
      router.push('/crm/pipeline')
    } catch (err) {
      console.error('[postpone leads]', err)
      toast.error('حدث خطأ أثناء التأجيل')
    } finally {
      setLeadPipelineBusy(null)
    }
  }

  /** Hard-delete linked leads only — for fake/test pipeline data */
  const handleHardDeleteLeads = async () => {
    if (!supabase || !client) return
    if (
      !window.confirm(
        'تحذير: هل أنت متأكد من الحذف النهائي لطلبات المسار المرتبطة؟ سيتم مسحها من قاعدة البيانات ولن يمكن استرجاعها. (ملف العميل نفسه لن يُحذف)',
      )
    ) {
      return
    }

    setLeadPipelineBusy('hardDelete')
    try {
      const idNum = Number(clientId)
      const dbId = Number.isFinite(idNum) ? idNum : client.id ?? clientId
      let del = await supabase.from('leads').delete().eq('client_id', dbId)
      if (del.error && /client_id|column|schema cache|does not exist/i.test(del.error.message ?? '')) {
        const phone = String(client.phone_wa ?? '').trim()
        if (phone) {
          del = await supabase.from('leads').delete().eq('phone_wa', phone)
      } else {
          throw new Error(
            'عمود leads.client_id غير موجود — نفّذ supabase/sql/clients_intake_pipeline.sql أو احذف الطلب من الكانبان.',
          )
        }
      }
      if (del.error) throw del.error
      toast.success('تم حذف طلبات المسار نهائياً')
      router.push('/crm/pipeline')
    } catch (err) {
      console.error('[hard delete leads]', err)
      toast.error(err instanceof Error ? err.message : 'حدث خطأ أثناء الحذف')
    } finally {
      setLeadPipelineBusy(null)
    }
  }

  const resolveDnaClientId = (): string | number | null => {
    const id = client?.id ?? clientId
    if (id == null || String(id).trim() === '') return null
    return id
  }

  const buildDnaUrlForClient = (resolvedId: string | number): string => {
    return buildClientDnaWelcomeUrlByClientId(
      resolvedId,
      window.location.origin,
      dnaInviteTripType,
    )
  }

  const copyTextWithFallback = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }
  }

  const handleCopyDnaLink = async () => {
    const resolvedClientId = resolveDnaClientId()
    if (!resolvedClientId) {
      toast.error('تعذر العثور على معرف العميل لإنشاء الرابط')
      return
    }

    setCopyingOnboardingLink(true)
    try {
      if (dnaInviteTripType === 'group') {
        const tagged = await tagClientForGroupDna(String(resolvedClientId), await getClientAccessToken())
        if (!tagged.ok) {
          toast.error(tagged.error)
          return
        }
      }

      const dnaUrl = buildDnaUrlForClient(resolvedClientId)
      await copyTextWithFallback(dnaUrl)
      toast.success('تم نسخ رابط الـ DNA بنجاح! 📋')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر نسخ رابط التعارف.')
    } finally {
      setCopyingOnboardingLink(false)
    }
  }

  const handleSendWhatsappDna = async () => {
    if (!client) return

    const resolvedClientId = resolveDnaClientId()
    if (!resolvedClientId) {
      toast.error('تعذر العثور على معرف العميل لإنشاء الرابط')
      return
    }

    const rawPhone = String(client.phone_wa ?? (client as { phone?: string }).phone ?? '').trim()
    const cleanPhone = formatWhatsAppPhone(rawPhone)
    if (!cleanPhone || cleanPhone.length < 8) {
      toast.error('رقم جوال العميل غير متوفر!')
      return
    }

    setSendingDnaWhatsApp(true)
    try {
      if (dnaInviteTripType === 'group') {
        const tagged = await tagClientForGroupDna(String(resolvedClientId), await getClientAccessToken())
        if (!tagged.ok) {
          toast.error(tagged.error)
          return
        }
      }

      const dnaUrl = buildDnaUrlForClient(resolvedClientId)
      const clientName = String(client.name ?? 'عزيزنا العميل')
      const message = `مرحباً ${clientName}، يسعدنا البدء في تنظيم رحلتك! نرجو منك إكمال ملف DNA السفر الخاص بك عبر الرابط التالي:\n${dnaUrl}`
      const waUrl = whatsAppHrefWithMessage(cleanPhone, message)

      if (supabase) {
        await markDnaLinkSent(supabase, Number(resolvedClientId)).catch(() => {})
      }

      window.open(waUrl, '_blank', 'noopener,noreferrer')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر فتح واتساب.')
    } finally {
      setSendingDnaWhatsApp(false)
    }
  }

  const onGroupMembershipLoaded = useCallback((member: GroupMember | null) => {
    // Any group_members row means this client is in the group funnel → default WhatsApp to Group
    if (member) {
      setDnaInviteTripType('group')
    }
  }, [])

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

  const cardClass =
    'bg-white rounded-xl shadow-sm border border-slate-200 p-5 dark:bg-[#22302C] dark:border-[#2D3F3A]'
  const customerPhone = formatWhatsAppPhone(String((client as { phone?: string }).phone ?? client.phone_wa ?? '').trim())
  const waUrl = customerPhone.length >= 8 ? `https://wa.me/${customerPhone}` : ''
  const callUrl = customerPhone ? `tel:${customerPhone}` : ''
  const onboardingDone = client.onboarding_completed === true
  const tripsProfitSum = sumUnifiedTripProfit(trips)
  const targetTripLabel = resolveClientTargetTrip(client as Record<string, unknown>)
  const showSalesPipeline = true

  return (
    <div dir="rtl" className="mx-auto max-w-7xl p-4 font-sans text-slate-800 dark:text-gray-100">
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
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          <p>{launchTripSuccess}</p>
          {launchTripItineraryUrl ? (
            <Link
              href={launchTripItineraryUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-black text-emerald-900 underline underline-offset-2"
            >
              فتح مسار الرحلة في تبويب جديد
            </Link>
          ) : null}
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

      <Client360Profile
        clientId={clientId}
        name={String(client.name ?? '')}
        phone={client.phone_wa ?? (client as { phone?: string }).phone}
        email={client.email}
        jobType={client.job_type}
        travelType={client.travel_type}
        vipTier={client.vip_tier}
        totalProfit={tripsProfitSum}
        trips={trips}
        badges={
          <>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm ${
                onboardingDone ? '' : 'dark:border-[#D4AF37]/30 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37]'
              }`}
            >
              {onboardingDone ? 'اكتمل التعارف' : 'بانتظار العميل'}
                    </span>
            {targetTripLabel ? (
              <ClientTargetTripBadge
                label={targetTripLabel}
                className="min-w-0 shrink !border-white/20 !bg-white/10 !text-white !shadow-none backdrop-blur-sm"
              />
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
            {client.birth_date ? (
              <span className="text-xs font-semibold text-white/65" dir="ltr">
                🎂 {formatBirthdayDisplayDate(String(client.birth_date).slice(0, 10))}
                    </span>
            ) : null}
          </>
        }
        actions={
          <>
              {customerPhone ? (
              <>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-emerald-300 ring-1 ring-white/15 transition hover:bg-white/20"
                    aria-label="واتساب"
                  >
                    <MessageCircle size={16} />
                  </a>
                  <a
                    href={callUrl}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/20"
                    aria-label="اتصال"
                  >
                    <PhoneCall size={16} />
                  </a>
              </>
              ) : null}
            <button
              type="button"
              onClick={() => void handlePostponeLeads()}
              disabled={leadPipelineBusy !== null || deletingClient}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-white/10 px-3 text-[10px] font-black text-amber-200 ring-1 ring-amber-300/30 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="تأجيل الطلب"
              title="تأجيل طلبات المسار (أرشفة ناعمة)"
            >
              {leadPipelineBusy === 'postpone' ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <PauseCircle size={14} aria-hidden />
              )}
              تأجيل
            </button>
            <button
              type="button"
              onClick={() => void handleHardDeleteLeads()}
              disabled={leadPipelineBusy !== null || deletingClient}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-white/10 px-3 text-[10px] font-black text-rose-200 ring-1 ring-rose-300/35 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="حذف نهائي للطلبات"
              title="حذف نهائي لطلبات المسار (بيانات تجريبية)"
            >
              {leadPipelineBusy === 'hardDelete' ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Trash2 size={14} aria-hidden />
              )}
              حذف طلب
            </button>
            <button
              type="button"
              onClick={() => void deleteClient()}
              disabled={deletingClient || leadPipelineBusy !== null}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-red-300 ring-1 ring-red-300/30 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="حذف العميل"
              title="حذف ملف العميل بالكامل"
            >
              {deletingClient ? (
                <Loader2 size={16} className="animate-spin" aria-hidden />
              ) : (
                <Trash2 size={16} aria-hidden />
              )}
            </button>
          </>
        }
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <ClientPaymentWhatsAppButton
              clientId={clientId}
              clientName={client.name ?? '—'}
              phone={client.phone_wa}
              targetTrip={targetTripLabel}
              salesStage={client.sales_stage}
            />
            <button
              type="button"
              onClick={() => {
                setLaunchTripNotice(null)
                setLaunchTripSuccess(null)
                setLaunchTripItineraryUrl(null)
                setShowLaunchTripModal(true)
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl !bg-white px-5 py-3.5 text-sm font-semibold !text-slate-900 shadow-sm transition hover:!bg-slate-50 sm:w-auto dark:!border dark:!border-[#D4AF37]/50 dark:!bg-[#D4AF37]/20 dark:!text-[#D4AF37] dark:hover:!bg-[#D4AF37]/30"
            >
              <Plane size={18} aria-hidden />
              إطلاق رحلة جديدة ✈️
            </button>
            </div>
        }
      />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ClientGroupTripManagement
            clientId={clientId}
            className={cardClass}
            onMembershipLoaded={onGroupMembershipLoaded}
          />

          <section className={cardClass}>
            <div className="mb-4">
              <h2 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-gray-100">
                <Sparkles className="h-5 w-5 text-[#D4AF37]" aria-hidden />
                تفاصيل الـ DNA السياحي للعميل
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                travel_dna · dna_interests · dna_activity_level · dna_special_requests
              </p>
            </div>

            <ClientDnaAdvancedDisplay
              client={{
                dna_interests: dnaAdvancedForm.dna_interests,
                dna_special_requests: dnaAdvancedForm.dna_special_requests,
                dna_activity_level: dnaAdvancedForm.dna_activity_level,
                travel_dna: client?.travel_dna,
              }}
              className="mb-4"
            />

            <AiPredictiveWishesCard
              className="mb-5"
              storageKey={`predictive-wish-client-v2-${clientId}`}
              builderHref={buildItineraryBuilderPath({
                from: 'client',
                clientId,
                clientName: client?.name ?? undefined,
                tripTitle: targetTripLabel.trim() || undefined,
                destinations: targetTripLabel.trim() || undefined,
              })}
              context={{
                clientRow: client
                  ? {
                      ...client,
                      travel_dna: client.travel_dna,
                      favorite_drink: travelDnaForm.drink_coffee,
                      dna_interests: dnaAdvancedForm.dna_interests,
                      dna_activity_level: dnaAdvancedForm.dna_activity_level,
                    }
                  : null,
                destination: resolveClientTargetTrip(client ?? {}),
                tripDateFrom: '',
                tripDateTo: '',
              }}
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

          <ClientFinancialHub clientId={clientId} />

          <ClientWalletLedgerCard
            clientId={clientId}
            initialBalance={clientQuickStatNum(client?.wallet_balance)}
            onBalanceChange={(next) =>
              setClient((prev) => (prev ? { ...prev, wallet_balance: next } : prev))
            }
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
                <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                  <Plane size={16} />
                  سجل الرحلات
                </h2>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  إجمالي الأرباح (سجل الرحلات): {tripsProfitSum.toLocaleString('ar-SA')} ر.س
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLaunchTripNotice(null)
                  setLaunchTripSuccess(null)
                  setLaunchTripItineraryUrl(null)
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
                  {editingTrip === t.id && t.backend !== 'itineraries' ? (
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
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800">{t.destination || 'لا يوجد'}</div>
                        {(t.trip_date || t.end_date) && (
                          <div className="text-xs text-slate-500" dir="ltr">
                            {[t.trip_date, t.end_date].filter(Boolean).join(' → ')}
                          </div>
                        )}
                        {t.backend === 'itineraries' ? (
                          <div className="mt-1 text-[10px] font-bold text-emerald-700">
                            مسار CRM{t.status ? ` · ${t.status}` : ''}
                          </div>
                        ) : null}
                        {t.backend === 'client_trips' && (
                          <div className="mt-1 text-[10px] font-bold text-amber-700">سجل قديم (client_trips)</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-emerald-700">{(t.cost || 0).toLocaleString('ar-SA')} ر.س</span>
                        {t.backend === 'itineraries' && t.viewUrl ? (
                          <Link
                            href={t.viewUrl}
                            className="rounded-lg bg-[#1E2720] px-3 py-2 text-[10px] font-bold text-[#D4AF37]"
                          >
                            فتح المسار
                          </Link>
                        ) : (
                          <>
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
                          </>
                        )}
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

        <aside className="space-y-4 lg:col-span-1">
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
            <DnaInviteTripTypePicker
              value={dnaInviteTripType}
              onChange={setDnaInviteTripType}
              disabled={sendingDnaWhatsApp || copyingOnboardingLink}
              className="mb-3"
              />
              <button
                type="button"
                onClick={() => void handleCopyDnaLink()}
                disabled={copyingOnboardingLink}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-800 shadow-sm transition-all hover:bg-slate-200 disabled:opacity-60"
              >
                {copyingOnboardingLink ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    جاري التحضير…
                  </span>
                ) : (
                  <>
                    <span aria-hidden>📋</span>
                    <span>نسخ رابط التعارف السري (DNA Link)</span>
                  </>
                )}
              </button>
            <button
              type="button"
              onClick={() => void handleSendWhatsappDna()}
              disabled={sendingDnaWhatsApp}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
            >
              {sendingDnaWhatsApp ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <MessageCircle size={16} aria-hidden />
              )}
              إرسال رابط DNA عبر واتساب
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
              <button
                type="button"
                onClick={() => void generateCode()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-extrabold text-black shadow-sm transition-all hover:bg-[#b8952d]"
              >
                <span aria-hidden>🎁</span>
                <span>توليد كود إحالة</span>
              </button>
            )}
          </section>

          <section className={cardClass}>
            <h2 className="mb-3 inline-flex items-center gap-2 text-base font-black text-slate-900">
              <Lock size={16} className="text-rose-600" />
              رمز الملف الشخصي الخاص
            </h2>
            <p className="mb-3 text-xs leading-relaxed text-slate-600">
              للوصول إلى المحفظة والبيانات المالية فقط — لا يُشارك مع رابط المسار ولا مع كود الإحالة.
            </p>
            {client.profile_code ? (
              <div>
                {editingProfileCode ? (
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      value={newProfileCode}
                      onChange={(e) => setNewProfileCode(e.target.value.toUpperCase())}
                      dir="ltr"
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center font-mono text-sm font-bold outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void saveProfileCode()}
                      className="rounded-lg bg-slate-800 p-2 text-white"
                    >
                      <Save size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingProfileCode(false)}
                      className="rounded-lg bg-slate-200 p-2 text-slate-700"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="mb-2 flex items-center gap-2">
                    <div
                      className="flex-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-center font-mono text-lg font-black tracking-wider text-slate-900"
                      dir="ltr"
                    >
                      {client.profile_code}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingProfileCode(true)}
                      className="rounded-lg bg-slate-200 p-2 text-slate-700"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteProfileCode()}
                      className="rounded-lg bg-rose-100 p-2 text-rose-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void handleGenerateProfileCode()}
                disabled={generatingProfileCode}
                className="w-full rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generatingProfileCode ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    جاري التوليد…
                  </span>
                ) : (
                  'توليد رمز الملف الشخصي'
                )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4" dir="rtl">
          <div className="max-h-[90vh] w-[95%] max-w-md overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
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
