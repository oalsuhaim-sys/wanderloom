'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Crown,
  Download,
  Eye,
  LayoutGrid,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  Table2,
  Trash2,
  X,
} from 'lucide-react'

import { deleteClientAction, fetchClientDirectoryAction, syncLegacyGroupMemberDnaAction } from '@/app/actions/clientDirectoryActions'
import ContactFilterTabs from '@/app/crm/clients/_components/ContactFilterTabs'
import ClientCard from '@/app/crm/clients/_components/ClientCard'
import { runGroupMembersClientSyncOnce } from '@/app/crm/clients/useClients'
import ClientDnaAdvancedFieldsEditor from '@/app/crm/clients/_components/ClientDnaAdvancedFieldsEditor'
import ClientDnaSmartEventRecommendations from '@/app/crm/clients/_components/ClientDnaSmartEventRecommendations'
import ClientPaymentWhatsAppButton from '@/app/crm/clients/_components/ClientPaymentWhatsAppButton'
import ClientSalesStageControl from '@/app/crm/clients/_components/ClientSalesStageControl'
import { countClientTripsByClientIds, sumClientTripProfitByClientIds } from '@/lib/client-trips-crm'
import {
  clientDisplayTierBadge,
  engagementDotClass,
  engagementStatusLabel,
  formatSarClv,
  parseTravelDnaChips,
  resolveClientLifetimeValue,
} from '@/lib/client-crm-profile'
import { whatsAppHref } from '@/lib/crm-lead-actions'
import { getClientAccessToken } from '@/lib/crm-session-token'
import {
  countClientsByTab,
  filterClientsByTab,
  searchClients,
  type ContactTabId,
} from '@/lib/crm-contacts'
import { supabase } from '@/lib/supabase'
import { ONBOARDING_HOTEL_TYPE_OPTIONS } from '@/lib/client-onboarding'
import {
  buildClientInsertPayload,
  buildClientUpdatePayload,
  DEFAULT_CLIENT_TYPE,
  type ClientTier,
  type ClientType,
  type VipClientProfile,
} from '@/lib/clientsTravelDna'
import {
  CLIENT_SALES_STAGES,
  normalizeSalesStage,
} from '@/lib/client-sales-stage'
import { LEAD_SOURCE_OPTIONS } from '@/lib/lead-source'
import { exportClientsToCSV } from '@/lib/export-clients-csv'
import { CRM_BTN_PRIMARY, CRM_BTN_GHOST, CRM_CARD_GRID, CRM_FILTER_BAR, CRM_INPUT, CRM_TABLE, CRM_TABLE_SCROLL } from '@/lib/crm-luxury-ui'
import { toast } from '@/lib/crm-toast'

