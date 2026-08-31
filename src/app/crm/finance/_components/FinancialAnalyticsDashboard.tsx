'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Crown,
  ExternalLink,
  FileText,
  PiggyBank,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

import { getFinancialAnalyticsAction } from '@/app/actions/financialAnalyticsActions';
import {
  formatInvoiceDate,
  INVOICE_STATUS_LABEL,
  INVOICE_TYPE_LABEL,
  invoiceStatusBadgeClass,
} from '@/lib/crm-invoices';
import { fetchFinancialAnalyticsBrowser } from '@/lib/financial-analytics-browser';
import type { FinancialAnalyticsSnapshot } from '@/lib/financial-analytics';
import { CRM_BTN_PRIMARY, CRM_KPI_CARD } from '@/lib/crm-luxury-ui';
import { subscribeCrmRealtimeRefresh } from '@/lib/crm-realtime-events';
import { partnerCrmProfilePath } from '@/lib/partner-dna';

const BAR_COLORS = ['#0F172A', '#D4AF37', '#334155', '#8A6B2A', '#1A2421', '#64748b'];

const EMPTY_METRICS = {
  totalRevenue: 0,
  pendingAmount: 0,
  totalInvoices: 0,
  paidCount: 0,
  pendingCount: 0,
  draftCount: 0,
  rejectedCount: 0,
  paidRatio: 0,
};

/** Clean RTL SAR — number + unit without Intl punctuation overlap */
function formatCurrency(val: number): string {
  const n = Number.isFinite(val) ? val : 0;
  return `${Math.round(n).toLocaleString('ar-SA')} ر.س`;
}

