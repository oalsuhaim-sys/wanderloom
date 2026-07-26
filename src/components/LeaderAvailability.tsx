'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { arSA } from 'date-fns/locale';
import { format, parseISO } from 'date-fns';
import {
  DayPicker,
  type DateRange,
  type Matcher,
} from 'react-day-picker';
import 'react-day-picker/style.css';
import { CalendarDays, Check, Clock3, Loader2, Pencil, X } from 'lucide-react';

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

export function LeaderAvailability({ leaderId }: { leaderId: string }) {
  const [records, setRecords] = useState<AvailabilityRecord[]>([]);
  const [range, setRange] = useState<DateRange | undefined>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<
    'available' | 'unavailable' | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const query = new URLSearchParams({ leader_id: leaderId });
      const response = await fetch(
        `/api/leaders/availability?${query.toString()}`,
        { cache: 'no-store' },
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل فترات التفرغ.');
    } finally {
      setLoading(false);
    }
  }, [leaderId]);

  useEffect(() => {
    void Promise.resolve().then(load);
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

  const save = async (status: 'available' | 'unavailable') => {
    if (!range?.from) {
      setError('اختر تاريخ البداية والنهاية أولاً.');
      return;
    }
    const to = range.to ?? range.from;
    setSavingStatus(status);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/leaders/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId ?? undefined,
          leader_id: leaderId,
          start_date: format(range.from, 'yyyy-MM-dd'),
          end_date: format(to, 'yyyy-MM-dd'),
          status,
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
        status === 'available'
          ? 'تم تحديد الفترة كمتاحة.'
          : 'تم تحديد الفترة كغير متاحة.',
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ فترة التفرغ.');
    } finally {
      setSavingStatus(null);
    }
  };

  const editRecord = (record: AvailabilityRecord) => {
    setEditingId(record.id);
    setRange({
      from: parseISO(record.start_date),
      to: parseISO(record.end_date),
    });
    setError(null);
    setNotice('يمكنك تعديل النطاق ثم حفظ حالته من جديد.');
  };

  const clearSelection = () => {
    setRange(undefined);
    setEditingId(null);
    setNotice(null);
  };

  return (
    <section
      className="overflow-hidden rounded-2xl border border-[#C4A464]/25 bg-white shadow-sm"
      dir="rtl"
    >
      <div className="border-b border-[#C4A464]/15 bg-gradient-to-l from-[#10251B] to-[#08140F] px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#C4A464]/30 bg-[#C4A464]/10 text-[#D8BD85]">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-black">رادار التفرغ</h2>
            <p className="mt-0.5 text-xs font-semibold text-white/50">
              اختر نطاقاً زمنياً وحدد حالة توفر قائد الرحلة
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {loading ? (
            <div className="flex min-h-80 items-center justify-center gap-2 text-sm font-bold text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-[#C4A464]" />
              جاري تحميل التقويم…
            </div>
          ) : (
            <DayPicker
              mode="range"
              locale={arSA}
              selected={range}
              onSelect={setRange}
              modifiers={modifiers}
              modifiersClassNames={{
                available:
                  '!bg-emerald-100 !text-emerald-900 hover:!bg-emerald-200',
                unavailable:
                  '!bg-rose-100 !text-rose-800 hover:!bg-rose-200',
                booked: '!bg-slate-200 !text-slate-700',
              }}
              showOutsideDays
              className="mx-auto"
              style={
                {
                  '--rdp-accent-color': '#A88849',
                  '--rdp-accent-background-color': '#F4EBD8',
                  '--rdp-day_button-border-radius': '12px',
                } as CSSProperties
              }
            />
          )}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[11px] font-bold">
            <span className="inline-flex items-center gap-1.5 text-emerald-800">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              متاح
            </span>
            <span className="inline-flex items-center gap-1.5 text-rose-700">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
              غير متاح
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
              محجوز
            </span>
          </div>

          {range?.from ? (
            <div className="mt-5 rounded-xl border border-[#C4A464]/20 bg-[#FBF8F1] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-black text-slate-900">
                  {format(range.from, 'd MMMM yyyy', { locale: arSA })}
                  <span className="mx-2 text-[#C4A464]">←</span>
                  {format(range.to ?? range.from, 'd MMMM yyyy', {
                    locale: arSA,
                  })}
                </p>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  <X className="h-3.5 w-3.5" />
                  إلغاء التحديد
                </button>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void save('available')}
                  disabled={savingStatus !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#153326] px-4 py-3 text-sm font-black text-[#E1C78F] transition hover:bg-[#204834] disabled:opacity-60"
                >
                  {savingStatus === 'available' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  تحديد كمتاح
                </button>
                <button
                  type="button"
                  onClick={() => void save('unavailable')}
                  disabled={savingStatus !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                >
                  {savingStatus === 'unavailable' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  تحديد كغير متاح
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs font-bold text-slate-500">
              اضغط على يوم البداية ثم يوم النهاية لتحديد الفترة.
            </p>
          )}

          {error ? (
            <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
              {notice}
            </p>
          ) : null}
        </div>

        <aside className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <h3 className="inline-flex items-center gap-2 text-sm font-black text-slate-900">
            <Clock3 className="h-4 w-4 text-[#A88849]" />
            الفترات المحفوظة
          </h3>
          {records.length ? (
            <ul className="mt-4 space-y-2">
              {records.map((record) => (
                <li
                  key={record.id}
                  className="rounded-xl border border-slate-100 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${
                          record.status === 'available'
                            ? 'bg-emerald-50 text-emerald-700'
                            : record.status === 'booked'
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {statusLabel(record.status)}
                      </span>
                      <p className="mt-2 text-xs font-bold leading-6 text-slate-700">
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
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-amber-50 hover:text-[#A88849]"
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
            <p className="mt-4 text-center text-xs font-bold leading-6 text-slate-400">
              لم تُحفظ أي فترات تفرغ بعد.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
