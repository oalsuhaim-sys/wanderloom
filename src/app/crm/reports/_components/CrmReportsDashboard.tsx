'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Loader2,
  MapPin,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

import { getCrmReportsAction } from '@/app/actions/reportsActions';
import { formatInvoiceAmount } from '@/lib/crm-invoices';
import { fetchCrmReportsSnapshotBrowser } from '@/lib/crm-reports-browser';
import type { CrmClientTripHistoryRow, CrmReportsSnapshot } from '@/lib/crm-reports';

const PAGE_BG =
  'min-h-[calc(100vh-6rem)] rounded-[1.75rem] border border-gray-100 bg-[#F9F9F6] p-5 shadow-sm sm:p-8';

const OFF_WHITE_CARD =
  'overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 text-[#1A3B2A] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(0,0,0,0.05)]';

const OFF_WHITE_PANEL =
  'overflow-hidden rounded-2xl border border-gray-100 bg-white text-[#1A3B2A] shadow-sm';

const PANEL_HEADER = 'border-b border-gray-100 bg-[#1A3B2A]/5 px-5 py-4';

const TABLE_HEAD =
  'bg-[#1A3B2A]/5 text-[#1A3B2A] font-semibold text-right py-4 px-6 border-b border-gray-200 text-xs';

const TABLE_ROW = 'border-b border-gray-100 transition-colors duration-200 hover:bg-white cursor-default';

function KpiCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`${OFF_WHITE_CARD} relative`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#C5A059]">
          {label}
        </p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C5A059]/15 ring-1 ring-[#C5A059]/35">
          {icon}
        </span>
      </div>
      <p className="text-3xl font-bold text-[#C5A059]" dir="ltr">
        {value}
      </p>
      {sub ? <p className="mt-1 text-[11px] font-semibold text-[#0F172A]/55">{sub}</p> : null}
    </div>
  );
}

function RevenueBar({
  label,
  amount,
  total,
  tone,
}: {
  label: string;
  amount: number;
  total: number;
  tone: 'gold' | 'emerald';
}) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  const barClass =
    tone === 'gold'
      ? 'bg-gradient-to-l from-[#C5A059] to-[#8A6B2A]'
      : 'bg-gradient-to-l from-emerald-400 to-emerald-600';

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold">
        <span className="text-[#0F172A]/80">{label}</span>
        <span className="text-[#B8941F]" dir="ltr">
          {formatInvoiceAmount(amount)}
          <span className="mr-2 text-[#0F172A]/40">({pct}%)</span>
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[#E8E4D8] ring-1 ring-[#C5A059]/20">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function tripStatusClass(tone: CrmClientTripHistoryRow['statusTone']): string {
  if (tone === 'completed') {
    return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300/60';
  }
  if (tone === 'archived') {
    return 'bg-slate-200 text-slate-700 ring-1 ring-slate-300/70';
  }
  if (tone === 'active') {
    return 'bg-amber-50 text-amber-900 ring-1 ring-amber-300/70';
  }
  if (tone === 'draft') {
    return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  }
  return 'bg-orange-50 text-orange-800 ring-1 ring-orange-200/80';
}

