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
  Loader2,
  PiggyBank,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import { getFinancialAnalyticsAction } from '@/app/actions/financialAnalyticsActions';
import { formatInvoiceAmount } from '@/lib/crm-invoices';
import { fetchFinancialAnalyticsBrowser } from '@/lib/financial-analytics-browser';
import type { FinancialAnalyticsSnapshot } from '@/lib/financial-analytics';
import { partnerCrmProfilePath } from '@/lib/partner-dna';

const BAR_COLORS = ['#1A3B2A', '#C5A059', '#244F38', '#8A6B2A', '#152e21', '#D4AF37'];

function MetricCard({
  label,
  value,
  sub,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  highlight?: 'gold' | 'emerald' | 'slate';
}) {
  const shell =
    highlight === 'gold'
      ? 'border-[#C5A059]/45 bg-gradient-to-br from-[#1A3B2A] to-[#152e21] text-white shadow-[0_12px_40px_rgba(26,59,42,0.28)]'
      : highlight === 'emerald'
        ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white'
        : 'border-gray-100 bg-white';

  const valueClass =
    highlight === 'gold'
      ? 'text-[#C5A059]'
      : highlight === 'emerald'
        ? 'text-emerald-800'
        : 'text-[#1A3B2A]';

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-6 shadow-sm ${shell}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p
          className={`text-[10px] font-black uppercase tracking-[0.22em] ${
            highlight === 'gold' ? 'text-[#C5A059]/90' : 'text-[#C5A059]'
          }`}
        >
          {label}
        </p>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            highlight === 'gold'
              ? 'bg-[#C5A059]/20 text-[#C5A059]'
              : 'bg-[#1A3B2A]/8 text-[#1A3B2A]'
          }`}
        >
          {icon}
        </span>
      </div>
      <p className={`text-3xl font-black tabular-nums ${valueClass}`} dir="ltr">
        {value}
      </p>
      {sub ? (
        <p
          className={`mt-2 text-[11px] font-semibold ${
            highlight === 'gold' ? 'text-white/60' : 'text-slate-500'
          }`}
        >
          {sub}
        </p>
      ) : null}
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
      setError(server.error || 'تعذر تحميل البيانات المالية.');
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
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-[#C5A059]" />
        <span className="text-sm font-bold">جاري حساب الهوامش والأرباح…</span>
      </div>
    );
  }

  const s = snapshot ?? {
    grossRevenue: 0,
    totalCosts: 0,
    netProfit: 0,
    marginPct: 0,
    closedTripCount: 0,
    destinations: [],
    experts: [],
  };

  return (
    <div dir="rtl" className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#C5A059]">
            Financial Analytics
          </p>
          <h1 className="mt-1 text-2xl font-black text-[#1A3B2A] sm:text-3xl">
            لوحة الأرباح والذكاء المالي
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            صافي الربح = إيرادات العملاء − تكاليف الطيران والفنادق والموردين ·{' '}
            {s.closedTripCount} رحلة محسوبة
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/crm/reports"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-50"
          >
            التقارير التفصيلية
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1A3B2A] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#152e21]"
          >
            <RefreshCw className="h-3.5 w-3.5 text-[#C5A059]" />
            تحديث
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="إجمالي الإيرادات"
          value={formatInvoiceAmount(s.grossRevenue)}
          sub="مدفوعات العملاء والعروض المسدّدة"
          icon={<Wallet className="h-5 w-5" />}
        />
        <MetricCard
          label="التكاليف"
          value={formatInvoiceAmount(s.totalCosts)}
          sub="طيران · فنادق · موردون (تكلفة تقديرية)"
          icon={<TrendingDown className="h-5 w-5" />}
          highlight="emerald"
        />
        <MetricCard
          label="صافي الربح"
          value={formatInvoiceAmount(s.netProfit)}
          sub={`هامش الربح ${s.marginPct.toLocaleString('ar-SA')}٪`}
          icon={<PiggyBank className="h-5 w-5" />}
          highlight="gold"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-3">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#C5A059]" />
            <div>
              <h2 className="text-base font-black text-[#1A3B2A]">الوجهات الأعلى ربحية</h2>
              <p className="text-[11px] font-semibold text-slate-500">
                تجميع صافي الربح حسب الوجهة
              </p>
            </div>
          </div>
          {chartData.length === 0 ? (
            <p className="py-16 text-center text-sm font-bold text-slate-400">
              لا توجد بيانات ربحية للوجهات بعد
            </p>
          ) : (
            <div className="h-[340px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E4D8" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                    tickFormatter={(v) =>
                      Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v)
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#1A3B2A' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(197,160,89,0.08)' }}
                    formatter={(value, name) => [
                      formatInvoiceAmount(Number(value ?? 0)),
                      name === 'profit' ? 'صافي الربح' : 'الإيرادات',
                    ]}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as { fullName?: string } | undefined;
                      return row?.fullName ?? '';
                    }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #E8E4D8',
                      fontWeight: 700,
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

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Crown className="h-5 w-5 text-[#C5A059]" />
            <div>
              <h2 className="text-base font-black text-[#1A3B2A]">لوحة الخبراء</h2>
              <p className="text-[11px] font-semibold text-slate-500">
                الأعلى إغلاقاً حسب الإيرادات
              </p>
            </div>
          </div>

          {s.experts.length === 0 ? (
            <p className="py-12 text-center text-sm font-bold text-slate-400">
              لا يوجد خبراء مرتبطون برحلات مغلقة بعد
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-[#1A3B2A]/5 text-[11px] font-black text-[#1A3B2A]">
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
                      className="border-t border-slate-100 transition hover:bg-[#F9F9F6]"
                    >
                      <td className="px-3 py-3 text-xs font-black text-[#C5A059]">
                        {index + 1}
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={partnerCrmProfilePath('experts', expert.expertId)}
                          className="font-bold text-[#1A3B2A] hover:text-[#C5A059]"
                        >
                          {expert.name}
                        </Link>
                        <p className="text-[10px] font-semibold text-slate-400" dir="ltr">
                          ربح {formatInvoiceAmount(expert.profit)}
                        </p>
                      </td>
                      <td className="px-3 py-3 font-black text-slate-700">{expert.trips}</td>
                      <td className="px-3 py-3 font-black text-[#1A3B2A]" dir="ltr">
                        {formatInvoiceAmount(expert.revenue)}
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
