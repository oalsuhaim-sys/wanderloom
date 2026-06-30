'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Globe2, Hotel, Loader2, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import { supabase } from '@/lib/supabase';

type ItineraryAnalyticsRow = {
  id: number | string;
  created_at?: string | null;
  days_data?: Array<{
    hotel?: {
      name?: string;
      country?: string;
    } | null;
    experience?: {
      country?: string;
    } | null;
  }> | null;
};

type TripAnalyticsRow = {
  destination?: string | null;
  trip_date?: string | null;
  created_at?: string | null;
  profit?: number | null;
};

type CountItem = {
  label: string;
  count: number;
};

function topN(counter: Map<string, number>, limit: number): CountItem[] {
  return [...counter.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function monthKey(dateLike: string | null | undefined): string {
  if (!dateLike) return 'غير محدد';
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return 'غير محدد';
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short' });
}

export default function CRMAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [totalItineraries, setTotalItineraries] = useState(0);
  const [topCountries, setTopCountries] = useState<CountItem[]>([]);
  const [topHotels, setTopHotels] = useState<CountItem[]>([]);
  const [monthlySales, setMonthlySales] = useState<{ month: string; amount: number }[]>([]);

  useEffect(() => {
    async function loadAnalytics() {
      setError('');
      if (!supabase) {
        setError('قاعدة البيانات غير مهيأة. أضف مفاتيح Supabase في البيئة.');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [{ count, error: countErr }, { data: itinerariesData, error: itinErr }, { data: tripsData, error: tripsErr }] =
          await Promise.all([
            supabase.from('itineraries').select('*', { count: 'exact', head: true }),
            supabase.from('itineraries').select('id, created_at, days_data'),
            supabase.from('client_trips').select('destination, trip_date, created_at, profit'),
          ]);

        if (countErr) throw countErr;
        if (itinErr) throw itinErr;
        if (tripsErr) throw tripsErr;

        setTotalItineraries(count ?? 0);

        const countryCounter = new Map<string, number>();
        const hotelCounter = new Map<string, number>();

        const itineraries = (itinerariesData ?? []) as ItineraryAnalyticsRow[];
        for (const itin of itineraries) {
          const days = Array.isArray(itin.days_data) ? itin.days_data : [];
          for (const day of days) {
            const hotelName = day?.hotel?.name?.trim();
            if (hotelName) {
              hotelCounter.set(hotelName, (hotelCounter.get(hotelName) ?? 0) + 1);
            }

            const country = day?.hotel?.country?.trim() || day?.experience?.country?.trim();
            if (country) {
              countryCounter.set(country, (countryCounter.get(country) ?? 0) + 1);
            }
          }
        }

        // fallback من client_trips إذا لم تكن days_data كافية
        if (countryCounter.size === 0) {
          const trips = (tripsData ?? []) as TripAnalyticsRow[];
          for (const t of trips) {
            const c = t.destination?.trim();
            if (!c) continue;
            countryCounter.set(c, (countryCounter.get(c) ?? 0) + 1);
          }
        }

        setTopCountries(topN(countryCounter, 3));
        setTopHotels(topN(hotelCounter, 5));

        const monthlyCounter = new Map<string, number>();
        const trips = (tripsData ?? []) as TripAnalyticsRow[];
        for (const trip of trips) {
          const key = monthKey(trip.trip_date || trip.created_at);
          const value = Number(trip.profit ?? 0);
          monthlyCounter.set(key, (monthlyCounter.get(key) ?? 0) + value);
        }

        const monthly = [...monthlyCounter.entries()]
          .map(([month, amount]) => ({ month, amount }))
          .sort((a, b) => a.month.localeCompare(b.month, 'ar'));
        setMonthlySales(monthly);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : 'تعذر تحميل الإحصائيات.');
      } finally {
        setLoading(false);
      }
    }

    void loadAnalytics();
  }, []);

  const maxMonthly = useMemo(() => Math.max(...monthlySales.map((m) => m.amount), 1), [monthlySales]);

  if (loading) {
    return (
      <div dir="rtl" className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center text-slate-500">
          <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
          جارٍ تحميل لوحة الإحصائيات...
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto max-w-7xl bg-slate-50 p-4 font-[family-name:var(--font-tajawal),system-ui,sans-serif] sm:p-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">الإحصائيات</h1>
          <p className="text-xs font-bold text-slate-500">لوحة فاخرة لمتابعة أداء فريق الرحلات</p>
        </div>
        <Link
          href="/crm/itineraries"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
        >
          العودة للمسارات
        </Link>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-2 inline-flex items-center gap-2 text-sm font-black text-slate-700">
            <BarChart3 className="h-4 w-4 text-[#C9A84C]" />
            إجمالي الرحلات المصممة
          </div>
          <div className="text-3xl font-black text-slate-900">{totalItineraries}</div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-2 inline-flex items-center gap-2 text-sm font-black text-slate-700">
            <Globe2 className="h-4 w-4 text-[#C9A84C]" />
            أكثر 3 دول طلباً
          </div>
          <div className="space-y-1">
            {topCountries.length === 0 ? (
              <p className="text-sm text-slate-400">لا توجد بيانات كافية.</p>
            ) : (
              topCountries.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1 text-sm">
                  <span className="font-bold text-slate-700">{item.label}</span>
                  <span className="font-black text-slate-900">{item.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-2 inline-flex items-center gap-2 text-sm font-black text-slate-700">
            <Hotel className="h-4 w-4 text-[#C9A84C]" />
            أكثر 5 فنادق اختياراً
          </div>
          <div className="space-y-1">
            {topHotels.length === 0 ? (
              <p className="text-sm text-slate-400">لا توجد بيانات كافية.</p>
            ) : (
              topHotels.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1 text-sm">
                  <span className="truncate font-bold text-slate-700">{item.label}</span>
                  <span className="mr-2 shrink-0 font-black text-slate-900">{item.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4 inline-flex items-center gap-2 text-base font-black text-slate-800">
          <TrendingUp className="h-4 w-4 text-[#C9A84C]" />
          نمو المبيعات الشهري
        </div>

        {monthlySales.length === 0 ? (
          <p className="text-sm text-slate-400">لا توجد بيانات مبيعات لعرض الرسم البياني.</p>
        ) : (
          <div className="space-y-3">
            {monthlySales.map((m) => {
              const width = Math.max(8, Math.round((m.amount / maxMonthly) * 100));
              return (
                <div key={m.month}>
                  <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>{m.month}</span>
                    <span>{m.amount.toLocaleString()} ر.س</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100">
                    <div
                      className="h-2.5 rounded-full bg-gradient-to-l from-[#7a5f28] to-[#d4b87a] transition-all duration-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

