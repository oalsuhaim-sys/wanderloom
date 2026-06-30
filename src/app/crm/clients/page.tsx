'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Activity,
  Building2,
  ChevronDown,
  Crown,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Phone,
  Plane,
  Plus,
  Search,
  Trash2,
  MessageSquare,
  Tags,
  UtensilsCrossed,
  X,
} from 'lucide-react'

import VipSpendingTierBadge from '@/components/VipSpendingTierBadge'
import ReferralCodeBadge from '@/app/crm/clients/_components/ReferralCodeBadge'
import ReferralQrModal from '@/app/crm/clients/_components/ReferralQrModal'
import ContactFilterTabs from '@/app/crm/clients/_components/ContactFilterTabs'
import ClientDnaAdvancedDisplay from '@/app/crm/clients/_components/ClientDnaAdvancedDisplay'
import ClientDnaAdvancedFieldsEditor from '@/app/crm/clients/_components/ClientDnaAdvancedFieldsEditor'
import ClientDnaSmartEventRecommendations from '@/app/crm/clients/_components/ClientDnaSmartEventRecommendations'
import ClientPaymentWhatsAppButton from '@/app/crm/clients/_components/ClientPaymentWhatsAppButton'
import ClientSalesStageControl from '@/app/crm/clients/_components/ClientSalesStageControl'
import ClientTargetTripBadge from '@/app/crm/clients/_components/ClientTargetTripBadge'
import InfluencerStatsSection from '@/app/crm/clients/_components/InfluencerStatsSection'
import { countClientTripsByClientIds, sumClientTripProfitByClientIds } from '@/lib/client-trips-crm'
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
  CLIENT_INFLUENCER_COLUMNS,
  CLIENT_TIER_OPTIONS,
  CLIENT_TYPE_OPTIONS,
  clientTypeEmoji,
  DEFAULT_CLIENT_TYPE,
  isInfluencerClient,
  isLeaderClient,
  normalizeVipClient,
  shouldShowInfluencerCardSection,
  type ClientTier,
  type ClientType,
  type VipClientProfile,
} from '@/lib/clientsTravelDna'
import {
  CLIENT_SALES_STAGES,
  normalizeSalesStage,
  salesStageSelectClass,
} from '@/lib/client-sales-stage'
import { LEAD_SOURCE_OPTIONS, LEAD_SOURCE_SELECT_CLASS } from '@/lib/lead-source'

