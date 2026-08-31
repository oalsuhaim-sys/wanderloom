'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { arSA } from 'date-fns/locale';
import { format, parseISO } from 'date-fns';
import { DayPicker, type DateRange, type Matcher } from 'react-day-picker';
import 'react-day-picker/style.css';
import { CalendarDays, Check, Clock3, Loader2, Pencil, X } from 'lucide-react';

import { getClientAccessToken } from '@/lib/crm-session-token';

type AvailabilityStatus = 'available' | 'unavailable' | 'booked';

type AvailabilityRecord = {
  id: string;
  leader_id: string;
  start_date: string;
  end_date: string;
  status: AvailabilityStatus;
};

function recordMatcher(record: AvailabilityRecord): Matcher {
  return {
    from: parseISO(record.start_date),
    to: parseISO(record.end_date),
  };
}

function statusLabel(status: AvailabilityStatus): string {
  if (status === 'available') return 'متاح';
  if (status === 'booked') return 'محجوز';
  return 'غير متاح';
}

const DAY_BTN =
  'aspect-square flex w-full items-center justify-center rounded-xl text-sm font-medium transition-all hover:bg-slate-100 dark:hover:bg-[#2D3F3A]';

export function LeaderAvailability({ leaderId }: { leaderId: string }) {
  const [records, setRecords] = useState<AvailabilityRecord[]>([]);
  const [range, setRange] = useState<DateRange | undefined>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveAs, setSaveAs] = useState<'available' | 'unavailable'>('available');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const authenticatedFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const accessToken = await getClientAccessToken();
      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${accessToken}`);
      if (init?.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      return fetch(input, { ...init, headers, cache: 'no-store' });
    },
    [],
  );

  const load = useCallback(async () => {
    try {
      const query = new URLSearchParams({ leader_id: leaderId });
      const response = await authenticatedFetch(
        `/api/leaders/availability?${query.toString()}`,
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        records?: AvailabilityRecord[];
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'تعذر تحميل فترات التفرغ.');
      }
      setRecords(Array.isArray(payload.records) ? payload.records : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل فترات التفرغ.');
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch, leaderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const modifiers = useMemo(
    () => ({
      available: records
        .filter((record) => record.status === 'available')
        .map(recordMatcher),
      unavailable: records
        .filter((record) => record.status === 'unavailable')
        .map(recordMatcher),
      booked: records
        .filter((record) => record.status === 'booked')
        .map(recordMatcher),
    }),
    [records],
  );

  const save = async () => {
    if (!range?.from) {
      setError('اختر تاريخ البداية والنهاية أولاً.');
      return;
    }
    const to = range.to ?? range.from;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await authenticatedFetch('/api/leaders/availability', {
        method: 'POST',
        body: JSON.stringify({
          id: editingId ?? undefined,
          leader_id: leaderId,
          start_date: format(range.from, 'yyyy-MM-dd'),
          end_date: format(to, 'yyyy-MM-dd'),
          status: saveAs,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'تعذر حفظ فترة التفرغ.');
      }
      setRange(undefined);
      setEditingId(null);
      setNotice(
        saveAs === 'available'
          ? 'تم حفظ الفترة كمتاحة.'
          : 'تم حفظ الفترة كغير متاحة.',
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ فترة التفرغ.');
    } finally {
      setSaving(false);
    }
  };

  const editRecord = (record: AvailabilityRecord) => {
    setEditingId(record.id);
    setRange({
      from: parseISO(record.start_date),
      to: parseISO(record.end_date),
    });
    setSaveAs(record.status === 'unavailable' ? 'unavailable' : 'available');
    setError(null);
    setNotice('يمكنك تعديل النطاق ثم حفظ الفترة.');
  };

  const clearSelection = () => {
    setRange(undefined);
    setEditingId(null);
    setNotice(null);
  };

  return (
    <section
      className="relative z-0 mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]"
      dir="rtl"
    >
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4 text-white dark:border-[#2D3F3A] dark:from-[#1A2421] dark:to-[#22302C]">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white dark:border-[#D4AF37]/30 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37]">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold">رادار التفرغ</h2>
            <p className="mt-0.5 text-xs font-medium text-white/50">
              اختر نطاقاً زمنياً وحدد حالة توفر قائد الرحلة
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-0 flex flex-col gap-6 overflow-hidden p-5 md:flex-row md:items-start">
        {/* Calendar column */}
        <div className="relative z-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 dark:border-[#2D3F3A] dark:bg-[#1A2421]">
          {loading ? (
            <div className="flex min-h-80 items-center justify-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400 dark:text-[#D4AF37]" />
              جاري تحميل التقويم…
            </div>
          ) : (
            <div className="leader-availability-calendar relative z-0 w-full overflow-hidden">
              <DayPicker
                mode="range"
                locale={arSA}
                selected={range}
                onSelect={setRange}
                modifiers={modifiers}
                modifiersClassNames={{
                  available:
                    '[&>button]:bg-emerald-500/10 [&>button]:font-bold [&>button]:text-emerald-600 [&>button]:border [&>button]:border-emerald-500/30 dark:[&>button]:text-emerald-400',
                  unavailable:
                    '[&>button]:bg-rose-500/10 [&>button]:text-rose-600 [&>button]:border [&>button]:border-rose-500/30 dark:[&>button]:text-rose-400',
                  booked:
                    '[&>button]:cursor-not-allowed [&>button]:bg-slate-200 [&>button]:text-slate-400 dark:[&>button]:bg-[#2D3F3A]',
                }}
                showOutsideDays
                classNames={{
                  root: 'w-full relative z-0 overflow-hidden',
                  months: 'w-full flex flex-col',
                  month: 'w-full space-y-3',
                  month_caption:
                    'relative flex h-10 items-center justify-center px-10',
                  caption_label:
                    'text-sm font-bold text-slate-900 dark:text-white',
                  nav: 'absolute inset-x-0 top-0 flex h-10 items-center justify-between px-1',
                  button_previous:
                    'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-[#2D3F3A] dark:text-slate-300 dark:hover:bg-[#2D3F3A]',
                  button_next:
                    'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-[#2D3F3A] dark:text-slate-300 dark:hover:bg-[#2D3F3A]',
                  month_grid: 'w-full border-separate border-spacing-0',
                  weekdays: 'grid grid-cols-7 gap-1 text-center mb-3',
                  weekday:
                    'text-center text-xs font-semibold text-slate-500 dark:text-slate-400',
                  weeks: 'block space-y-1',
                  week: 'grid grid-cols-7 gap-1 text-center',
                  day: 'relative p-0 text-center',
                  day_button: DAY_BTN,
                  selected:
                    '[&>button]:bg-slate-900 [&>button]:text-white dark:[&>button]:bg-[#D4AF37]/25 dark:[&>button]:text-[#D4AF37]',
                  range_start:
                    '[&>button]:bg-slate-900 [&>button]:text-white dark:[&>button]:bg-[#D4AF37]/30 dark:[&>button]:text-[#D4AF37]',
                  range_end:
                    '[&>button]:bg-slate-900 [&>button]:text-white dark:[&>button]:bg-[#D4AF37]/30 dark:[&>button]:text-[#D4AF37]',
                  range_middle:
                    '[&>button]:bg-slate-100 [&>button]:text-slate-900 dark:[&>button]:bg-[#2D3F3A] dark:[&>button]:text-gray-100',
                  today:
                    '[&>button]:ring-1 [&>button]:ring-[#D4AF37]/50',
                  outside: '[&>button]:text-slate-300 dark:[&>button]:text-slate-600',
                  disabled: '[&>button]:opacity-40',
                  hidden: 'invisible',
                }}
                style={
                  {
                    '--rdp-accent-color': '#0F172A',
                    '--rdp-accent-background-color': '#F1F5F9',
                    '--rdp-day-height': '2.5rem',
                    '--rdp-day-width': '100%',
                    '--rdp-day_button-height': '2.5rem',
                    '--rdp-day_button-width': '100%',
                    '--rdp-day_button-border-radius': '0.75rem',
                  } as CSSProperties
                }
              />
            </div>
          )}

          <div className="my-4 flex items-center justify-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              متاح
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              غير متاح
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
              محجوز
            </span>
          </div>

          {range?.from ? (
            <div className="mt-2 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#2D3F3A] dark:bg-[#22302C]/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {format(range.from, 'd MMMM yyyy', { locale: arSA })}
                  <span className="mx-2 text-slate-400 dark:text-[#D4AF37]">←</span>
                  {format(range.to ?? range.from, 'd MMMM yyyy', {
                    locale: arSA,
                  })}
                </p>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-[#D4AF37]"
                >
                  <X className="h-3.5 w-3.5" />
                  إلغاء التحديد
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSaveAs('available')}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                    saveAs === 'available'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'border-slate-200 bg-white text-slate-600 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300'
                  }`}
                >
                  متاح
                </button>
                <button
                  type="button"
                  onClick={() => setSaveAs('unavailable')}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                    saveAs === 'unavailable'
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400'
                      : 'border-slate-200 bg-white text-slate-600 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300'
                  }`}
                >
                  غير متاح
                </button>
              </div>

              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-slate-900 py-3 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-60 dark:border-[#D4AF37]/40 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                حفظ الفترة المحددة
              </button>
            </div>
          ) : (
            <p className="mt-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-6 text-center text-sm text-slate-600 dark:border-[#2D3F3A] dark:bg-[#22302C]/50 dark:text-slate-300">
              اضغط على يوم البداية ثم يوم النهاية لتحديد الفترة.
            </p>
          )}

          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
            >
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
              {notice}
            </p>
          ) : null}
        </div>

        {/* Saved intervals column */}
        <aside className="relative z-0 w-full shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-[#2D3F3A] dark:bg-[#22302C] md:w-80">
          <h3 className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Clock3 className="h-4 w-4 text-[#D4AF37]" />
            الفترات المحفوظة
          </h3>
          {records.length ? (
            <ul className="mt-4 space-y-2">
              {records.map((record) => (
                <li
                  key={record.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 dark:border-[#2D3F3A] dark:bg-[#1A2421]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          record.status === 'available'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : record.status === 'booked'
                              ? 'bg-slate-200 text-slate-600 dark:bg-[#2D3F3A] dark:text-slate-400'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {statusLabel(record.status)}
                      </span>
                      <p className="mt-2 text-xs font-medium leading-6 text-slate-700 dark:text-slate-300">
                        {format(parseISO(record.start_date), 'd MMM yyyy', {
                          locale: arSA,
                        })}
                        <br />
                        {format(parseISO(record.end_date), 'd MMM yyyy', {
                          locale: arSA,
                        })}
                      </p>
                    </div>
                    {record.status !== 'booked' ? (
                      <button
                        type="button"
                        onClick={() => editRecord(record)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-[#D4AF37] dark:hover:bg-[#2D3F3A]"
                        aria-label="تعديل الفترة"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-center text-xs font-medium leading-6 text-slate-500 dark:text-slate-400">
              لم تُحفظ أي فترات تفرغ بعد.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