const ar = {
  "loyalty": "نظام الولاء",
  "title": "قاعدة العملاء ونظام الولاء",
  "subtitle": "مصدر واحد للحقيقة: جدول العملاء — الشرائح، الرحلات، الإحالات، وملف الـ DNA السياحي.",
  "addBtn": "إضافة عميل جديد",
  "addClientShort": "إضافة عميل",
  "filterBtn": "تصفية",
  "exportCsv": "تصدير العملاء (CSV)",
  "exportCsvEmpty": "لا يوجد عملاء للتصدير.",
  "exportCsvOk": "تم تنزيل ملف CSV.",
  "searchPh": "بحث بالاسم، الشريحة، كود الإحالة، الهاتف، أو التفضيلات…",
  "searchPhUnified": "بحث في قاعدة العملاء…",
  "loading": "جاري تحميل قاعدة العملاء…",
  "empty": "لا يوجد عملاء بعد — أضف أول عميل من الزر أعلاه.",
  "noMatch": "لا توجد نتائج مطابقة للبحث.",
  "noContact": "لا توجد بيانات اتصال",
  "refCode": "كود الإحالة",
  "copyRef": "نسخ كود الإحالة",
  "noRef": "لا يوجد كود إحالة",
  "openProfile": "فتح الملف الكامل ←",
  "viewProfile": "عرض",
  "manageProfile": "إدارة الملف",
  "edit": "تعديل",
  "delete": "حذف",
  "deleteConfirm": "هل أنت متأكد من حذف هذا العميل نهائياً؟",
  "deleteConstraintErr": "عذراً، لا يمكن حذف هذا العميل لوجود عروض أسعار أو رحلات مرتبطة به.",
  "deleteOk": "تم حذف العميل بنجاح من قاعدة البيانات.",
  "deleteFail": "فشل حذف العميل من قاعدة البيانات.",
  "editTitle": "تعديل بيانات العميل",
  "addTitle": "إضافة عميل جديد",
  "modalHint": "يُحفظ الاسم في name مع بيانات الولاء والـ DNA",
  "close": "إغلاق",
  "fullName": "الاسم الكامل *",
  "loyaltySection": "الولاء والشرائح",
  "tier": "الشريحة",
  "clientSegment": "شريحة العميل",
  "referralSource": "مصدر الإحالة",
  "referralSourcePlaceholder": "اختر مصدر الإحالة...",
  "trips": "عدد الرحلات",
  "referrals": "عدد الإحالات",
  "totalProfit": "إجمالي الأرباح",
  "phone": "رقم الهاتف",
  "birthday": "يوم الميلاد",
  "email": "البريد الإلكتروني",
  "saving": "جاري الحفظ…",
  "saveEdit": "حفظ التعديلات",
  "saveNew": "حفظ العميل",
  "cancel": "إلغاء",
  "supabaseErr": "Supabase غير متصل. تأكد من إعداد NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  "loadErr": "تعذر تحميل العملاء.",
  "updateSchemaErr": "تعذر الحفظ — تأكد من أعمدة name و phone_wa والولاء (client_tier، total_trips، referrals_count) في Supabase.",
  "updateErr": "تعذر تحديث العميل.",
  "insertSchemaErr": "تعذر الحفظ — نفّذ سكربتات clients_vip_dna_columns.sql و clients_travel_dna.sql وأعمدة الولاء في Supabase.",
  "insertErr": "تعذر إضافة العميل.",
  "copyOk": "تم نسخ كود الإحالة!",
  "copyFail": "تعذر نسخ الكود — انسخه يدوياً: ",
  "resultCount": "{n} من {m} عميل",
  "resultCountUnified": "{n} من {m} عميل",
  "emptyTabClients": "لا يوجد عملاء في هذه القائمة بعد.",
  "emptyTabAll": "لا توجد عملاء بعد.",
  "dnaFlight": "المقعد المفضل (طيران)",
  "dnaHotel": "نوع الفنادق المفضلة",
  "dnaDietary": "الحساسية أو تفضيل الطعام",
  "dnaFavoriteDrink": "المشروب / القهوة المفضلة",
  "dnaPassport": "تاريخ انتهاء الجواز",
  "dnaSecret": "ملاحظات سرية",
  "dnaInterests": "اهتمامات السفر",
  "dnaActivity": "مستوى النشاط",
  "dnaSpecial": "طلبات خاصة",
  "leadSource": "مصدر العميل (كيف تعرف علينا؟)",
  "leadSourcePlaceholder": "اختر مصدر العميل...",
  "salesStage": "مرحلة البيع",
  "salesStagePlaceholder": "اختر مرحلة البيع..."
} as const