function MetricCard({
  label,
  amount,
  value,
  sub,
  icon,
  valueTone = 'slate',
}: {
  label: string;
  /** Prefer amount for currency KPIs (RTL-safe layout) */
  amount?: number;
  value?: string;
  sub?: string;
  icon: React.ReactNode;
  valueTone?: 'slate' | 'emerald' | 'amber' | 'gold';
}) {
  const valueClass = {
    slate: 'text-slate-900 dark:text-white',
    emerald: 'text-emerald-700 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    gold: 'text-[#D4AF37]',
  }[valueTone];

  const numeric = amount != null && Number.isFinite(amount) ? Math.round(amount) : null;

  return (
    <div className={`${CRM_KPI_CARD} flex flex-col justify-center p-5`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-700 dark:bg-[#1A2421] dark:text-[#D4AF37]">
          {icon}
        </span>
      </div>
      {numeric != null ? (
        <p
          className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-3xl font-bold ${valueClass}`}
        >
          <span className="tabular-nums tracking-tight" dir="ltr">
            {numeric.toLocaleString('ar-SA')}
          </span>
          <span className="text-base font-semibold text-slate-400 dark:text-slate-500">ر.س</span>
        </p>
      ) : (
        <p className={`text-3xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      )}
      {sub ? <p className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">{sub}</p> : null}
    </div>
  );
}

function EmptyPanel({
  icon,
  message,
}: {
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center px-4 py-8">
      <div className="mb-2 text-slate-300 dark:text-slate-600">{icon}</div>
      <p className="text-center text-sm font-medium text-slate-400">{message}</p>
    </div>
  );
}

function FinanceSkeleton() {
  return (
    <div className="crm-animate-in space-y-6" dir="rtl" aria-busy="true" aria-label="جاري التحميل">
      <div className="h-16 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-[#22302C]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-[#2D3F3A] dark:bg-[#22302C]"
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-[#2D3F3A] dark:bg-[#22302C]" />
      <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-[#2D3F3A] dark:bg-[#22302C]" />
    </div>
  );
}

export function FinancialAnalyticsDashboard() {
  const [snapshot, setSnapshot] = useState<FinancialAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const server = await getFinancialAnalyticsAction();
      if (server.ok) {
        setSnapshot(server.snapshot);
        return;
      }
      const browser = await fetchFinancialAnalyticsBrowser();
      if (browser) {
        setSnapshot(browser);
        return;
      }
      setError(server.error || 'تعذر تحميل البيانات المالية من Supabase.');
    } catch (err) {
      try {
        const browser = await fetchFinancialAnalyticsBrowser();
        if (browser) {
          setSnapshot(browser);
          return;
        }
      } catch {
        /* fall through */
      }
      setError(err instanceof Error ? err.message : 'تعذر تحميل التحليل المالي.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return subscribeCrmRealtimeRefresh((detail) => {
      if (detail.source === 'invoices' || detail.reason === 'paid') {
        void load();
      }
    });
  }, [load]);

  const chartData = useMemo(
    () =>
      (snapshot?.destinations ?? []).map((d) => ({
        name: d.destination.length > 18 ? `${d.destination.slice(0, 16)}…` : d.destination,
        fullName: d.destination,
        profit: d.profit,
        revenue: d.revenue,
        trips: d.trips,
      })),
    [snapshot],
  );

  if (loading) {
    return <FinanceSkeleton />;
  }

  const s = snapshot ?? {
    grossRevenue: 0,
    totalCosts: 0,
    netProfit: 0,
    marginPct: 0,
    closedTripCount: 0,
    destinations: [],
    experts: [],
    invoiceMetrics: EMPTY_METRICS,
    recentInvoices: [],
  };

  const metrics = s.invoiceMetrics ?? EMPTY_METRICS;
  const invoices = s.recentInvoices ?? [];

  return (
    <div dir="rtl" className="crm-animate-in space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400 dark:text-[#D4AF37]/80">
            Financial Analytics
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            الذكاء المالي
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            بيانات حية من جدول الفواتير · {metrics.totalInvoices.toLocaleString('ar-SA')} فاتورة
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/crm/reports"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-slate-200"
          >
            التقارير التفصيلية
          </Link>
          <button type="button" onClick={() => void load()} className={CRM_BTN_PRIMARY}>
            <RefreshCw className="h-3.5 w-3.5" />
            تحديث
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      {/* Invoice KPIs — status-exact math from invoices.status */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="مؤشرات الفواتير">
        <MetricCard
          label="إجمالي الإيرادات"
          amount={metrics.totalRevenue}
          sub={`${metrics.paidCount.toLocaleString('ar-SA')} فاتورة مدفوعة`}
          icon={<Wallet className="h-5 w-5" />}
          valueTone="emerald"
        />
        <MetricCard
          label="مبالغ بانتظار الدفع"
          amount={metrics.pendingAmount}
          sub={`${metrics.pendingCount.toLocaleString('ar-SA')} فاتورة معلّقة`}
          icon={<TrendingDown className="h-5 w-5" />}
          valueTone="amber"
        />
        <MetricCard
          label="نسبة التحصيل"
          value={`${metrics.paidRatio.toLocaleString('ar-SA')}٪`}
          sub={`${metrics.paidCount.toLocaleString('ar-SA')} من ${metrics.totalInvoices.toLocaleString('ar-SA')} مدفوعة`}
          icon={<FileText className="h-5 w-5" />}
          valueTone="gold"
        />
        <MetricCard
          label="صافي الربح (رحلات)"
          amount={s.netProfit}
          sub={`هامش ${s.marginPct.toLocaleString('ar-SA')}٪ · ${s.closedTripCount.toLocaleString('ar-SA')} رحلة`}
          icon={<PiggyBank className="h-5 w-5" />}
          valueTone="gold"
        />
      </section>

      {/* Live invoices list */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-[#2D3F3A]">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">سجل الفواتير</h2>
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              بيانات مباشرة من Supabase · أحدث {invoices.length.toLocaleString('ar-SA')} فاتورة
            </p>
          </div>
          <Link
            href="/crm/quotations"
            className="text-xs font-semibold text-slate-600 underline-offset-2 hover:underline dark:text-[#D4AF37]"
          >
            عروض الأسعار ←
          </Link>
        </div>

        {invoices.length === 0 ? (
          <EmptyPanel
            icon={<FileText className="h-10 w-10" />}
            message="لا توجد فواتير بعد — أصدر فاتورة من عرض سعر معتمد"
          />
        ) : (
          <ul className="crm-stagger space-y-2 p-4">
            {invoices.map((inv) => {
              const previewHref = inv.quote_id
                ? `/crm/quotations/edit/${encodeURIComponent(inv.quote_id)}`
                : `/invoice/${encodeURIComponent(inv.id)}`;
              return (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-colors hover:bg-slate-100/50 dark:border-[#2D3F3A] dark:bg-[#1A2421]/50 dark:hover:bg-[#1A2421]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                      {inv.trip_title || `فاتورة ${inv.id.slice(0, 8)}`}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-slate-500">
                      {formatInvoiceDate(inv.created_at)}
                      {' · '}
                      {INVOICE_TYPE_LABEL[inv.type]}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${invoiceStatusBadgeClass(inv.status)}`}
                      >
                        {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                        {formatCurrency(inv.amount)}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={previewHref}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-white hover:text-slate-900 active:scale-[0.98] dark:text-slate-400 dark:hover:bg-[#22302C] dark:hover:text-[#D4AF37]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    عرض
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] lg:col-span-3">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-slate-400 dark:text-[#D4AF37]/80" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                الوجهات الأعلى ربحية
              </h2>
              <p className="text-[11px] font-medium text-slate-500">تجميع من الرحلات والعروض</p>
            </div>
          </div>
          {chartData.length === 0 ? (
            <EmptyPanel
              icon={<TrendingUp className="h-10 w-10" />}
              message="لا توجد بيانات ربحية للوجهات بعد"
            />
          ) : (
            <div className="h-[340px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                    tickFormatter={(v) =>
                      Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v)
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 11, fontWeight: 600, fill: '#0F172A' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(212,175,55,0.08)' }}
                    formatter={(value, name) => [
                      formatCurrency(Number(value ?? 0)),
                      name === 'profit' ? 'صافي الربح' : 'الإيرادات',
                    ]}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as { fullName?: string } | undefined;
                      return row?.fullName ?? '';
                    }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #E2E8F0',
                      fontWeight: 600,
                      direction: 'rtl',
                    }}
                  />
                  <Bar dataKey="profit" name="profit" radius={[0, 8, 8, 0]} barSize={18}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Crown className="h-5 w-5 text-slate-400 dark:text-[#D4AF37]/80" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">لوحة الخبراء</h2>
              <p className="text-[11px] font-medium text-slate-500">الأعلى إغلاقاً حسب الإيرادات</p>
            </div>
          </div>

          {s.experts.length === 0 ? (
            <EmptyPanel
              icon={<Users className="h-10 w-10" />}
              message="لا يوجد خبراء مرتبطون برحلات مغلقة بعد"
            />
          ) : (
            <div className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-[#2D3F3A]">
              <table className="w-full min-w-[480px] text-right text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-semibold text-slate-600 dark:bg-[#1A2421] dark:text-slate-300">
                    <th className="px-3 py-2.5">#</th>
                    <th className="px-3 py-2.5">الخبير</th>
                    <th className="px-3 py-2.5">رحلات</th>
                    <th className="px-3 py-2.5">إيرادات</th>
                  </tr>
                </thead>
                <tbody>
                  {s.experts.map((expert, index) => (
                    <tr
                      key={expert.expertId}
                      className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-[#2D3F3A] dark:hover:bg-[#1A2421]/50"
                    >
                      <td className="px-3 py-3 text-xs font-semibold text-[#D4AF37]">{index + 1}</td>
                      <td className="px-3 py-3">
                        <Link
                          href={partnerCrmProfilePath('experts', expert.expertId)}
                          className="font-semibold text-slate-900 hover:text-[#D4AF37] dark:text-white"
                        >
                          {expert.name}
                        </Link>
                        <p className="text-[10px] font-medium text-slate-400">
                          ربح {formatCurrency(expert.profit)}
                        </p>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-300">
                        {expert.trips}
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">
                        {formatCurrency(expert.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
