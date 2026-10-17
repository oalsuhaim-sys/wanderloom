'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';

import {
  formatSarAmount,
} from '@/lib/live-radar-dashboard';
import { BirthdayRadarWidget } from '@/app/crm/_components/BirthdayRadarWidget';
import { subscribeCrmRealtimeRefresh } from '@/lib/crm-realtime-events';

import { useCrmEmployee } from '@/app/crm/_components/CrmEmployeeProvider';
import MarketingPublishingRadar from '@/app/crm/_components/MarketingPublishingRadar';
import {
  canAccessGroupOperations,
  canAccessRadarAppointments,
  canAccessRadarInbox,
} from '@/lib/crm-permissions';

import GroupOperationsFulfillment from './_components/GroupOperationsFulfillment';
import { GroupOnboardingInbox } from './_components/GroupOnboardingInbox';
import { NewLeadsInbox } from './_components/NewLeadsInbox';
import { RADAR_SECTION_INITIAL_LIMIT, ShowAllToggle } from './_components/ShowAllToggle';
import { isExpiredClientMeeting } from '@/lib/crm-leads';
import { useRadarDashboard } from './useRadarDashboard';

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

export default function RadarPage() {
  const { profileAccess } = useCrmEmployee();
  const showInbox = canAccessRadarInbox(profileAccess);
  const showAppointments = canAccessRadarAppointments(profileAccess);
  const showGroupOps = canAccessGroupOperations(profileAccess);

  const {
    data,
    error,
    dataWarning,
    showFullPageSpinner,
    mutate,
    refresh: fetchRadar,
  } = useRadarDashboard();

  const [leadsPanelTab, setLeadsPanelTab] = useState<'inbox' | 'meetings' | 'interests'>('meetings');
  const [showAllTravelers, setShowAllTravelers] = useState(false);
  const [showAllPassports, setShowAllPassports] = useState(false);
  const [showAllLazySuppliers, setShowAllLazySuppliers] = useState(false);

  useEffect(() => {
    return subscribeCrmRealtimeRefresh(() => {
      void fetchRadar();
    });
  }, [fetchRadar]);

  if (showFullPageSpinner) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F5EE] p-6" dir="rtl">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#BA8E48] border-t-transparent" />
          <p className="text-xs font-bold text-slate-700">جاري تحميل رادار الطلبات...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F5EE] p-6" dir="rtl">
        <div className="max-w-md space-y-4 rounded-3xl border border-red-200 bg-white p-8 text-center shadow-lg">
          <span className="text-3xl">⚠️</span>
          <h2 className="text-lg font-bold text-slate-900">تعذر تحميل بيانات الرادار</h2>
          <p className="text-xs text-slate-500">حدث خطأ أثناء الاتصال بالخادم، يرجى المحاولة مرة أخرى.</p>
          <button
            type="button"
            onClick={() => void fetchRadar()}
            className="rounded-full bg-[#1B242F] px-6 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-slate-800"
          >
            إعادة التحميل
          </button>
        </div>
      </div>
    );
  }

  const setData = (
    updater: (prev: NonNullable<typeof data> | null) => NonNullable<typeof data> | null | undefined,
  ) => {
    void mutate(
      (current) => {
        const next = updater(current ?? null);
        return next ?? current;
      },
      { revalidate: false },
    );
  };

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
  const meetingLeads = (data?.meetingLeads ?? []).filter((lead) => !isExpiredClientMeeting(lead));
  const interestLeads = data?.interestLeads ?? [];
  const showDemoMeeting =
    newLeads.length === 0 &&
    (data?.meetingLeads.length ?? 0) === 0 &&
    interestLeads.length === 0;
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

      <BirthdayRadarWidget withinDays={7} />

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
          <div className="space-y-5 xl:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setLeadsPanelTab('inbox')}
                  className={`flex items-center gap-2 rounded-full px-6 py-3 text-xs font-bold shadow-sm transition-all ${
                    leadsPanelTab === 'inbox'
                      ? 'bg-[#C59B4B] text-white'
                      : 'border border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <span>📫 صندوق الوارد</span>
                  <span className="rounded-full bg-[#1B242F] px-2 py-0.5 text-[10px] text-white">
                    {newLeads.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setLeadsPanelTab('meetings')}
                  className={`flex items-center gap-2 rounded-full px-6 py-3 text-xs font-bold shadow-sm transition-all ${
                    leadsPanelTab === 'meetings'
                      ? 'bg-[#C59B4B] text-white'
                      : 'border border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <span>📅 مواعيد اجتماعات العملاء (Cal)</span>
                  <span className="rounded-full bg-[#1B242F] px-2 py-0.5 text-[10px] text-white">
                    {meetingLeads.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setLeadsPanelTab('interests')}
                  className={`flex items-center gap-2 rounded-full px-6 py-3 text-xs font-bold shadow-sm transition-all ${
                    leadsPanelTab === 'interests'
                      ? 'bg-[#C59B4B] text-white'
                      : 'border border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <span>♡ قائمة الاهتمامات</span>
                  <span className="rounded-full bg-[#1B242F] px-2 py-0.5 text-[10px] text-white">
                    {interestLeads.length}
                  </span>
                </button>
              </div>
              <Link
                href="/crm/pipeline"
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <span>📊 لوحة الكانبان</span>
              </Link>
            </div>

            <NewLeadsInbox
              panel={leadsPanelTab}
              leads={newLeads}
              meetingLeads={meetingLeads}
              interestLeads={interestLeads}
              showSample={showDemoMeeting}
              loading={false}
              warning={
                leadsPanelTab === 'meetings'
                  ? data?.meetingWarning
                  : leadsPanelTab === 'interests'
                    ? data?.interestWarning
                    : leadsWarning
              }
              onRefresh={fetchRadar}
              onShowMeetings={() => setLeadsPanelTab('meetings')}
              onMovedToMeeting={(leadId) => {
                setLeadsPanelTab('meetings');
                setData((prev) => {
                  if (!prev) return prev;
                  const moved = prev.newLeads.find((lead) => lead.id === leadId);
                  return {
                    ...prev,
                    newLeads: prev.newLeads.filter((lead) => lead.id !== leadId),
                    meetingLeads: moved
                      ? [
                          { ...moved, status: 'meeting_scheduled' },
                          ...prev.meetingLeads.filter((lead) => lead.id !== leadId),
                        ]
                      : prev.meetingLeads,
                  };
                });
              }}
            />
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