const CRM_FIELD =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-100 dark:focus:border-[#D4AF37]/40 dark:focus:ring-[#D4AF37]/15'

/** Premium modal controls — Add/Edit client */
const MODAL_FIELD =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-100 dark:focus:ring-[#D4AF37]'

const CLIENT_SEGMENT_OPTIONS: { value: ClientTier; label: string }[] = [
  { value: 'regular', label: 'عادي' },
  { value: 'vip', label: 'VIP (هام)' },
  { value: 'vvip', label: 'VVIP (هام جداً)' },
]

const BTN_PRIMARY = CRM_BTN_PRIMARY

const BTN_SECONDARY = CRM_BTN_GHOST

const CARD =
  'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]'

const EMPTY_FORM = {
  name: '',
  phone_wa: '',
  email: '',
  birth_date: '',
  flight_seat: '',
  food_allergies: '',
  favorite_drink: '',
  hotel_preference: '',
  passport_expiry: '',
  secret_notes: '',
  dna_interests: '',
  dna_special_requests: '',
  dna_activity_level: '',
  client_type: DEFAULT_CLIENT_TYPE as ClientType,
  client_tier: 'regular' as ClientTier,
  total_trips: 0,
  referrals_count: 0,
  lead_source: '',
  is_influencer: false,
  is_leader: false,
  influencer_followers: 0,
  influencer_commission: 0,
  platforms: '',
  content_focus: '',
  profile_url: '',
  sales_stage: '',
}

function clientToForm(c: VipClientProfile) {
  return {
    name: c.name,
    phone_wa: c.phone_wa,
    email: c.email ?? '',
    birth_date: c.birth_date ?? '',
    flight_seat: c.flight_seat || c.flight_preferences,
    food_allergies: c.food_allergies || c.dietary,
    favorite_drink: c.favorite_drink,
    hotel_preference: c.hotel_preference || c.hotel_preferences,
    passport_expiry: c.passport_expiry ?? '',
    secret_notes: c.secret_notes,
    dna_interests: c.dna_interests ?? '',
    dna_special_requests: c.dna_special_requests ?? '',
    dna_activity_level: c.dna_activity_level ?? '',
    client_type: c.client_type,
    client_tier: c.client_tier,
    total_trips: c.total_trips,
    referrals_count: c.referrals_count,
    lead_source: c.lead_source ?? '',
    is_influencer: c.is_influencer,
    is_leader: c.is_leader,
    influencer_followers: c.influencer_followers ?? 0,
    influencer_commission: c.influencer_commission ?? 0,
    platforms: c.platforms ?? '',
    content_focus: c.content_focus ?? '',
    profile_url: c.profile_url ?? '',
    sales_stage: normalizeSalesStage(c.sales_stage),
  }
}

function formToClientPatch(form: typeof EMPTY_FORM): Partial<VipClientProfile> {
  const dietaryParts = [form.food_allergies.trim(), form.favorite_drink.trim() ? `مشروب: ${form.favorite_drink.trim()}` : ''].filter(Boolean)
  return {
    name: form.name.trim(),
    phone_wa: form.phone_wa.trim(),
    email: form.email.trim() || null,
    birth_date: form.birth_date.trim(),
    flight_seat: form.flight_seat.trim(),
    food_allergies: form.food_allergies.trim(),
    favorite_drink: form.favorite_drink.trim(),
    hotel_preference: form.hotel_preference.trim(),
    passport_expiry: form.passport_expiry.trim(),
    flight_preferences: form.flight_seat.trim(),
    hotel_preferences: form.hotel_preference.trim(),
    dietary: dietaryParts.join(' · '),
    secret_notes: form.secret_notes.trim(),
    dna_interests: form.dna_interests.trim(),
    dna_special_requests: form.dna_special_requests.trim(),
    dna_activity_level: form.dna_activity_level.trim(),
    client_type: form.client_type,
    client_tier: form.client_tier,
    total_trips: form.total_trips,
    referrals_count: form.referrals_count,
    lead_source: form.lead_source.trim(),
    is_influencer: form.is_influencer,
    is_leader: form.is_leader,
    influencer_followers: form.influencer_followers,
    influencer_commission: form.influencer_commission,
    platforms: form.platforms.trim(),
    content_focus: form.content_focus.trim(),
    profile_url: form.profile_url.trim(),
    sales_stage: normalizeSalesStage(form.sales_stage),
  }
}

/** Replace-only: never append. Keeps first occurrence of each DB id. */
function uniqueClientsById(rows: VipClientProfile[]): VipClientProfile[] {
  const seen = new Set<string>()
  const out: VipClientProfile[] = []
  for (const row of rows) {
    const id = String(row.id ?? '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(row)
  }
  return out
}

export default function ClientsLoyaltyPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [clients, setClients] = useState<VipClientProfile[]>([])
  const [activeTab, setActiveTab] = useState<ContactTabId>('all')
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [copyToast, setCopyToast] = useState('')
  const [errorToast, setErrorToast] = useState('')
  const [tripCounts, setTripCounts] = useState<Record<string, number>>({})
  const [profitTotals, setProfitTotals] = useState<Record<string, number>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const showErrorToast = (message: string) => {
    const msg = message.trim() || ar.loadErr
    setError(msg)
    setErrorToast(msg)
    window.setTimeout(() => setErrorToast(''), 6000)
  }

  const openClientProfile = useCallback(
    (row: VipClientProfile) => {
      if (row.id) router.push(`/crm/clients/${row.id}`)
    },
    [router],
  )

  const applyClientsReplace = useCallback((rows: VipClientProfile[]) => {
    // ALWAYS replace — never setClients(prev => [...prev, ...rows])
    setClients(uniqueClientsById(rows))
  }, [])

  /** Manual refresh after save — does not run on mount (avoids Strict Mode thrash). */
  const loadClients = useCallback(async () => {
    setError('')
    if (!supabase) {
      showErrorToast(ar.supabaseErr)
      setClients([])
      setTripCounts({})
      setProfitTotals({})
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const token = await getClientAccessToken()
      await syncLegacyGroupMemberDnaAction(token).catch((err) =>
        console.warn('[CRM clients] legacy DNA backfill:', err),
      )
      const result = await fetchClientDirectoryAction(token)
      if (!result.ok) {
        throw new Error(result.error || ar.loadErr)
      }

      applyClientsReplace(result.rows)

      const ids = uniqueClientsById(result.rows).map((c) => String(c.id))
      try {
        const [counts, profits] = await Promise.all([
          countClientTripsByClientIds(ids),
          sumClientTripProfitByClientIds(ids),
        ])
        setTripCounts(counts)
        setProfitTotals(profits)
      } catch (tripErr) {
        console.error('[CRM clients] trip stats failed', tripErr)
        setTripCounts({})
        setProfitTotals({})
      }
    } catch (e) {
      console.error('[CRM clients] loadClients failed', e)
      const msg = e instanceof Error ? e.message : ar.loadErr
      showErrorToast(msg)
      setClients([])
      setTripCounts({})
      setProfitTotals({})
    } finally {
      setLoading(false)
    }
  }, [applyClientsReplace])

  // Mount-only fetch — empty deps; REPLACE state only (never append)
  useEffect(() => {
    let isMounted = true

    const fetchData = async () => {
      if (!isMounted) return
      setLoading(true)
      setError('')

      if (!supabase) {
        if (isMounted) {
          showErrorToast(ar.supabaseErr)
          setClients([])
          setTripCounts({})
          setProfitTotals({})
          setLoading(false)
        }
        return
      }

      try {
        const token = await getClientAccessToken()

        const memberSync = await runGroupMembersClientSyncOnce().catch((err) => {
          console.warn('[CRM clients] group_members → clients sync:', err)
          return null
        })
        if (memberSync?.ok && (memberSync.created > 0 || memberSync.linked > 0)) {
          console.info(
            `[CRM clients] group_members → clients: created=${memberSync.created}, linked=${memberSync.linked}`,
          )
        } else if (memberSync && !memberSync.ok) {
          console.warn('[CRM clients] group_members → clients:', memberSync.error)
        }

        const backfill = await syncLegacyGroupMemberDnaAction(token)
        if (backfill.ok && backfill.synced > 0) {
          console.info(
            `[CRM clients] legacy group DNA backfill: synced=${backfill.synced}, linked=${backfill.linked}`,
          )
        } else if (!backfill.ok) {
          console.warn('[CRM clients] legacy group DNA backfill:', backfill.error)
        }

        const result = await fetchClientDirectoryAction(token)
        if (!isMounted) return

        if (!result.ok) {
          throw new Error(result.error || ar.loadErr)
        }

        applyClientsReplace(result.rows)

        const ids = uniqueClientsById(result.rows).map((c) => String(c.id))
        try {
          const [counts, profits] = await Promise.all([
            countClientTripsByClientIds(ids),
            sumClientTripProfitByClientIds(ids),
          ])
          if (isMounted) {
            setTripCounts(counts)
            setProfitTotals(profits)
          }
        } catch (tripErr) {
          console.error('[CRM clients] trip stats failed', tripErr)
          if (isMounted) {
            setTripCounts({})
            setProfitTotals({})
          }
        }
      } catch (e) {
        console.error('[CRM clients] mount fetch failed', e)
        if (isMounted) {
          const msg = e instanceof Error ? e.message : ar.loadErr
          showErrorToast(msg)
          setClients([])
          setTripCounts({})
          setProfitTotals({})
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void fetchData()
    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem('crm_client_deleted_toast') === '1') {
      sessionStorage.removeItem('crm_client_deleted_toast')
      setCopyToast('تم حذف العميل بنجاح')
      window.setTimeout(() => setCopyToast(''), 2800)
    }
  }, [])

  const tabCounts = useMemo(() => countClientsByTab(clients), [clients])

  const filtered = useMemo(() => {
    const byTab = filterClientsByTab(clients, activeTab)
    return searchClients(byTab, search)
  }, [clients, activeTab, search])

  const emptyTabMessage = useMemo(() => {
    if (search.trim()) return ar.noMatch
    if (activeTab === 'clients') return ar.emptyTabClients
    if (clients.length === 0) return ar.emptyTabAll
    return ar.noMatch
  }, [activeTab, search, clients.length])

  const openAdd = () => {
    setError('')
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (c: VipClientProfile) => {
    setError('')
    setEditingId(c.id)
    setForm(clientToForm(c))
    setShowModal(true)
  }

  const handleDeleteClient = async (client: VipClientProfile) => {
    if (!client?.id) return

    const confirmDelete = window.confirm(ar.deleteConfirm)
    if (!confirmDelete) return

    setDeletingId(client.id)
    try {
      // Service-role delete — awaits DB confirmation before touching React state
      const result = await deleteClientAction(client.id)

      if (!result.ok) {
        const msg = result.error || ar.deleteFail
        if (msg.includes('عروض أسعار') || msg.includes('رحلات مرتبطة')) {
          toast.error(ar.deleteConstraintErr)
        } else {
          toast.error(msg)
        }
        console.error('[CRM clients] delete failed:', result.error)
        return
      }

      const removedId = String(result.deletedId || client.id)
      setClients((prev) => prev.filter((c) => String(c.id) !== removedId && String(c.id) !== String(client.id)))
      setTripCounts((prev) => {
        const next = { ...prev }
        delete next[client.id]
        delete next[removedId]
        return next
      })
      setProfitTotals((prev) => {
        const next = { ...prev }
        delete next[client.id]
        delete next[removedId]
        return next
      })
      setCopyToast(ar.deleteOk)
      window.setTimeout(() => setCopyToast(''), 2800)
    } catch (e) {
      console.error('[CRM clients] delete failed', e)
      toast.error(e instanceof Error ? e.message : ar.deleteFail)
    } finally {
      setDeletingId(null)
    }
  }

  const closeModal = () => {
    if (saving) return
    setShowModal(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const schemaError = (msg: string) =>
    msg.includes('name') ||
    msg.includes('client_tier') ||
    msg.includes('client_type') ||
    msg.includes('is_influencer') ||
    msg.includes('influencer_followers') ||
    msg.includes('influencer_commission') ||
    msg.includes('referral') ||
    msg.includes('lead_source') ||
    msg.includes('column') ||
    msg.includes('schema')

  const saveClient = async () => {
    if (!supabase) {
      showErrorToast(ar.supabaseErr)
      return
    }
    if (!form.name.trim()) return

    setSaving(true)
    setError('')

    try {
      if (editingId) {
        const payload = buildClientUpdatePayload(form)
        const { data, error: err } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', editingId)
          .select('id')
          .maybeSingle()

        if (err) {
          const msg = schemaError(err.message ?? '')
            ? ar.updateSchemaErr
            : err.message || ar.updateErr
          console.error('[CRM clients] update failed', { editingId, payload, error: err })
          setError(msg)
          showErrorToast(msg)
          return
        }

        if (!data?.id) {
          const msg = 'تعذر التحقق من حفظ التعديلات — تحقق من صلاحيات Supabase.'
          console.error('[CRM clients] update returned no row', { editingId, payload })
          setError(msg)
          showErrorToast(msg)
          return
        }

        const clientPatch = formToClientPatch(form)
        setClients((prevClients) =>
          prevClients.map((client) =>
            client.id === editingId ? { ...client, ...clientPatch } : client,
          ),
        )
        setShowModal(false)
        setEditingId(null)
        setForm(EMPTY_FORM)
        void loadClients()
        return
      }

      const payload = buildClientInsertPayload(form)
      const { data, error: err } = await supabase.from('clients').insert(payload).select('id').single()

      if (err || !data) {
        const msg = err?.message ?? ''
        const display = schemaError(msg) ? ar.insertSchemaErr : err?.message || ar.insertErr
        console.error('[CRM clients] insert failed', { payload, error: err })
        setError(display)
        showErrorToast(display)
        return
      }

      await supabase.from('client_preferences').insert({ client_id: data.id })
      setShowModal(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
      await loadClients()
    } catch (e) {
      console.error('[CRM clients] saveClient failed', e)
      const msg = e instanceof Error ? e.message : ar.updateErr
      setError(msg)
      showErrorToast(msg)
    } finally {
      setSaving(false)
    }
  }

  const isEditing = Boolean(editingId)

  return (
    <div dir="rtl" className="min-h-0 bg-[#F9FAFB] pb-8 font-sans dark:bg-[#1A2421] sm:pb-12">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex flex-col gap-4 rounded-2xl bg-slate-900 p-4 text-white shadow-sm sm:flex-row sm:justify-between sm:p-6 dark:border dark:border-[#D4AF37]/30 dark:!bg-[#22302C] dark:text-[#D4AF37]">
          <div className="space-y-1.5">
            <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/50 dark:text-[#D4AF37]/80">
              <Crown className="h-3.5 w-3.5" aria-hidden />
              {ar.loyalty}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl dark:text-gray-100">
              {ar.title}
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-white/70 dark:text-gray-300">
              {ar.subtitle}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => {
                const source = filtered.length ? filtered : clients
                if (!source.length) {
                  showErrorToast(ar.exportCsvEmpty)
                  return
                }
                exportClientsToCSV(source)
                setCopyToast(ar.exportCsvOk)
                window.setTimeout(() => setCopyToast(''), 3000)
              }}
              disabled={loading || clients.length === 0}
              className={`${BTN_SECONDARY} w-full border-white/20 !bg-white/10 !text-white hover:!bg-white/20 sm:w-auto dark:!border-[#D4AF37]/30 dark:!bg-[#1A2421] dark:!text-[#D4AF37]`}
            >
              <Download className="h-4 w-4 opacity-70" aria-hidden />
              {ar.exportCsv}
            </button>
          </div>
        </header>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 ring-1 ring-rose-600/10 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200"
          >
            {error}
          </div>
        ) : null}

        <div className="mb-2 w-full">
          <div className={`mb-4 md:mb-6 ${CRM_FILTER_BAR}`}>
            <label className="relative w-full sm:max-w-md md:w-96">
              <Search
                className="pointer-events-none absolute right-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 dark:text-slate-500"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={ar.searchPhUnified}
                className={`${CRM_INPUT} pr-10`}
                autoComplete="off"
              />
            </label>

            <div className="flex w-full flex-wrap items-stretch gap-3 sm:w-auto sm:items-center">
              <div
                className="flex min-h-[44px] items-center rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-[#2D3F3A] dark:bg-[#1A2421]"
                role="group"
                aria-label="طريقة العرض"
              >
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  aria-pressed={viewMode === 'cards'}
                  title="عرض البطاقات"
                  className={
                    viewMode === 'cards'
                      ? 'inline-flex min-h-[40px] min-w-[44px] items-center justify-center rounded-md bg-white px-3 py-1.5 text-slate-900 shadow-sm transition-all dark:bg-[#22302C] dark:text-[#D4AF37]'
                      : 'inline-flex min-h-[40px] min-w-[44px] items-center justify-center px-3 py-1.5 text-slate-500 transition-all hover:text-slate-700 dark:text-slate-400 dark:hover:text-gray-300'
                  }
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden />
                  <span className="sr-only">بطاقات</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  aria-pressed={viewMode === 'table'}
                  title="عرض الجدول"
                  className={
                    viewMode === 'table'
                      ? 'inline-flex min-h-[40px] min-w-[44px] items-center justify-center rounded-md bg-white px-3 py-1.5 text-slate-900 shadow-sm transition-all dark:bg-[#22302C] dark:text-[#D4AF37]'
                      : 'inline-flex min-h-[40px] min-w-[44px] items-center justify-center px-3 py-1.5 text-slate-500 transition-all hover:text-slate-700 dark:text-slate-400 dark:hover:text-gray-300'
                  }
                >
                  <Table2 className="h-4 w-4" aria-hidden />
                  <span className="sr-only">جدول</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
                aria-controls="clients-filter-tabs"
                className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-sm transition-colors sm:flex-none ${
                  filtersOpen || activeTab !== 'all'
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-[#D4AF37]/50 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-gray-300 dark:hover:bg-[#1A2421]'
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
                {ar.filterBtn}
              </button>
              <button
                type="button"
                onClick={openAdd}
                className={`${BTN_PRIMARY} flex-1 sm:flex-none`}
              >
                <Plus className="h-4 w-4" aria-hidden />
                {ar.addClientShort}
              </button>
            </div>
          </div>

          {filtersOpen ? (
            <div id="clients-filter-tabs" className="mb-4">
              <ContactFilterTabs
                activeTab={activeTab}
                onChange={setActiveTab}
                counts={tabCounts}
              />
            </div>
          ) : null}

          {!loading ? (
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              {ar.resultCountUnified
                .replace('{n}', String(filtered.length))
                .replace('{m}', String(clients.length))}
            </p>
          ) : null}
        </div>

        {loading ? (
          <div className={`flex min-h-[240px] flex-col items-center justify-center gap-3 py-14 ${CARD}`}>
            <Loader2 className="h-7 w-7 animate-spin text-slate-400 dark:text-[#D4AF37]" aria-hidden />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{ar.loading}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${CARD} border-dashed px-6 py-14 text-center`}>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{emptyTabMessage}</p>
          </div>
        ) : viewMode === 'cards' ? (
          <div className={`crm-stagger ${CRM_CARD_GRID}`}>
            {filtered.map((c) => (
              <ClientCard
                key={String(c.id)}
                client={c}
                trips={tripCounts[c?.id ?? ''] ?? c?.total_trips ?? 0}
                deletingId={deletingId}
                manageProfileLabel={ar.manageProfile}
                noContactLabel={ar.noContact}
                editLabel={ar.edit}
                deleteLabel={ar.delete}
                onOpenProfile={openClientProfile}
                onEdit={openEdit}
                onDelete={(client) => void handleDeleteClient(client)}
                onSalesStageUpdated={(clientId, stage) => {
                  setClients((prev) =>
                    prev.map((row) =>
                      row.id === clientId ? { ...row, sales_stage: stage || '' } : row,
                    ),
                  )
                }}
              />
            ))}
          </div>
        ) : (
          <div className={CRM_TABLE_SCROLL}>
            <table className={CRM_TABLE}>
              <thead className="bg-slate-50 text-sm text-slate-500 dark:bg-[#1A2421] dark:text-slate-400">
                <tr className="border-b border-slate-200 dark:border-[#2D3F3A]">
                  <th className="whitespace-nowrap px-6 py-4 font-semibold">العميل</th>
                  <th className="whitespace-nowrap px-6 py-4 font-semibold">التواصل</th>
                  <th className="whitespace-nowrap px-6 py-4 font-semibold">CLV</th>
                  <th className="whitespace-nowrap px-6 py-4 font-semibold">الشريحة</th>
                  <th className="whitespace-nowrap px-6 py-4 font-semibold">التفاعل</th>
                  <th className="whitespace-nowrap px-6 py-4 font-semibold">المرحلة</th>
                  <th className="whitespace-nowrap px-6 py-4 font-semibold">الرحلات</th>
                  <th className="whitespace-nowrap px-6 py-4 font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const tier = clientDisplayTierBadge(c)
                  const clv = resolveClientLifetimeValue(c)
                  const trips = tripCounts[c?.id ?? ''] ?? c?.total_trips ?? 0
                  const engagement = c.engagement_status
                  const wa = c.phone_wa?.trim() ? whatsAppHref(c.phone_wa) : null
                  return (
                    <tr
                      key={String(c.id)}
                      className="cursor-pointer border-b border-slate-100 transition-colors duration-150 hover:bg-slate-50/50 dark:border-[#2D3F3A] dark:hover:bg-[#1A2421]/50"
                      onClick={() => openClientProfile(c)}
                    >
                      <td className="px-6 py-4 text-sm text-slate-900 dark:text-gray-100">
                        <div className="flex items-center gap-2">
                          {engagement ? (
                            <span
                              className={`h-2.5 w-2.5 shrink-0 rounded-full ${engagementDotClass(engagement)}`}
                              title={engagementStatusLabel(engagement)}
                            />
                          ) : null}
                          <div>
                            <p className="font-bold">{c.name ?? '—'}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {parseTravelDnaChips({
                                travel_dna: c.travel_dna,
                                dna_interests: c.dna_interests,
                                dna_activity_level: c.dna_activity_level,
                                food_allergies: c.food_allergies,
                                dietary: c.dietary,
                                tags: c.tags,
                              })
                                .slice(0, 3)
                                .map((chip) => (
                                  <span
                                    key={chip.key}
                                    className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-600 dark:bg-[#1A2421] dark:text-slate-400"
                                  >
                                    {chip.label}
                                  </span>
                                ))}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td
                        className="px-6 py-4 text-sm text-slate-900 dark:text-gray-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-col gap-1">
                          {c?.phone_wa ? (
                            <a
                              href={`tel:${c.phone_wa.replace(/\s+/g, '')}`}
                              dir="ltr"
                              className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-[#D4AF37]"
                            >
                              <Phone className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                              {c.phone_wa}
                            </a>
                          ) : null}
                          {c?.email ? (
                            <a
                              href={`mailto:${c.email}`}
                              dir="ltr"
                              title={c.email}
                              className="inline-flex max-w-[14rem] items-center gap-1.5 truncate text-xs text-slate-500 transition hover:text-slate-800 dark:text-slate-400"
                            >
                              <Mail className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                              {c.email}
                            </a>
                          ) : null}
                          {!c?.phone_wa && !c?.email ? (
                            <span className="text-xs text-slate-400">{ar.noContact}</span>
                          ) : null}
                        </div>
                      </td>
                      <td
                        className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900 dark:text-gray-100"
                        dir="ltr"
                      >
                        {formatSarClv(clv)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span className={`inline-flex items-center gap-1 ${tier.className}`}>
                          {c.client_tier === 'vip' || c.client_tier === 'vvip' ? (
                            <Crown className="h-3 w-3" aria-hidden />
                          ) : null}
                          {tier.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {engagementStatusLabel(engagement)}
                      </td>
                      <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                        <ClientSalesStageControl
                          clientId={c.id}
                          value={c.sales_stage ?? ''}
                          compact
                          className="min-w-0"
                          onUpdated={(stage) => {
                            setClients((prev) =>
                              prev.map((row) =>
                                row.id === c.id ? { ...row, sales_stage: stage || '' } : row,
                              ),
                            )
                          }}
                        />
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900 dark:text-gray-100">
                        {trips}
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {wa ? (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="واتساب"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-600 hover:text-white dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                            >
                              <MessageCircle className="h-4 w-4" aria-hidden />
                            </a>
                          ) : (
                            <ClientPaymentWhatsAppButton
                              clientId={c.id}
                              clientName={c.name ?? '—'}
                              phone={c.phone_wa}
                              targetTrip={c.target_trip}
                              salesStage={c.sales_stage}
                              compact
                              className="shrink-0"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => openClientProfile(c)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-900 transition-all hover:bg-slate-900 hover:text-white dark:border-[#D4AF37]/50 dark:bg-transparent dark:text-[#D4AF37] hover:dark:bg-[#D4AF37]/10"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden />
                            {ar.viewProfile}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(c)}
                            disabled={deletingId === c?.id}
                            title={ar.edit}
                            aria-label={`${ar.edit} ${c?.name ?? ''}`}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-[#1A2421] dark:hover:text-[#D4AF37]"
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteClient(c)}
                            disabled={deletingId === c?.id}
                            title={ar.delete}
                            aria-label={`${ar.delete} ${c?.name ?? ''}`}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-rose-950/30 dark:hover:text-red-400"
                          >
                            {deletingId === c?.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="h-4 w-4" aria-hidden />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {copyToast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[200] w-[min(100%,20rem)] -translate-x-1/2 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-3.5 text-center text-sm font-medium text-emerald-800 shadow-lg ring-1 ring-emerald-600/20"
        >
          {copyToast}
        </div>
      ) : null}

      {errorToast ? (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-[201] w-[min(100%,24rem)] -translate-x-1/2 rounded-2xl border border-red-300/60 bg-red-950 px-5 py-3.5 text-center text-sm font-bold text-red-100 shadow-[0_20px_60px_rgba(127,29,29,0.55)]"
        >
          {errorToast}
        </div>
      ) : null}

      {showModal && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="crm-modal-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-labelledby="client-modal-title"
              onClick={closeModal}
            >
              <div
                className="relative my-auto w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2D3F3A] bg-[#1A2421] p-6 shadow-2xl duration-200 animate-in fade-in zoom-in-95 sm:p-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4 flex items-start justify-between gap-4 sm:mb-6">
                  <div>
                    <h2 id="client-modal-title" className="text-lg font-semibold text-gray-100 sm:text-xl">
                      {isEditing ? ar.editTitle : ar.addTitle}
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">{ar.modalHint}</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#22302C] text-slate-400 transition hover:bg-[#2A3834] hover:text-gray-100 disabled:opacity-50"
                    aria-label={ar.close}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {error ? (
                  <div
                    role="alert"
                    className="mb-4 rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm font-bold text-red-100"
                  >
                    {error}
                  </div>
                ) : null}

                <div className="space-y-4 pb-6">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {ar.fullName}
                </span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={MODAL_FIELD}
                  dir="rtl"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    {ar.clientSegment}
                  </span>
                  <select
                    value={form.client_tier}
                    onChange={(e) => setForm({ ...form, client_tier: e.target.value as ClientTier })}
                    className={MODAL_FIELD}
                  >
                    {CLIENT_SEGMENT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    {ar.referralSource}
                  </span>
                  <select
                    value={form.lead_source}
                    onChange={(e) => setForm({ ...form, lead_source: e.target.value })}
                    className={MODAL_FIELD}
                  >
                    <option value="" disabled>
                      {ar.referralSourcePlaceholder}
                    </option>
                    {LEAD_SOURCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{ar.salesStage}</span>
                <select
                  value={form.sales_stage}
                  onChange={(e) => setForm({ ...form, sales_stage: e.target.value })}
                  className={MODAL_FIELD}
                >
                  <option value="" disabled>
                    {ar.salesStagePlaceholder}
                  </option>
                  {CLIENT_SALES_STAGES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.emoji} {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#2D3F3A] dark:bg-[#1A2421]/60">
                <p className="text-xs font-semibold text-slate-700 dark:text-[#D4AF37]">{ar.loyaltySection}</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{ar.trips}</span>
                    <input
                      type="number"
                      min={0}
                      value={form.total_trips}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          total_trips: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className={MODAL_FIELD}
                      dir="ltr"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{ar.referrals}</span>
                    <input
                      type="number"
                      min={0}
                      value={form.referrals_count}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          referrals_count: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className={MODAL_FIELD}
                      dir="ltr"
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{ar.phone}</span>
                  <input
                    value={form.phone_wa}
                    onChange={(e) => setForm({ ...form, phone_wa: e.target.value })}
                    className={MODAL_FIELD}
                    dir="ltr"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{ar.email}</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={MODAL_FIELD}
                    dir="ltr"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{ar.birthday}</span>
                  <input
                    type="date"
                    value={form.birth_date}
                    onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                    className={`${MODAL_FIELD} [color-scheme:light]`}
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{ar.dnaFlight}</span>
                <input
                  value={form.flight_seat}
                  onChange={(e) => setForm({ ...form, flight_seat: e.target.value })}
                  placeholder="نافذة، ممر…"
                  className={MODAL_FIELD}
                  dir="rtl"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{ar.dnaDietary}</span>
                <textarea
                  value={form.food_allergies}
                  onChange={(e) => setForm({ ...form, food_allergies: e.target.value })}
                  rows={2}
                  className={`${MODAL_FIELD} resize-y`}
                  dir="rtl"
                />
              </label>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{ar.dnaHotel}</span>
                  <select
                    value={form.hotel_preference}
                    onChange={(e) => setForm({ ...form, hotel_preference: e.target.value })}
                    className={MODAL_FIELD}
                  >
                    <option value="">— لم يحدد —</option>
                    {ONBOARDING_HOTEL_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{ar.dnaFavoriteDrink}</span>
                  <input
                    value={form.favorite_drink}
                    onChange={(e) => setForm({ ...form, favorite_drink: e.target.value })}
                    placeholder="قهوة، شاي…"
                    className={MODAL_FIELD}
                    dir="rtl"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{ar.dnaPassport}</span>
                <input
                  type="date"
                  value={form.passport_expiry}
                  onChange={(e) => setForm({ ...form, passport_expiry: e.target.value })}
                  className={`${MODAL_FIELD} [color-scheme:light]`}
                  dir="ltr"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{ar.dnaSecret}</span>
                <textarea
                  value={form.secret_notes}
                  onChange={(e) => setForm({ ...form, secret_notes: e.target.value })}
                  rows={3}
                  className={`${MODAL_FIELD} resize-y`}
                  dir="rtl"
                />
              </label>

              <ClientDnaAdvancedFieldsEditor
                value={{
                  dna_interests: form.dna_interests,
                  dna_special_requests: form.dna_special_requests,
                  dna_activity_level: form.dna_activity_level,
                }}
                onChange={(dna) =>
                  setForm({
                    ...form,
                    dna_interests: dna.dna_interests,
                    dna_special_requests: dna.dna_special_requests,
                    dna_activity_level: dna.dna_activity_level,
                  })
                }
                fieldClassName={CRM_FIELD}
              />

              {isEditing ? (
                <ClientDnaSmartEventRecommendations
                  dnaInterests={form.dna_interests}
                  compact
                />
              ) : null}
            </div>

            <div className="mt-6 flex gap-3 pb-2">
              <button
                type="button"
                onClick={() => void saveClient()}
                disabled={saving || !form.name.trim()}
                className={`${BTN_PRIMARY} flex-1`}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    {ar.saving}
                  </>
                ) : isEditing ? (
                  ar.saveEdit
                ) : (
                  ar.saveNew
                )}
              </button>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className={BTN_SECONDARY}
              >
                {ar.cancel}
              </button>
            </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
