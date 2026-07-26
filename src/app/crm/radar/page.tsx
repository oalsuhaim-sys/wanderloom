'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

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
import { fetchNewCrmLeads, type CrmLeadWithIntake } from '@/lib/crm-leads';
import {
  fetchGroupFulfillmentClients,
  type GroupFulfillmentClient,
} from '@/lib/group-operations-radar';
import {
  fetchMarketingPublishingRadar,
  type MarketingPublishRadarItem,
} from '@/lib/marketing-publishing-radar';
import { supabase } from '@/lib/supabase';

import GroupOperationsFulfillment from './_components/GroupOperationsFulfillment';
import { NewLeadsInbox } from './_components/NewLeadsInbox';
import MarketingPublishingRadar from '@/app/crm/_components/MarketingPublishingRadar';

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
  groupFulfillment: GroupFulfillmentClient[];
  groupFulfillmentError?: string;
  marketingPublish: MarketingPublishRadarItem[];
  marketingPublishError?: string;
};

export default function RadarPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dataWarning, setDataWarning] = useState('');

  const fetchRadar = useCallback(async () => {
    if (!supabase) {
      setError('Supabase غير مهيأ.');
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setDataWarning('');

    const itineraryCols =
      'id, customer_name, title, destination, status, dates, start_date, end_date, is_template, client_id, supplier_requests, updated_at, expected_profit, clients(name)';

    const [tripsRes, clientsRes, quotationsRes] = await Promise.all([
      supabase.from('itineraries').select(itineraryCols).not('is_template', 'eq', true),
      supabase
        .from('clients')
        .select('id, name, passport_expiry, wallet_balance'),
      supabase.from('quotations').select('id, status, total_estimated_cost, expected_profit'),
    ]);

    let itineraries = (tripsRes.data as Record<string, unknown>[]) ?? [];

    if (tripsRes.error) {
      const msg = tripsRes.error.message ?? '';
      if (msg.includes('expected_profit') || msg.includes('supplier_requests') || msg.includes('column')) {
        setDataWarning('بعض أعمدة المسارات غير متوفرة — نفّذ سكربتات SQL الأحدث في Supabase.');
        const fallback = await supabase
          .from('itineraries')
          .select(
            'id, customer_name, title, destination, status, dates, start_date, end_date, is_template, client_id, clients(name)',
          )
          .not('is_template', 'eq', true);
        if (fallback.error) {
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
      if (msg.includes('wallet_balance') || msg.includes('passport_expiry') || msg.includes('column')) {
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
      if (msg.includes('quotations') || msg.includes('relation') || msg.includes('column')) {
        setDataWarning((prev) =>
          prev ? `${prev} · جدول quotations غير متوفر.` : 'جدول quotations غير متوفر — نفّذ supabase/sql/quotations.sql',
        );
        quotations = [];
      }
    }

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

    const groupResult = await fetchGroupFulfillmentClients(supabase);
    const marketingResult = await fetchMarketingPublishingRadar(supabase);

    setData({
      pulse: buildSalesPipelinePulse({ itineraries, quotations, clients }),
      inTransit: buildVipsInTransit(itineraries, now),
      passportAlerts: buildPassportAlerts(clients, now),
      lazySuppliers: buildLazySupplierAlerts(itineraries, now),
      newLeads,
      leadsWarning,
      groupFulfillment: groupResult.clients,
      groupFulfillmentError: groupResult.error,
      marketingPublish: marketingResult.items,
      marketingPublishError: marketingResult.error,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchRadar();
  }, [fetchRadar]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-[#FDFBF7] text-gray-600" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" aria-hidden />
        <span className="text-sm font-bold">جاري مسح الرادار الحي… 📡</span>
      </div>
    );
  }

  const pulse = data?.pulse ?? { confirmedProfit: 0, pendingQuotationValue: 0, lowWalletCount: 0 };
  const inTransit = data?.inTransit ?? [];
  const passportAlerts = data?.passportAlerts ?? [];
  const lazySuppliers = data?.lazySuppliers ?? [];
  const newLeads = data?.newLeads ?? [];
  const leadsWarning = data?.leadsWarning;
  const groupFulfillment = data?.groupFulfillment ?? [];
  const groupFulfillmentError = data?.groupFulfillmentError;
  const marketingPublish = data?.marketingPublish ?? [];
  const marketingPublishError = data?.marketingPublishError;
  const allQuiet =
    inTransit.length === 0 && passportAlerts.length === 0 && lazySuppliers.length === 0;

  return (
    <div
      className="min-h-screen bg-[#FDFBF7] p-4 text-sm font-[family-name:var(--font-tajawal),system-ui,sans-serif] sm:p-6 sm:text-base md:p-8"
      dir="rtl"
    >
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative flex h-5 w-5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-5 w-5 rounded-full bg-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">
              📡 الرادار الحي — مركز العمليات
            </h1>
            <p className="text-sm font-medium text-gray-600">{todayLabelArabic()}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void fetchRadar()}
          className="rounded-xl border border-[#D4AF37]/40 bg-white px-4 py-2 text-sm font-bold text-[#1E2720] shadow-sm transition hover:bg-[#FEFDF9]"
        >
          تحديث الرادار ↻
        </button>
      </header>

      {error ? (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
          {error}
        </div>
      ) : null}

      {dataWarning ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          {dataWarning}
        </div>
      ) : null}

      {/* 1. Sales Pipeline Pulse */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-black text-[#1E2720]">📈 النبض المالي</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            emoji="🟢"
            label="الأرباح المؤكدة"
            value={formatSarAmount(pulse.confirmedProfit)}
            hint="مجموع الأرباح من عروض الأسعار المعتمدة"
            className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white ring-emerald-100"
            valueClassName="text-emerald-800"
          />
          <StatCard
            emoji="🟡"
            label="عروض بانتظار الاعتماد"
            value={formatSarAmount(pulse.pendingQuotationValue)}
            hint="مجموع التكلفة التقديرية — بانتظار العميل ⏳"
            className="border-amber-200 bg-gradient-to-br from-amber-50 to-white ring-amber-100"
            valueClassName="text-amber-900"
          />
          <StatCard
            emoji="🔴"
            label="عهد مالية منخفضة"
            value={`${pulse.lowWalletCount.toLocaleString('ar-SA')} عميل`}
            hint="رصيد المحفظة أقل من 5,000 ر.س"
            className="border-red-200 bg-gradient-to-br from-red-50 to-white ring-red-100"
            valueClassName="text-red-800"
          />
        </div>
      </section>

      <div className="mb-10 grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
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
        <MarketingPublishingRadar
          items={marketingPublish}
          error={marketingPublishError}
          compact
        />
      </div>

      <GroupOperationsFulfillment
        clients={groupFulfillment}
        error={groupFulfillmentError}
        onRefresh={fetchRadar}
      />

      {/* 2. Live VIPs in Transit */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-black text-[#1E2720]">✈️ المسافرون الآن</h2>
        {inTransit.length === 0 ? (
          <EmptySection message="لا يوجد عملاء VIP في الرحلة حالياً." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {inTransit.map((vip) => (
              <article
                key={vip.id}
                className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-sky-300/60 bg-gradient-to-br from-sky-50 via-white to-sky-50/80 p-5 shadow-[0_0_24px_rgba(56,189,248,0.25)] ring-1 ring-sky-200"
              >
                <div className="pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full bg-sky-300/20 blur-2xl" />
                <div className="relative">
                  <p className="text-base font-black leading-relaxed text-sky-950">
                    ✈️ {vip.clientName} متواجد الآن في {vip.destination} (اليوم {vip.dayNumber} من
                    الرحلة)
                  </p>
                  <p className="mt-2 text-xs font-semibold text-sky-700/80">{vip.tripTitle}</p>
                </div>
                {vip.clientId ? (
                  <div className="relative mt-4 border-t border-sky-200/60 pt-3">
                    <Link
                      href={`/crm/clients/${encodeURIComponent(vip.clientId)}`}
                      className="inline-flex text-xs font-bold text-sky-900 underline underline-offset-2 transition-colors hover:text-sky-950"
                    >
                      فتح ملف العميل ←
                    </Link>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 3. Passport Expiry Alerts */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-black text-[#1E2720]">🚨 إنذار الجوازات</h2>
        {passportAlerts.length === 0 ? (
          <EmptySection message="لا توجد جوازات تنتهي خلال أقل من 6 أشهر." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {passportAlerts.map((alert) => (
              <article
                key={alert.id}
                className="animate-pulse rounded-2xl border-2 border-red-400 bg-gradient-to-br from-red-50 to-red-100/80 p-5 shadow-lg ring-2 ring-red-200/60"
              >
                <p className="text-base font-black text-red-900">
                  🚨 تنبيه أمني: جواز {alert.clientName} ينتهي خلال أقل من 6 أشهر!
                </p>
                <p className="mt-2 text-sm font-bold text-red-800/80">
                  ينتهي {alert.expiryIso} · متبقي {alert.daysUntilExpiry} يوم
                </p>
                <Link
                  href={`/crm/clients/${alert.id}`}
                  className="mt-3 inline-flex text-xs font-bold text-red-900 underline underline-offset-2"
                >
                  فتح ملف العميل ←
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 4. Lazy Suppliers */}
      <section className="mb-6">
        <h2 className="mb-4 text-lg font-black text-[#1E2720]">⏳ الموردين المتأخرين</h2>
        {lazySuppliers.length === 0 ? (
          <EmptySection message="جميع الموردين ردوا خلال 24 ساعة — ممتاز!" />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {lazySuppliers.map((alert) => (
              <article
                key={alert.id}
                className="rounded-2xl border border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50/90 p-5 shadow-md ring-1 ring-orange-200"
              >
                <p className="text-base font-black leading-relaxed text-orange-950">
                  ⏳ تأخير مورد: {alert.supplierName} لم يرد منذ أكثر من 24 ساعة لرحلة{' '}
                  {alert.clientName}.
                </p>
                <p className="mt-2 text-xs font-semibold text-orange-800/75">
                  {alert.tripTitle} · منذ {alert.hoursWaiting} ساعة
                </p>
                <Link
                  href={`/crm/itineraries/${alert.itineraryId}/edit`}
                  className="mt-3 inline-flex text-xs font-bold text-orange-900 underline underline-offset-2"
                >
                  متابعة الطلب في المسار ←
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      {allQuiet && pulse.pendingQuotationValue === 0 && pulse.lowWalletCount === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">
          <div className="mb-3 text-5xl">🦅</div>
          <h3 className="text-xl font-bold text-gray-700">الرادار هادئ — العمليات تحت السيطرة</h3>
          <p className="mt-2 text-sm text-gray-500">لا تنبيهات تشغيلية عاجلة في الوقت الحالي.</p>
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
  className,
  valueClassName,
}: {
  emoji: string;
  label: string;
  value: string;
  hint: string;
  className: string;
  valueClassName: string;
}) {
  return (
    <article className={`rounded-2xl border p-5 shadow-sm ring-1 ${className}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xl" aria-hidden>
          {emoji}
        </span>
        <p className="text-sm font-bold text-gray-700">{label}</p>
      </div>
      <p className={`text-2xl font-black ${valueClassName}`} dir="ltr">
        {value}
      </p>
      <p className="mt-2 text-xs font-medium text-gray-500">{hint}</p>
    </article>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white/80 px-5 py-8 text-center text-sm font-semibold text-gray-500">
      {message}
    </div>
  );
}
