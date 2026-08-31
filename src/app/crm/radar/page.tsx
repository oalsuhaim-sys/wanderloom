'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Inbox, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import {
  buildLazySupplierAlerts,
  buildPassportAlerts,
  buildSalesPipelinePulse,
  buildVipsInTransit,
  formatSarAmount,
  type LazySupplierAlert,
  type PassportAlert,
  type SalesPipelinePulse,
  type VipInTransit,
} from '@/lib/live-radar-dashboard';
import { fetchGroupOnboardingLeads, fetchInterestOnlyLeads, fetchNewCrmLeads, type CrmLeadRow, type CrmLeadWithIntake } from '@/lib/crm-leads';
import {
  fetchGroupFulfillmentClients,
  type GroupFulfillmentClient,
} from '@/lib/group-operations-radar';
import {
  fetchMarketingPublishingRadar,
  type MarketingPublishRadarItem,
} from '@/lib/marketing-publishing-radar';
import { supabase } from '@/lib/supabase';
import {
  anyJwtClockSkewError,
  recoverSupabaseSessionFromClockSkew,
} from '@/lib/supabase/auth-clock-skew';
import { subscribeCrmRealtimeRefresh } from '@/lib/crm-realtime-events';

import { useCrmEmployee } from '@/app/crm/_components/CrmEmployeeProvider';
import MarketingPublishingRadar from '@/app/crm/_components/MarketingPublishingRadar';
import {
  canAccessGroupOperations,
  canAccessRadarAppointments,
  canAccessRadarInbox,
} from '@/lib/crm-permissions';

import GroupOperationsFulfillment from './_components/GroupOperationsFulfillment';
import { InterestListInbox } from './_components/InterestListInbox';
import { GroupOnboardingInbox } from './_components/GroupOnboardingInbox';
import { NewLeadsInbox } from './_components/NewLeadsInbox';
import { RADAR_SECTION_INITIAL_LIMIT, ShowAllToggle } from './_components/ShowAllToggle';

function todayIsoLocal(): string {
  return new Date().toLocaleDateString('en-CA');
}

function todayLabelArabic(): string {
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  } catch {
    return todayIsoLocal();
  }
}

type DashboardData = {
  pulse: SalesPipelinePulse;
  inTransit: VipInTransit[];
  passportAlerts: PassportAlert[];
  lazySuppliers: LazySupplierAlert[];
  newLeads: CrmLeadWithIntake[];
  leadsWarning?: string;
  interestLeads: CrmLeadRow[];
  interestWarning?: string;
  groupOnboardingLeads: CrmLeadRow[];
  groupOnboardingError?: string;
  groupFulfillment: GroupFulfillmentClient[];
  groupFulfillmentError?: string;
  marketingPublish: MarketingPublishRadarItem[];
  marketingPublishError?: string;
  quotationRevisions: Array<{
    id: string;
    title: string;
    status: 'needs_revision' | 'client_responded';
    clientName: string;
    clientPhone: string | null;
    updatedAt: string | null;
  }>;
};