export function CrmReportsDashboard() {
  const [snapshot, setSnapshot] = useState<CrmReportsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dataSource, setDataSource] = useState<'server' | 'browser' | ''>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setDataSource('');

    const result = await getCrmReportsAction();
    if (result.ok) {
      setSnapshot(result.snapshot);
      setDataSource('server');
      setLoading(false);
      return;
    }

    const browserSnapshot = await fetchCrmReportsSnapshotBrowser();
    if (browserSnapshot) {
      setSnapshot(browserSnapshot);
      setDataSource('browser');
      setLoading(false);
      return;
    }

    setError(result.error || 'تعذر تحميل التقارير من قاعدة البيانات.');
    setSnapshot(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className={PAGE_BG}>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-[#C5A059]">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <p className="text-sm font-bold text-gray-500">جارٍ تحميل التقارير المالية…</p>
        </div>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className={PAGE_BG}>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-8 text-center">
          <p className="text-sm font-bold text-rose-800">{error || 'تعذر تحميل التقارير.'}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 rounded-xl border border-[#C5A059]/40 bg-[#C5A059]/10 px-4 py-2 text-xs font-black text-[#1A3B2A]"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  const { kpis, revenueBreakdown, recentTransactions, recentReceivables, clientTripHistory } =
    snapshot;
  const breakdownTotal = revenueBreakdown.privateTrips + revenueBreakdown.groupTours;

  return (
    <div className={PAGE_BG} dir="rtl">
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#C5A059]/15 pb-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#C5A059]/80">
              Executive Finance
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-[#1A3B2A] sm:text-3xl">
              <BarChart3 className="h-7 w-7 text-[#C5A059]" aria-hidden />
              التقارير والتحليلات
            </h1>
            <p className="mt-1 text-xs font-semibold text-[#1A3B2A]/50">
              لوحة إيرادات Wanderloom — فواتير، عروض، مسارات، ورحلات قديمة
              {dataSource === 'browser' ? ' · وضع الاتصال المباشر' : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/crm/finance"
              className="rounded-xl border border-[#1A3B2A]/20 bg-[#1A3B2A] px-4 py-2 text-xs font-black text-white transition hover:bg-[#152e21]"
            >
              الذكاء المالي
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl border border-[#C5A059]/35 bg-[#C5A059]/10 px-4 py-2 text-xs font-black text-[#C5A059] transition hover:bg-[#C5A059]/20"
            >
              تحديث
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            label="إجمالي الإيرادات"
            value={formatInvoiceAmount(kpis.totalRevenue)}
            sub="فواتير + عروض + مسارات + رحلات قديمة"
            icon={<TrendingUp className="h-4 w-4 text-[#C5A059]" aria-hidden />}
          />
          <KpiCard
            label="إجمالي الأرباح"
            value={formatInvoiceAmount(kpis.totalProfit ?? 0)}
            sub="أرباح المسارات والعروض والرحلات القديمة"
            icon={<Wallet className="h-4 w-4 text-[#C5A059]" aria-hidden />}
          />
          <KpiCard
            label="إيرادات الشهر الحالي"
            value={formatInvoiceAmount(kpis.monthlyRevenue)}
            sub="من بداية الشهر"
            icon={<CalendarDays className="h-4 w-4 text-[#C5A059]" aria-hidden />}
          />
          <KpiCard
            label="المبالغ المتبقية"
            value={formatInvoiceAmount(kpis.outstandingBalances)}
            sub="عروض معتمدة / بانتظار الدفع"
            icon={<Users className="h-4 w-4 text-[#C5A059]" aria-hidden />}
          />
          <KpiCard
            label="عدد المعاملات"
            value={String(kpis.transactionCount)}
            sub={`${kpis.pendingInvoiceCount} فاتورة مستحقة`}
            icon={<Receipt className="h-4 w-4 text-[#C5A059]" aria-hidden />}
          />
        </div>

        <section className={OFF_WHITE_CARD}>
          <h2 className="mb-5 text-sm font-black text-[#C5A059]">توزيع الإيرادات</h2>
          <div className="space-y-5">
            <RevenueBar
              label="رحلات خاصة"
              amount={revenueBreakdown.privateTrips}
              total={breakdownTotal}
              tone="gold"
            />
            <RevenueBar
              label="رحلات جماعية"
              amount={revenueBreakdown.groupTours}
              total={breakdownTotal}
              tone="emerald"
            />
          </div>
        </section>

        <section className={OFF_WHITE_PANEL}>
          <div className={PANEL_HEADER}>
            <h2 className="text-xl font-black text-[#C5A059]">سجل الرحلات للعملاء</h2>
            <p className="mt-0.5 text-[10px] font-semibold text-[#0F172A]/55">
              {clientTripHistory.length} رحلة — المسارات · الطلبات · عروض الأسعار · السجل التاريخي
            </p>
          </div>
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[880px] text-right text-xs">
              <thead className="sticky top-0 z-10">
                <tr className={TABLE_HEAD}>
                  <th className="px-4 py-3">العميل</th>
                  <th className="px-4 py-3">عنوان الرحلة</th>
                  <th className="px-4 py-3">الوجهة</th>
                  <th className="px-4 py-3">تواريخ السفر</th>
                  <th className="px-4 py-3">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {clientTripHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center font-semibold text-[#0F172A]/45">
                      لا توجد رحلات مسجّلة بعد.
                    </td>
                  </tr>
                ) : (
                  clientTripHistory.map((row) => (
                    <tr key={row.id} className={TABLE_ROW}>
                      <td className="px-4 py-3 font-bold text-[#0F172A]">{row.clientName}</td>
                      <td className="px-4 py-3 font-semibold text-[#0F172A]/85">{row.tripTitle}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 font-semibold text-[#0F172A]/70">
                          <MapPin className="h-3 w-3 shrink-0 text-[#C5A059]" aria-hidden />
                          {row.destinations}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 font-semibold text-[#0F172A]/70">
                          <CalendarDays className="h-3 w-3 shrink-0 text-[#C5A059]" aria-hidden />
                          {row.dateRange}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black ${tripStatusClass(row.statusTone)}`}
                        >
                          {row.statusLabel}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[#C5A059]/15 bg-[#FAFAF7] px-5 py-3">
            <Link
              href="/crm/quotations"
              className="inline-flex items-center gap-1 text-[11px] font-black text-[#C5A059] hover:underline"
            >
              إدارة عروض الأسعار
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </section>

        <section className={OFF_WHITE_PANEL}>
          <div className={`${PANEL_HEADER} border-amber-200/60 bg-amber-50/80`}>
            <h2 className="text-sm font-black text-amber-900">فواتير بانتظار السداد</h2>
            <p className="mt-0.5 text-[10px] font-semibold text-amber-800/70">
              المبالغ المستحقة: {formatInvoiceAmount(kpis.expectedReceivables)}
            </p>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[720px] text-right text-xs">
              <thead className="sticky top-0 z-10">
                <tr className={TABLE_HEAD}>
                  <th className="px-4 py-3">التاريخ</th>
                  <th className="px-4 py-3">العميل</th>
                  <th className="px-4 py-3">الرحلة</th>
                  <th className="px-4 py-3">المبلغ</th>
                  <th className="px-4 py-3">نوع الدفعة</th>
                </tr>
              </thead>
              <tbody>
                {recentReceivables.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center font-semibold text-[#0F172A]/45">
                      لا توجد فواتير مستحقة حالياً.
                    </td>
                  </tr>
                ) : (
                  recentReceivables.map((row) => (
                    <tr key={row.id} className={TABLE_ROW}>
                      <td className="px-4 py-3 font-semibold text-[#0F172A]/70">{row.dateLabel}</td>
                      <td className="px-4 py-3 font-bold text-[#0F172A]">{row.clientName}</td>
                      <td className="px-4 py-3 font-semibold text-amber-900/85">{row.tripTitle}</td>
                      <td className="px-4 py-3 font-black text-amber-900" dir="ltr">
                        {formatInvoiceAmount(row.amount)}
                      </td>
                      <td className="px-4 py-3 font-bold text-[#0F172A]/75">{row.typeLabel}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={OFF_WHITE_PANEL}>
          <div className={PANEL_HEADER}>
            <h2 className="text-sm font-black text-[#C5A059]">سجل المعاملات الأخيرة</h2>
            <p className="mt-0.5 text-[10px] font-semibold text-[#0F172A]/55">
              فواتير مدفوعة — السجل الكامل
            </p>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[720px] text-right text-xs">
              <thead className="sticky top-0 z-10">
                <tr className={TABLE_HEAD}>
                  <th className="px-4 py-3">التاريخ</th>
                  <th className="px-4 py-3">العميل</th>
                  <th className="px-4 py-3">الرحلة</th>
                  <th className="px-4 py-3">المبلغ</th>
                  <th className="px-4 py-3">نوع الدفعة</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center font-semibold text-[#0F172A]/45">
                      لا توجد معاملات مدفوعة بعد.
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((row) => (
                    <tr key={row.id} className={TABLE_ROW}>
                      <td className="px-4 py-3 font-semibold text-[#0F172A]/70">{row.dateLabel}</td>
                      <td className="px-4 py-3 font-bold text-[#0F172A]">{row.clientName}</td>
                      <td className="px-4 py-3 font-semibold text-[#B8941F]">{row.tripTitle}</td>
                      <td className="px-4 py-3 font-black text-[#0F172A]" dir="ltr">
                        {formatInvoiceAmount(row.amount)}
                      </td>
                      <td className="px-4 py-3 font-bold text-[#0F172A]/75">{row.typeLabel}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
