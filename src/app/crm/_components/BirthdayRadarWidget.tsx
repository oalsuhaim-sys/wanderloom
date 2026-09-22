'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Cake, Loader2, RefreshCw } from 'lucide-react';

import {
  filterUpcomingBirthdays,
  formatBirthdayDisplayDate,
  type BirthdayRadarClient,
} from '@/lib/birthday-radar';
import { supabase } from '@/lib/supabase';

type Props = {
  /** Lookahead window in days (default 7) */
  withinDays?: number;
  className?: string;
};

function countdownLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'اليوم';
  if (daysUntil === 1) return 'غداً';
  return `بعد ${daysUntil} أيام`;
}

export function BirthdayRadarWidget({ withinDays = 7, className = '' }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<BirthdayRadarClient[]>([]);

  const load = useCallback(async () => {
    if (!supabase) {
      setError('قاعدة البيانات غير مهيأة.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from('clients')
        .select('id, name, birth_date, phone_wa')
        .not('birth_date', 'is', null)
        .order('name', { ascending: true })
        .limit(2000);

      if (qErr) throw qErr;

      setAlerts(
        filterUpcomingBirthdays((data ?? []) as Record<string, unknown>[], withinDays),
      );
    } catch (e) {
      console.error('[BirthdayRadar]', e);
      setError(e instanceof Error ? e.message : 'تعذر تحميل رادار أعياد الميلاد.');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [withinDays]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-b from-[#FFF8E7] to-white shadow-sm dark:from-[#2A3220] dark:to-[#22302C] dark:border-[#D4AF37]/25 ${className}`}
      dir="rtl"
      aria-labelledby="birthday-radar-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D4AF37]/20 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D4AF37]/20 text-[#9C7A3C]">
            <Cake className="h-4.5 w-4.5" aria-hidden />
          </span>
          <div>
            <h2
              id="birthday-radar-title"
              className="text-sm font-black text-[#1C2E3A] dark:text-[#F4EFE6] sm:text-base"
            >
              🎂 رادار أعياد الميلاد القادمة (خلال {withinDays} أيام)
            </h2>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              تنبيه تشغيلي — تهنئة العملاء قبل الموعد
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/40 bg-white px-3 py-1.5 text-xs font-bold text-[#5C4A22] transition hover:bg-[#FFF8E7] disabled:opacity-50 dark:bg-[#1A2421] dark:text-[#E8D5A3]"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          تحديث
        </button>
      </div>

      <div className="px-4 py-4 sm:px-5">
        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">
            {error}
          </p>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm font-bold text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" aria-hidden />
            جاري مسح أعياد الميلاد…
          </div>
        ) : alerts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#D4AF37]/30 bg-white/60 px-4 py-6 text-center text-sm font-bold text-slate-500 dark:bg-[#1A2421]/40 dark:text-slate-400">
            لا أعياد ميلاد خلال الـ {withinDays} أيام القادمة.
          </p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li key={alert.id}>
                <Link
                  href={`/crm/clients/${encodeURIComponent(alert.id)}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D4AF37]/25 bg-white/90 px-3 py-2.5 transition hover:border-[#D4AF37]/55 hover:shadow-sm dark:bg-[#1A2421]/70"
                >
                  <p className="text-sm font-bold text-[#1C2E3A] dark:text-[#F4EFE6]">
                    العميل{' '}
                    <span className="text-[#9C7A3C]">{alert.name}</span>
                    {' — '}
                    يوم ميلاده بتاريخ{' '}
                    <span className="tabular-nums" dir="ltr">
                      {formatBirthdayDisplayDate(alert.birth_date)}
                    </span>{' '}
                    ({countdownLabel(alert.daysUntilBirthday)})
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                      alert.daysUntilBirthday === 0
                        ? 'bg-rose-100 text-rose-800'
                        : alert.daysUntilBirthday <= 2
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-[#D4AF37]/15 text-[#5C4A22]'
                    }`}
                  >
                    {alert.daysUntilBirthday === 0
                      ? 'اليوم 🎉'
                      : `بعد ${alert.daysUntilBirthday} يوم`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