export default function RadarPage() {
  const { profileAccess } = useCrmEmployee();
  const showInbox = canAccessRadarInbox(profileAccess);
  const showAppointments = canAccessRadarAppointments(profileAccess);
  const showGroupOps = canAccessGroupOperations(profileAccess);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dataWarning, setDataWarning] = useState('');
  const [leadsPanelTab, setLeadsPanelTab] = useState<'inbox' | 'interest'>('inbox');
  const [showAllTravelers, setShowAllTravelers] = useState(false);
  const [showAllPassports, setShowAllPassports] = useState(false);
  const [showAllLazySuppliers, setShowAllLazySuppliers] = useState(false);

  const fetchRadar = useCallback(async (opts?: { soft?: boolean }) => {
    if (!supabase) {
      setError('Supabase غير مهيأ.');
      setData(null);
      setLoading(false);
      return;
    }

    if (!opts?.soft) setLoading(true);
    setError('');
    if (!opts?.soft) setDataWarning('');

    const itineraryCols =
      'id, customer_name, title, destination, status, dates, start_date, end_date, is_template, client_id, supplier_requests, updated_at, expected_profit, clients(name)';

    const loadCoreQueries = () =>
      Promise.all([
        supabase.from('itineraries').select(itineraryCols).not('is_template', 'eq', true),
        supabase
          .from('clients')
          .select('id, name, passport_expiry, wallet_balance'),
        supabase.from('quotations').select('id, status, total_estimated_cost, expected_profit'),
        supabase
          .from('quotations')
          .select('id, title, status, updated_at, clients(name, phone_wa)')
          .in('status', ['needs_revision', 'client_responded'])
          .order('updated_at', { ascending: false })
          .limit(8),
      ]);

    let [tripsRes, clientsRes, quotationsRes, quotationRevisionRes] =
      await loadCoreQueries();

    // Local clock skew can make JWTs look "issued in the future" — refresh once and retry.
    if (
      anyJwtClockSkewError(
        tripsRes.error,
        clientsRes.error,
        quotationsRes.error,
        quotationRevisionRes.error,
      )
    ) {
      const recovered = await recoverSupabaseSessionFromClockSkew(supabase);
      if (recovered) {
        [tripsRes, clientsRes, quotationsRes, quotationRevisionRes] =
          await loadCoreQueries();
      }
    }

    // Clear prior skew warning once queries succeed after recovery / delayed retry.
    if (
      !anyJwtClockSkewError(
        tripsRes.error,
        clientsRes.error,
        quotationsRes.error,
        quotationRevisionRes.error,
      )
    ) {
      setDataWarning((prev) =>
        /JWT|ساعة الجهاز/i.test(prev) ? '' : prev,
      );
    }

    let itineraries = (tripsRes.data as Record<string, unknown>[]) ?? [];

    if (tripsRes.error) {
      const msg = tripsRes.error.message ?? '';
      if (anyJwtClockSkewError(tripsRes.error)) {
        // Soft-fail: keep previous dashboard stats; warn instead of clearing to zeros.
        setDataWarning(
          'انحراف بسيط في ساعة الجهاز (JWT) — جاري إعادة المحاولة تلقائياً…',
        );
        setLoading(false);
        if (!opts?.soft) {
          window.setTimeout(() => {
            void fetchRadar({ soft: true });
          }, 2000);
        }
        return;
      }
      if (msg.includes('expected_profit') || msg.includes('supplier_requests') || msg.includes('column')) {
        setDataWarning('بعض أعمدة المسارات غير متوفرة — نفّذ سكربتات SQL الأحدث في Supabase.');
        const fallback = await supabase
          .from('itineraries')
          .select(
            'id, customer_name, title, destination, status, dates, start_date, end_date, is_template, client_id, clients(name)',
          )
          .not('is_template', 'eq', true);
        if (fallback.error) {
          if (anyJwtClockSkewError(fallback.error)) {
            setDataWarning(
              'انحراف بسيط في ساعة الجهاز (JWT) — أعد مزامنة الوقت أو حدّث الصفحة.',
            );
            setLoading(false);
            return;
          }
          setError(fallback.error.message || 'تعذر تحميل الرادار.');
          setData(null);
          setLoading(false);
          return;
        }
        itineraries = (fallback.data as Record<string, unknown>[]) ?? [];
      } else {
        setError(msg || 'تعذر تحميل الرادار.');
        setData(null);
        setLoading(false);
        return;
      }
    }

    let clients = (clientsRes.data as Record<string, unknown>[]) ?? [];
    if (clientsRes.error) {
      const msg = clientsRes.error.message ?? '';
      if (anyJwtClockSkewError(clientsRes.error)) {
        setDataWarning((prev) =>
          prev
            ? prev
            : 'انحراف بسيط في ساعة الجهاز (JWT) — بعض الإحصائيات قد تكون ناقصة مؤقتاً.',
        );
      } else if (msg.includes('wallet_balance') || msg.includes('passport_expiry') || msg.includes('column')) {
        setDataWarning((prev) =>
          prev
            ? prev
            : 'تعذر تحميل wallet_balance أو passport_expiry — نفّذ سكربتات العملاء في Supabase.',
        );
        const fallback = await supabase.from('clients').select('id, name');
        clients = (fallback.data as Record<string, unknown>[]) ?? [];
      } else {
        setDataWarning(msg);
      }
    }

    let quotations = (quotationsRes.data as Record<string, unknown>[]) ?? [];
    if (quotationsRes.error) {
      const msg = quotationsRes.error.message ?? '';
      if (anyJwtClockSkewError(quotationsRes.error)) {
        setDataWarning((prev) =>
          prev
            ? prev
            : 'انحراف بسيط في ساعة الجهاز (JWT) — بعض الإحصائيات قد تكون ناقصة مؤقتاً.',
        );
        quotations = [];
      } else if (msg.includes('quotations') || msg.includes('relation') || msg.includes('column')) {
        setDataWarning((prev) =>
          prev ? `${prev} · جدول quotations غير متوفر.` : 'جدول quotations غير متوفر — نفّذ supabase/sql/quotations.sql',
        );
        quotations = [];
      }
    }

    const quotationRevisions =
      ((quotationRevisionRes.data as Record<string, unknown>[] | null) ?? []).map((row) => {
        const clientsRaw = row.clients;
        const firstClient =
          Array.isArray(clientsRaw) && clientsRaw.length > 0
            ? (clientsRaw[0] as Record<string, unknown>)
            : clientsRaw && typeof clientsRaw === 'object'
              ? (clientsRaw as Record<string, unknown>)
              : null;
        const statusRaw = String(row.status ?? '');
        const status: 'needs_revision' | 'client_responded' =
          statusRaw === 'client_responded' ? 'client_responded' : 'needs_revision';
        return {
          id: String(row.id ?? '').trim(),
          title: String(row.title ?? '').trim() || 'عرض سعر',
          status,
          clientName: String(firstClient?.name ?? '').trim() || '—',
          clientPhone:
            firstClient?.phone_wa != null
              ? String(firstClient.phone_wa).trim() || null
              : null,
          updatedAt: row.updated_at != null ? String(row.updated_at) : null,
        };
      }).filter((row) => row.id);

    const now = new Date();

    let newLeads: CrmLeadWithIntake[] = [];
    let leadsWarning: string | undefined;
    try {
      const leadsResult = await fetchNewCrmLeads(supabase);
      newLeads = leadsResult.leads;
      leadsWarning = leadsResult.warning;
    } catch (leadsErr) {
      const leadsMsg = leadsErr instanceof Error ? leadsErr.message : 'تعذر تحميل الطلبات الجديدة.';
      setDataWarning((prev) => (prev ? `${prev} · ${leadsMsg}` : leadsMsg));
    }

    let interestLeads: CrmLeadRow[] = [];
    let interestWarning: string | undefined;
    try {
      const interestResult = await fetchInterestOnlyLeads(supabase);
      interestLeads = interestResult.leads;
      interestWarning = interestResult.warning;
    } catch (interestErr) {
      const interestMsg =
        interestErr instanceof Error ? interestErr.message : 'تعذر تحميل قائمة الاهتمامات.';
      setDataWarning((prev) => (prev ? `${prev} · ${interestMsg}` : interestMsg));
    }

    let groupOnboardingLeads: CrmLeadRow[] = [];
    let groupOnboardingError: string | undefined;
    try {
      const groupObResult = await fetchGroupOnboardingLeads(supabase);
      groupOnboardingLeads = groupObResult.leads;
      if (groupObResult.error) {
        console.error('Fetch Group Leads Error:', groupObResult.error);
        groupOnboardingError = groupObResult.error;
      }
    } catch (groupObErr) {
      console.error('Fetch Group Leads Error:', groupObErr);
      groupOnboardingError =
        'حدث خطأ في جلب البيانات، تأكد من الاتصال بقاعدة البيانات.';
    }

    const groupResult = await fetchGroupFulfillmentClients(supabase);
    const marketingResult = await fetchMarketingPublishingRadar(supabase);

    setData({
      pulse: buildSalesPipelinePulse({ itineraries, quotations, clients }),
      inTransit: buildVipsInTransit(itineraries, now),
      passportAlerts: buildPassportAlerts(clients, now),
      lazySuppliers: buildLazySupplierAlerts(itineraries, now),
      newLeads,
      leadsWarning,
      interestLeads,
      interestWarning,
      groupOnboardingLeads,
      groupOnboardingError,
      groupFulfillment: groupResult.clients,
      groupFulfillmentError: groupResult.error,
      marketingPublish: marketingResult.items,
      marketingPublishError: marketingResult.error,
      quotationRevisions,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchRadar();
  }, [fetchRadar]);

  useEffect(() => {
    return subscribeCrmRealtimeRefresh(() => {
      void fetchRadar({ soft: true });
    });
  }, [fetchRadar]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-slate-50 text-slate-500" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden />
        <span className="text-sm font-medium">جاري مسح الرادار الحي…</span>
      </div>
    );
  }

  const pulse = data?.pulse ?? { confirmedProfit: 0, pendingQuotationValue: 0, lowWalletCount: 0 };
  const inTransit = data?.inTransit ?? [];
  const passportAlerts = data?.passportAlerts ?? [];
  const lazySuppliers = data?.lazySuppliers ?? [];
  const visibleTravelers = showAllTravelers
    ? inTransit
    : inTransit.slice(0, RADAR_SECTION_INITIAL_LIMIT);
  const visiblePassports = showAllPassports
    ? passportAlerts
    : passportAlerts.slice(0, RADAR_SECTION_INITIAL_LIMIT);
  const visibleLazySuppliers = showAllLazySuppliers
    ? lazySuppliers
    : lazySuppliers.slice(0, RADAR_SECTION_INITIAL_LIMIT);
  const newLeads = data?.newLeads ?? [];
  const leadsWarning = data?.leadsWarning;
  const interestLeads = data?.interestLeads ?? [];
  const interestWarning = data?.interestWarning;
  const groupOnboardingLeads = data?.groupOnboardingLeads ?? [];
  const groupOnboardingError = data?.groupOnboardingError;
  const groupFulfillment = data?.groupFulfillment ?? [];
  const groupFulfillmentError = data?.groupFulfillmentError;
  const marketingPublish = data?.marketingPublish ?? [];
  const marketingPublishError = data?.marketingPublishError;
  const quotationRevisions = data?.quotationRevisions ?? [];
  const allQuiet =
    inTransit.length === 0 && passportAlerts.length === 0 && lazySuppliers.length === 0;

  return (
    <div
      className="min-h-full space-y-10 text-sm font-[family-name:var(--font-tajawal),system-ui,sans-serif] sm:text-base"
      dir="rtl"
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400/70 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              الرادار الحي — مركز العمليات
            </h1>
            <p className="mt-1 text-sm text-slate-500">{todayLabelArabic()}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void fetchRadar()}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:opacity-90 active:scale-95"
        >
          تحديث الرادار
        </button>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50/80 px-4 py-3 text-sm font-medium text-rose-700 shadow-sm">
          {error}
        </div>
      ) : null}

      {dataWarning ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm font-medium text-amber-800 shadow-sm">
          {dataWarning}
        </div>
      ) : null}

      {/* 1. Sales Pipeline Pulse */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">النبض المالي</h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <StatCard
            emoji="🟢"
            label="الأرباح المؤكدة"
            value={formatSarAmount(pulse.confirmedProfit)}
            hint="مجموع الأرباح من عروض الأسعار المعتمدة"
            valueClassName="text-emerald-700"
          />
          <StatCard
            emoji="🟡"
            label="عروض بانتظار الاعتماد"
            value={formatSarAmount(pulse.pendingQuotationValue)}
            hint="مجموع التكلفة التقديرية — بانتظار العميل"
            valueClassName="text-amber-700"
          />
          <StatCard
            emoji="🔴"
            label="عهد مالية منخفضة"
            value={`${pulse.lowWalletCount.toLocaleString('ar-SA')} عميل`}
            hint="رصيد المحفظة أقل من 5,000 ر.س"
            valueClassName="text-rose-700"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-extrabold text-slate-900">مراجعات عروض الأسعار</h2>
        {quotationRevisions.length === 0 ? (
          <EmptySection message="لا توجد طلبات تعديل من العملاء حالياً." />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {quotationRevisions.map((quote) => (
              <article
                key={quote.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-600/20">
                    {quote.status === 'needs_revision' ? 'يحتاج تعديل' : 'ردّ عميل'}
                  </span>
                  <span className="text-xs font-medium text-slate-600">
                    {quote.updatedAt ? new Date(quote.updatedAt).toLocaleString('ar-SA') : '—'}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900">{quote.title}</h3>
                <p className="mt-1 text-sm font-medium text-slate-600">
                  العميل: {quote.clientName}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const url = `${window.location.origin}/proposal/${encodeURIComponent(quote.id)}`;
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success('تم نسخ الرابط! يمكنك الآن إرساله للعميل.');
                      } catch {
                        toast.error('تعذر نسخ الرابط.');
                      }
                    }}
                    className="inline-flex rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200"
                  >
                    نسخ رابط العميل
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}/proposal/${encodeURIComponent(quote.id)}`;
                      const message = `أهلاً بك، تم تجهيز عرض سعر رحلتك المخصص. يمكنك الاطلاع عليه واختيار تفضيلاتك عبر هذا الرابط الفاخر: ${url}`;
                      const phone = String(quote.clientPhone ?? '')
                        .replace(/\D/g, '')
                        .replace(/^0/, '966');
                      const waUrl = phone
                        ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
                        : `https://wa.me/?text=${encodeURIComponent(message)}`;
                      window.open(waUrl, '_blank', 'noopener,noreferrer');
                    }}
                    className="inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:opacity-90"
                  >
                    إرسال عبر واتساب
                  </button>
                  <Link
                    href={`/admin/quotations/${encodeURIComponent(quote.id)}`}
                    className="inline-flex rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200"
                  >
                    تفاصيل التعديل
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
        {showInbox ? (
          <div className="space-y-5">
            <div className="flex gap-1 rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setLeadsPanelTab('inbox')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm transition-all ${
                  leadsPanelTab === 'inbox'
                    ? 'bg-[#D4AF37] font-extrabold text-black shadow-sm'
                    : 'bg-slate-100 font-bold text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Inbox className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                صندوق الوارد
                {newLeads.length > 0 ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      leadsPanelTab === 'inbox'
                        ? 'bg-black/10 text-black'
                        : 'bg-white text-slate-600 ring-1 ring-slate-200'
                    }`}
                  >
                    {newLeads.length}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => setLeadsPanelTab('interest')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm transition-all ${
                  leadsPanelTab === 'interest'
                    ? 'bg-[#D4AF37] font-extrabold text-black shadow-sm'
                    : 'bg-slate-100 font-bold text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Heart className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                قائمة الاهتمامات
                {interestLeads.length > 0 ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      leadsPanelTab === 'interest'
                        ? 'bg-black/10 text-black'
                        : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                    }`}
                  >
                    {interestLeads.length}
                  </span>
                ) : null}
              </button>
            </div>

            {leadsPanelTab === 'inbox' ? (
              <NewLeadsInbox
                leads={newLeads}
                loading={false}
                warning={leadsWarning}
                onRefresh={fetchRadar}
                onLeadApproved={(leadId) => {
                  setData((prev) =>
                    prev
                      ? {
                          ...prev,
                          newLeads: prev.newLeads.filter((l) => l.id !== leadId),
                        }
                      : prev,
                  );
                }}
              />
            ) : (
              <InterestListInbox
                leads={interestLeads}
                loading={false}
                warning={interestWarning}
                onRefresh={() => fetchRadar({ soft: true })}
                onLeadConverted={(leadId) => {
                  setData((prev) =>
                    prev
                      ? {
                          ...prev,
                          interestLeads: prev.interestLeads.filter((l) => String(l.id) !== leadId),
                        }
                      : prev,
                  );
                }}
              />
            )}
          </div>
        ) : null}
        <MarketingPublishingRadar
          items={marketingPublish}
          error={marketingPublishError}
          compact
        />
      </div>

      {showAppointments ? (
        <GroupOnboardingInbox
          leads={groupOnboardingLeads}
          loading={false}
          error={groupOnboardingError}
          onRefresh={fetchRadar}
          onLeadDecided={(leadId) => {
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    groupOnboardingLeads: prev.groupOnboardingLeads.filter((l) => l.id !== leadId),
                  }
                : prev,
            );
          }}
        />
      ) : null}

      {showGroupOps ? (
        <GroupOperationsFulfillment
          clients={groupFulfillment}
          error={groupFulfillmentError}
          onRefresh={fetchRadar}
        />
      ) : null}

      {/* 2. Live VIPs in Transit */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">المسافرون الآن</h2>
        {inTransit.length === 0 ? (
          <EmptySection message="لا يوجد عملاء VIP في الرحلة حالياً." />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {visibleTravelers.map((vip) => (
                <div
                  key={vip.id}
                  className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition-all duration-200 hover:border-amber-400/60 hover:shadow-md"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <h4 className="truncate text-sm font-extrabold text-slate-900">
                      {vip.clientName}
                    </h4>
                    <span className="relative flex h-2 w-2 flex-shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                  </div>

                  <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                    <span className="flex min-w-0 items-center gap-1 truncate font-bold text-slate-700">
                      <span className="text-amber-600">📍</span>
                      <span className="truncate">{vip.destination}</span>
                    </span>
                    <span className="flex-shrink-0 rounded-md border border-amber-200/60 bg-amber-50 px-2 py-0.5 text-[11px] font-extrabold text-amber-800">
                      اليوم {vip.dayNumber || 1}
                    </span>
                  </div>

                  {vip.clientId ? (
                    <div className="flex justify-end border-t border-slate-100 pt-2">
                      <Link
                        href={`/crm/clients/${encodeURIComponent(vip.clientId)}`}
                        className="flex items-center gap-1 text-xs font-bold text-amber-600 transition-all group-hover:translate-x-[-2px] hover:text-amber-700"
                        dir="rtl"
                      >
                        <span>فتح الملف</span>
                        <span className="text-[10px]">←</span>
                      </Link>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <ShowAllToggle
              showAll={showAllTravelers}
              total={inTransit.length}
              onToggle={() => setShowAllTravelers((v) => !v)}
            />
          </>
        )}
      </section>

      {/* 3. Passport Expiry Alerts */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">إنذار الجوازات</h2>
        {passportAlerts.length === 0 ? (
          <EmptySection message="لا توجد جوازات تنتهي خلال أقل من 6 أشهر." />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {visiblePassports.map((alert) => (
                <div
                  key={alert.id}
                  className="flex flex-col justify-between rounded-2xl border border-rose-100 bg-white p-3.5 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <h4 className="truncate text-sm font-extrabold text-slate-900">
                      {alert.clientName}
                    </h4>
                    <span className="flex-shrink-0 rounded-md border border-rose-200/60 bg-rose-50 px-2 py-0.5 text-[11px] font-extrabold text-rose-700">
                      ينتهي خلال {alert.daysUntilExpiry} يوم
                    </span>
                  </div>
                  <p className="mb-2 text-right text-xs font-medium text-slate-500 dir-ltr">
                    🛂 {alert.expiryIso}
                  </p>
                  <div className="flex justify-end border-t border-slate-100 pt-2">
                    <Link
                      href={`/crm/clients/${encodeURIComponent(alert.id)}`}
                      className="flex items-center gap-1 text-xs font-bold text-amber-600 transition-all hover:text-amber-700"
                      dir="rtl"
                    >
                      <span>فتح الملف</span>
                      <span className="text-[10px]">←</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            <ShowAllToggle
              showAll={showAllPassports}
              total={passportAlerts.length}
              onToggle={() => setShowAllPassports((v) => !v)}
            />
          </>
        )}
      </section>

      {/* 4. Lazy Suppliers */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">الموردين المتأخرين</h2>
        {lazySuppliers.length === 0 ? (
          <EmptySection message="جميع الموردين ردوا خلال 24 ساعة — ممتاز!" />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {visibleLazySuppliers.map((alert) => {
                const daysOverdue = Math.max(1, Math.floor(alert.hoursWaiting / 24));
                const overdueLabel =
                  alert.hoursWaiting >= 24
                    ? `متأخر ${daysOverdue} يوم`
                    : `منذ ${alert.hoursWaiting} س`;

                return (
                  <div
                    key={alert.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm transition-all hover:shadow-md"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <h4 className="truncate text-sm font-extrabold text-slate-900">
                        {alert.supplierName}
                      </h4>
                      <span className="flex-shrink-0 rounded-md border border-amber-200/60 bg-amber-50 px-2 py-0.5 text-[11px] font-extrabold text-amber-800">
                        {overdueLabel}
                      </span>
                    </div>
                    <p className="mb-2 truncate text-xs font-bold text-slate-600">
                      ✈️ {alert.tripTitle} · {alert.clientName}
                    </p>
                    <div className="flex justify-end border-t border-slate-100 pt-2">
                      <Link
                        href={`/crm/itineraries/${encodeURIComponent(String(alert.itineraryId))}/edit`}
                        className="flex items-center gap-1 text-xs font-bold text-amber-600 transition-all hover:text-amber-700"
                        dir="rtl"
                      >
                        <span>متابعة الطلب</span>
                        <span className="text-[10px]">←</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
            <ShowAllToggle
              showAll={showAllLazySuppliers}
              total={lazySuppliers.length}
              onToggle={() => setShowAllLazySuppliers((v) => !v)}
            />
          </>
        )}
      </section>

      {allQuiet && pulse.pendingQuotationValue === 0 && pulse.lowWalletCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-8 py-14 text-center shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">الرادار هادئ — العمليات تحت السيطرة</h3>
          <p className="mt-2 text-sm text-slate-500">لا تنبيهات تشغيلية عاجلة في الوقت الحالي.</p>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  emoji,
  label,
  value,
  hint,
  valueClassName,
}: {
  emoji: string;
  label: string;
  value: string;
  hint: string;
  valueClassName: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base opacity-80" aria-hidden>
          {emoji}
        </span>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
      <p className={`text-2xl font-semibold tracking-tight ${valueClassName}`} dir="ltr">
        {value}
      </p>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </article>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center text-sm font-medium text-slate-500">
      {message}
    </div>
  );
}