const ar = {
  "loyalty": "نظام الولاء",
  "title": "قاعدة العملاء ونظام الولاء",
  "subtitle": "شرائح العملاء، إحصائيات الرحلات والإحالات، وأكواد الإحالة — مع ملف الـ DNA السياحي لكل عميل.",
  "addBtn": "إضافة عميل جديد",
  "searchPh": "بحث بالاسم، الشريحة، كود الإحالة، الهاتف، أو التفضيلات…",
  "searchPhUnified": "بحث في العملاء، الليدرز، والمؤثرين…",
  "loading": "جاري تحميل قاعدة العملاء…",
  "empty": "لا يوجد عملاء بعد — أضف أول عميل من الزر أعلاه.",
  "noMatch": "لا توجد نتائج مطابقة للبحث.",
  "noContact": "لا توجد بيانات اتصال",
  "refCode": "كود الإحالة",
  "copyRef": "نسخ كود الإحالة",
  "noRef": "لا يوجد كود إحالة",
  "openProfile": "فتح الملف الكامل ←",
  "edit": "تعديل",
  "delete": "حذف",
  "deleteConfirm": "هل أنت متأكد من حذف هذا العميل نهائياً؟",
  "deleteConstraintErr": "عذراً، لا يمكن حذف هذا العميل لوجود عروض أسعار أو رحلات مرتبطة به.",
  "editTitle": "تعديل بيانات العميل",
  "addTitle": "إضافة عميل جديد",
  "modalHint": "يُحفظ الاسم في name مع بيانات الولاء والـ DNA",
  "close": "إغلاق",
  "fullName": "الاسم الكامل *",
  "loyaltySection": "الولاء والشرائح",
  "tier": "الشريحة",
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
  "resultCountUnified": "{n} من {m} جهة اتصال",
  "emptyTabClients": "لا يوجد عملاء في هذه القائمة بعد.",
  "emptyTabLeaders": "لا يوجد ليدرز بكود إحالة بعد.",
  "emptyTabInfluencers": "لا يوجد مؤثرون في هذه القائمة بعد.",
  "clientType": "نوع جهة الاتصال",
  "influencerSection": "بيانات المؤثر",
  "platforms": "المنصات (سناب، إنستغرام…)",
  "followers": "عدد المتابعين",
  "influencerCommission": "عمولة الإحالة (%)",
  "contentFocus": "المحتوى / التخصص",
  "profileUrl": "رابط الحساب",
  "emptyTabAll": "لا توجد جهات اتصال بعد.",
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
  'w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#001f3f]/40 focus:ring-2 focus:ring-[#d4af37]/45 [color-scheme:light]'

const CLIENT_SELECT_CORE =
  'id, name, phone_wa, email, birth_date, flight_seat, food_allergies, favorite_drink, hotel_preference, passport_expiry, flight_preferences, hotel_preferences, dietary, secret_notes, dna_interests, dna_special_requests, dna_activity_level, travel_dna, created_at, client_type, client_tier, total_trips, referrals_count, referral_code, ref_code, lead_source, is_leader, sales_stage, used_code, target_trip, tags'

const CLIENT_SELECT_FALLBACK =
  `${CLIENT_SELECT_CORE}, ${CLIENT_INFLUENCER_COLUMNS}`

const CLIENT_LIST_SELECT =
  `${CLIENT_SELECT_FALLBACK}, total_spent, total_profit, vip_tier, wallet_balance, tags, onboarding_completed`

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

function CollapsibleSection({
  title,
  icon,
  children,
  muted = false,
  premiumNote = false,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
  muted?: boolean
  premiumNote?: boolean
}) {
  const [open, setOpen] = useState(false)
  const text = String(children ?? '').trim()
  const hasContent = Boolean(text && text !== '\u2014')

  return (
    <div className="border-t border-gray-100/90 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 py-3 text-right transition hover:bg-gray-50/80"
      >
        <span className="flex items-center gap-2 text-xs font-bold tracking-wide text-[#001f3f]">
          <span className="text-[#d4af37]">{icon}</span>
          {title}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          {premiumNote ? (
            <div className="pb-3">
              <div className="mt-2 rounded-lg border border-[#D4AF37]/30 bg-[#FEFDF9] p-3 shadow-sm">
                <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-gray-800">
                  {hasContent ? text : 'لا توجد ملاحظات سرية.'}
                </p>
              </div>
            </div>
          ) : (
            <p
              className={`pb-3 text-sm leading-relaxed ${muted ? 'italic text-gray-500' : 'text-gray-700'} ${!hasContent ? 'text-gray-400' : ''}`}
            >
              {hasContent ? children : '\u2014'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ClientsLoyaltyPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [clients, setClients] = useState<VipClientProfile[]>([])
  const [activeTab, setActiveTab] = useState<ContactTabId>('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [copyToast, setCopyToast] = useState('')
  const [errorToast, setErrorToast] = useState('')
  const [tripCounts, setTripCounts] = useState<Record<string, number>>({})
  const [profitTotals, setProfitTotals] = useState<Record<string, number>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [qrModal, setQrModal] = useState<{ code: string; name: string } | null>(null)

  const showErrorToast = (message: string) => {
    const msg = message.trim() || ar.loadErr
    setError(msg)
    setErrorToast(msg)
    window.setTimeout(() => setErrorToast(''), 6000)
  }

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
      let data: Record<string, unknown>[] | null = null
      let fetchError: { message?: string } | null = null

      const primary = await supabase
        .from('clients')
        .select(CLIENT_LIST_SELECT)
        .order('created_at', { ascending: false })

      if (!primary.error) {
        data = (primary.data ?? []) as unknown as Record<string, unknown>[]
      } else {
        fetchError = primary.error
        const msg = String(primary.error.message ?? '').toLowerCase()
        const missingColumn =
          msg.includes('column') ||
          msg.includes('schema cache') ||
          msg.includes('does not exist')

        if (missingColumn) {
          const fallback = await supabase
            .from('clients')
            .select(CLIENT_SELECT_FALLBACK)
            .order('created_at', { ascending: false })
          if (!fallback.error) {
            data = (fallback.data ?? []) as unknown as Record<string, unknown>[]
            fetchError = null
          } else {
            fetchError = fallback.error
          }
        }
      }

      if (fetchError) {
        throw new Error(fetchError.message || ar.loadErr)
      }

      const list = (data ?? [])
        .map((r) => normalizeVipClient(r))
        .filter((x): x is VipClientProfile => Boolean(x))
      setClients(list)

      const ids = list.map((c) => String(c.id))
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
  }, [])

  useEffect(() => {
    void loadClients()
  }, [loadClients])

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
    if (activeTab === 'leaders') return ar.emptyTabLeaders
    if (activeTab === 'influencers') return ar.emptyTabInfluencers
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
    if (!supabase || !client?.id) return

    const confirmDelete = window.confirm(ar.deleteConfirm)
    if (!confirmDelete) return

    setDeletingId(client.id)
    try {
      const { error: err } = await supabase.from('clients').delete().eq('id', client.id)

      if (err) {
        const msg = (err.message ?? '').toLowerCase()
        if (
          msg.includes('foreign key') ||
          msg.includes('violates') ||
          msg.includes('constraint') ||
          msg.includes('23503')
        ) {
          alert(ar.deleteConstraintErr)
        } else {
          alert(err.message || ar.loadErr)
        }
        return
      }

      setClients((prev) => prev.filter((c) => c.id !== client.id))
      setTripCounts((prev) => {
        const next = { ...prev }
        delete next[client.id]
        return next
      })
      setProfitTotals((prev) => {
        const next = { ...prev }
        delete next[client.id]
        return next
      })
    } catch (e) {
      console.error('[CRM clients] delete failed', e)
      alert(e instanceof Error ? e.message : ar.loadErr)
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

  const copyReferralCode = async (code: string) => {
    if (!code.trim()) return
    try {
      await navigator.clipboard.writeText(code.trim())
      setCopyToast(ar.copyOk)
      window.setTimeout(() => setCopyToast(''), 2800)
    } catch {
      setError(ar.copyFail + code)
    }
  }

  const isEditing = Boolean(editingId)

  return (
    <div dir="rtl" className="min-h-0 bg-gradient-to-b from-[#F6F4F0] via-[#FAF8F4] to-[#EDE8DD] pb-8 font-sans sm:pb-16">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-2xl border border-[#d4af37]/25 bg-gradient-to-br from-white via-white to-amber-50/50 p-4 shadow-[0_24px_64px_-28px_rgba(0,31,63,0.35)] sm:mb-8 sm:rounded-3xl sm:p-6 md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-6">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#d4af37]/40 bg-[#001f3f]/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#001f3f]">
                <Crown className="h-3.5 w-3.5 text-[#d4af37]" aria-hidden />
                {ar.loyalty}
              </p>
              <h1 className="text-2xl font-black tracking-tight text-[#001f3f] sm:text-3xl md:text-[2rem]">
                {ar.title}</h1>
              <p className="max-w-lg text-sm font-semibold leading-relaxed text-slate-600">
                {ar.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#001f3f] px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-[#001f3f]/20 transition hover:bg-[#002a55] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:ring-offset-2 sm:w-auto"
            >
              <Plus className="h-5 w-5 text-[#d4af37]" aria-hidden />
              {ar.addBtn}
            </button>
          </div>
        </header>

        {error ? (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-900"
          >
            {error}
          </div>
        ) : null}

        <div className="mb-8 space-y-4">
          <ContactFilterTabs
            activeTab={activeTab}
            onChange={setActiveTab}
            counts={tabCounts}
          />

          <label className="relative block">
            <Search
              className="pointer-events-none absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#d4af37]"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={ar.searchPhUnified}
              className={`${CRM_FIELD} h-12 pr-11`}
            />
          </label>
          {!loading ? (
            <p className="text-xs font-semibold text-slate-500">
              {ar.resultCountUnified
                .replace('{n}', String(filtered.length))
                .replace('{m}', String(clients.length))}
            </p>
          ) : null}
        </div>

        {loading ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/80 bg-white/80 py-16 shadow-sm">
            <Loader2 className="h-10 w-10 animate-spin text-[#001f3f]" aria-hidden />
            <p className="text-sm font-semibold text-slate-500">{ar.loading}</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-20 text-center text-sm font-medium text-slate-500">{emptyTabMessage}</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <article
                key={c.id}
                dir="rtl"
                className="flex flex-col overflow-hidden rounded-2xl border border-[#d4af37]/15 bg-white shadow-md transition-shadow duration-300 hover:shadow-lg"
              >
                <div className="border-b border-[#d4af37]/10 bg-gradient-to-l from-[#001f3f]/[0.03] to-transparent px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/crm/clients/${c.id}`}
                        className="block text-lg font-bold leading-snug text-[#001f3f] transition hover:text-[#002a55]"
                      >
                        {c.name ?? '—'}
                      </Link>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#D4AF37]/30 bg-white/90 px-2.5 py-1 text-[10px] font-black text-[#1c3d27]">
                          <span aria-hidden>
                            {isInfluencerClient(c) ? '🌟' : isLeaderClient(c) ? '🚀' : clientTypeEmoji(c.client_type)}
                          </span>
                          {isInfluencerClient(c) ? 'مؤثر' : isLeaderClient(c) ? 'ليدر' : c.client_type}
                        </span>

                        {c.target_trip?.trim() ? (
                          <ClientTargetTripBadge label={c.target_trip} className="min-w-0 shrink" />
                        ) : null}

                        {!isLeaderClient(c) && !isInfluencerClient(c) ? (
                          <ClientSalesStageControl
                            clientId={c.id}
                            value={c.sales_stage ?? ''}
                            compact
                            className="min-w-0 shrink"
                            onUpdated={(stage) => {
                              setClients((prev) =>
                                prev.map((row) =>
                                  row.id === c.id ? { ...row, sales_stage: stage || '' } : row,
                                ),
                              )
                            }}
                          />
                        ) : null}

                        <ClientPaymentWhatsAppButton
                          clientId={c.id}
                          clientName={c.name ?? '—'}
                          phone={c.phone_wa}
                          targetTrip={c.target_trip}
                          salesStage={c.sales_stage}
                          compact
                          className="min-w-0 shrink"
                        />
                      </div>

                      <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600">
                        {c?.phone_wa ? (
                          <div className="flex min-w-0 items-center gap-2 text-gray-700">
                            <Phone className="h-4 w-4 shrink-0 text-[#d4af37]" aria-hidden />
                            <a
                              href={`tel:${c.phone_wa.replace(/\s+/g, '')}`}
                              dir="ltr"
                              className="min-w-0 text-left font-medium text-[#001f3f] transition-colors hover:text-[#d4af37]"
                            >
                              {c.phone_wa}
                            </a>
                          </div>
                        ) : null}
                        {c?.email ? (
                          <div className="flex min-w-0 items-center gap-2 text-gray-700">
                            <Mail className="h-4 w-4 shrink-0 text-[#d4af37]" aria-hidden />
                            <a
                              href={`mailto:${c.email}`}
                              dir="ltr"
                              title={c.email}
                              className="min-w-0 max-w-full truncate text-left font-medium text-[#001f3f] transition-colors hover:text-[#d4af37]"
                            >
                              {c.email}
                            </a>
                          </div>
                        ) : null}
                        {!c?.phone_wa && !c?.email ? (
                          <span className="text-xs text-gray-400">{ar.noContact}</span>
                        ) : null}
                      </div>
                    </div>
                    <VipSpendingTierBadge
                      tier={c?.vip_tier ?? 'gold'}
                      totalProfit={profitTotals[c?.id ?? ''] ?? c?.total_profit ?? 0}
                      className="shrink-0"
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden>{'\u2708\uFE0F'}</span>
                      {ar.trips}: {tripCounts[c?.id ?? ''] ?? c?.total_trips ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden>{'\uD83E\uDD1D'}</span>
                      {ar.referrals}: {c?.referrals_count ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden>{'\uD83D\uDCB0'}</span>
                      {ar.totalProfit}:{' '}
                      {(profitTotals[c?.id ?? ''] ?? c?.total_profit ?? 0) > 0
                        ? `${(profitTotals[c?.id ?? ''] ?? c?.total_profit ?? 0).toLocaleString('ar-SA')} ر.س`
                        : '0 ر.س'}
                    </span>
                  </div>

                  {shouldShowInfluencerCardSection(c) ? (
                    <InfluencerStatsSection client={c} />
                  ) : null}

                  {c?.referral_code ? (
                    <ReferralCodeBadge
                      code={c.referral_code}
                      label={ar.refCode}
                      onCopy={() => void copyReferralCode(c.referral_code)}
                      onOpenQr={() =>
                        setQrModal({ code: c.referral_code, name: c.name ?? '—' })
                      }
                    />
                  ) : !isInfluencerClient(c) ? (
                    <p className="mt-3 text-[11px] font-semibold text-gray-400">{ar.noRef}</p>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col px-5 pb-4 pt-1">
                  <ClientDnaAdvancedDisplay client={c} className="mb-3" compact />
                  <CollapsibleSection title={ar.dnaFlight} icon={<Plane className="h-4 w-4" />}>
                    {c?.flight_seat?.trim() || c?.flight_preferences?.trim() || '—'}
                  </CollapsibleSection>
                  <CollapsibleSection title={ar.dnaHotel} icon={<Building2 className="h-4 w-4" />}>
                    {c?.hotel_preference?.trim() || c?.hotel_preferences?.trim() || '—'}
                  </CollapsibleSection>
                  <CollapsibleSection title={ar.dnaDietary} icon={<UtensilsCrossed className="h-4 w-4" />}>
                    {c?.food_allergies?.trim() ||
                      c?.dietary?.trim() ||
                      '—'}
                  </CollapsibleSection>
                  <CollapsibleSection title={ar.dnaFavoriteDrink} icon={<UtensilsCrossed className="h-4 w-4" />}>
                    {c?.favorite_drink?.trim() || '—'}
                  </CollapsibleSection>
                  <CollapsibleSection title={ar.dnaPassport} icon={<Lock className="h-4 w-4" />}>
                    {c?.passport_expiry?.trim() || '—'}
                  </CollapsibleSection>
                  <CollapsibleSection title={ar.dnaInterests} icon={<Tags className="h-4 w-4" />}>
                    {c?.dna_interests?.trim() || '—'}
                  </CollapsibleSection>
                  <CollapsibleSection title={ar.dnaActivity} icon={<Activity className="h-4 w-4" />}>
                    {c?.dna_activity_level?.trim() || '—'}
                  </CollapsibleSection>
                  <CollapsibleSection title={ar.dnaSpecial} icon={<MessageSquare className="h-4 w-4" />}>
                    {c?.dna_special_requests?.trim() || '—'}
                  </CollapsibleSection>
                  <CollapsibleSection title={ar.dnaSecret} icon={<Lock className="h-4 w-4" />} premiumNote>
                    {c?.secret_notes ?? '—'}
                  </CollapsibleSection>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-5 py-3">
                  <Link
                    href={`/crm/clients/${c?.id ?? ''}`}
                    className="text-xs font-bold text-[#001f3f]/70 underline decoration-[#d4af37]/50 underline-offset-4 transition hover:text-[#001f3f]"
                  >
                    {ar.openProfile}
                  </Link>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      disabled={deletingId === c?.id}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[#001f3f] transition hover:bg-gray-100 disabled:opacity-50"
                    >
                      <Pencil className="h-3.5 w-3.5 text-[#d4af37]" aria-hidden />
                      {ar.edit}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteClient(c)}
                      disabled={deletingId === c?.id}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 hover:text-red-800 disabled:opacity-50"
                      aria-label={`${ar.delete} ${c?.name ?? ''}`}
                    >
                      {deletingId === c?.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {ar.delete}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {copyToast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[200] w-[min(100%,20rem)] -translate-x-1/2 rounded-2xl border border-[#d4af37]/45 bg-gradient-to-br from-[#001f3f] via-[#0a1830] to-[#001f3f] px-5 py-3.5 text-center text-sm font-bold text-[#d4af37] shadow-[0_20px_60px_rgba(0,31,63,0.55)]"
        >
          {copyToast}
        </div>
      ) : null}

      <ReferralQrModal
        open={Boolean(qrModal)}
        onClose={() => setQrModal(null)}
        referralCode={qrModal?.code ?? ''}
        clientName={qrModal?.name}
      />

      {errorToast ? (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-[201] w-[min(100%,24rem)] -translate-x-1/2 rounded-2xl border border-red-300/60 bg-red-950 px-5 py-3.5 text-center text-sm font-bold text-red-100 shadow-[0_20px_60px_rgba(127,29,29,0.55)]"
        >
          {errorToast}
        </div>
      ) : null}

      {showModal ? (
        <div
          className="fixed inset-0 z-[300] flex items-end justify-center bg-[#001f3f]/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="client-modal-title"
          onClick={closeModal}
        >
          <div
            className="max-h-[92dvh] w-[95%] max-w-lg overflow-y-auto rounded-t-3xl border border-[#d4af37]/20 bg-white p-4 shadow-2xl sm:max-h-[90vh] sm:w-full sm:rounded-3xl sm:p-6 md:w-3/4 md:max-w-2xl lg:w-1/2 lg:max-w-3xl md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4 sm:mb-6">
              <div>
                <h2 id="client-modal-title" className="text-lg font-black text-[#001f3f] sm:text-xl">
                  {isEditing ? ar.editTitle : ar.addTitle}
                </h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">{ar.modalHint}</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200 disabled:opacity-50"
                aria-label={ar.close}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error ? (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800"
              >
                {error}
              </div>
            ) : null}

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.fullName}</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={CRM_FIELD}
                  dir="rtl"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.clientType}</span>
                <select
                  value={form.client_type}
                  onChange={(e) => {
                    const client_type = e.target.value as ClientType
                    setForm({
                      ...form,
                      client_type,
                      is_influencer: client_type === 'مؤثر',
                      is_leader: client_type === 'ليدر',
                    })
                  }}
                  className={CRM_FIELD}
                >
                  {CLIENT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.emoji} {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              {form.client_type === 'مؤثر' || form.is_influencer ? (
                <div className="rounded-2xl border border-[#d4af37]/15 bg-stone-50/80 p-4 space-y-4">
                  <p className="text-xs font-black text-[#001f3f]">{ar.influencerSection}</p>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.platforms}</span>
                    <input
                      value={form.platforms}
                      onChange={(e) => setForm({ ...form, platforms: e.target.value })}
                      placeholder="Snapchat، Instagram، TikTok…"
                      className={CRM_FIELD}
                      dir="rtl"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.followers}</span>
                      <input
                        type="number"
                        min={0}
                        value={form.influencer_followers || ''}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            influencer_followers: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        className={CRM_FIELD}
                        dir="ltr"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.influencerCommission}</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.influencer_commission || ''}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            influencer_commission: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className={CRM_FIELD}
                        dir="ltr"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.profileUrl}</span>
                    <input
                      value={form.profile_url}
                      onChange={(e) => setForm({ ...form, profile_url: e.target.value })}
                      placeholder="https://…"
                      className={CRM_FIELD}
                      dir="ltr"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.contentFocus}</span>
                    <input
                      value={form.content_focus}
                      onChange={(e) => setForm({ ...form, content_focus: e.target.value })}
                      placeholder="سفر، فاخر، عائلي…"
                      className={CRM_FIELD}
                      dir="rtl"
                    />
                  </label>
                </div>
              ) : null}

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.leadSource}</span>
                <select
                  value={form.lead_source}
                  onChange={(e) => setForm({ ...form, lead_source: e.target.value })}
                  className={LEAD_SOURCE_SELECT_CLASS}
                >
                  <option value="" disabled>
                    {ar.leadSourcePlaceholder}
                  </option>
                  {LEAD_SOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.salesStage}</span>
                <select
                  value={form.sales_stage}
                  onChange={(e) => setForm({ ...form, sales_stage: e.target.value })}
                  className={salesStageSelectClass(form.sales_stage)}
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

              <div className="rounded-2xl border border-[#d4af37]/15 bg-amber-50/40 p-4 space-y-4">
                <p className="text-xs font-black text-[#001f3f]">{ar.loyaltySection}</p>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.tier}</span>
                  <select
                    value={form.client_tier}
                    onChange={(e) => setForm({ ...form, client_tier: e.target.value as ClientTier })}
                    className={CRM_FIELD}
                  >
                    {CLIENT_TIER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.trips}</span>
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
                      className={CRM_FIELD}
                      dir="ltr"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.referrals}</span>
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
                      className={CRM_FIELD}
                      dir="ltr"
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.phone}</span>
                  <input
                    value={form.phone_wa}
                    onChange={(e) => setForm({ ...form, phone_wa: e.target.value })}
                    className={CRM_FIELD}
                    dir="ltr"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.email}</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={CRM_FIELD}
                    dir="ltr"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.birthday}</span>
                  <input
                    type="date"
                    value={form.birth_date}
                    onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                    className={`${CRM_FIELD} [color-scheme:light]`}
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.dnaFlight}</span>
                <input
                  value={form.flight_seat}
                  onChange={(e) => setForm({ ...form, flight_seat: e.target.value })}
                  placeholder="نافذة، ممر…"
                  className={CRM_FIELD}
                  dir="rtl"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.dnaDietary}</span>
                <textarea
                  value={form.food_allergies}
                  onChange={(e) => setForm({ ...form, food_allergies: e.target.value })}
                  rows={2}
                  className={`${CRM_FIELD} resize-y`}
                  dir="rtl"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.dnaHotel}</span>
                  <select
                    value={form.hotel_preference}
                    onChange={(e) => setForm({ ...form, hotel_preference: e.target.value })}
                    className={CRM_FIELD}
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
                  <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.dnaFavoriteDrink}</span>
                  <input
                    value={form.favorite_drink}
                    onChange={(e) => setForm({ ...form, favorite_drink: e.target.value })}
                    placeholder="قهوة، شاي…"
                    className={CRM_FIELD}
                    dir="rtl"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.dnaPassport}</span>
                <input
                  type="date"
                  value={form.passport_expiry}
                  onChange={(e) => setForm({ ...form, passport_expiry: e.target.value })}
                  className={`${CRM_FIELD} [color-scheme:light]`}
                  dir="ltr"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.dnaSecret}</span>
                <textarea
                  value={form.secret_notes}
                  onChange={(e) => setForm({ ...form, secret_notes: e.target.value })}
                  rows={3}
                  className={`${CRM_FIELD} resize-y`}
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

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => void saveClient()}
                disabled={saving || !form.name.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#001f3f] py-3.5 text-sm font-black text-white transition hover:bg-[#002a55] disabled:cursor-not-allowed disabled:opacity-50"
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
                className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-3.5 text-sm font-bold text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
              >
                {ar.cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
