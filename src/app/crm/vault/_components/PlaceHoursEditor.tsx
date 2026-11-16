'use client';

import { Clock, ExternalLink, Loader2, Search } from 'lucide-react';

import {
  formatDayHoursAr,
  hoursForWeekday,
  weekdayLabelAr,
  type StoredPlaceHours,
} from '@/lib/place-hours';

export type HoursRow = { closed: boolean; from: string; to: string };
export type HoursMode = 'auto' | 'manual';

const TIME_INPUT =
  'w-[88px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-amber-500 disabled:opacity-40 [color-scheme:light] dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-100';

/** Opening hours in the places bank: found on the web automatically, or typed by staff. */
export default function PlaceHoursEditor({
  mode,
  rows,
  current,
  onModeChange,
  onRowsChange,
  onLookup,
  lookingUp,
}: {
  mode: HoursMode;
  rows: HoursRow[];
  /** What is cached now (shown in automatic mode). */
  current: StoredPlaceHours | null;
  onModeChange: (mode: HoursMode) => void;
  onRowsChange: (rows: HoursRow[]) => void;
  /** Look the hours up on the web now. */
  onLookup?: () => void;
  lookingUp?: boolean;
}) {
  const auto = current && current.source !== 'manual' ? current : null;

  return (
    <div className="mb-4 rounded-xl border border-slate-200 p-3 text-right dark:border-[#2D3F3A]">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400">
        <Clock className="h-3.5 w-3.5 text-amber-600" aria-hidden />
        ساعات العمل
      </p>
      <div className="mb-3 flex gap-2 text-xs font-bold">
        {(
          [
            ['auto', 'تلقائي (من الإنترنت)'],
            ['manual', 'إدخال يدوي'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(value)}
            className={`flex-1 rounded-lg border px-2 py-1.5 transition ${
              mode === value
                ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-[#2D3F3A]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'auto' ? (
        <div className="space-y-2">
          {auto?.status === 'ok' ? (
            <ul className="space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
              {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                <li key={d}>
                  <span className="font-bold">{weekdayLabelAr(d)}:</span> {formatDayHoursAr(hoursForWeekday(auto, d))}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs leading-relaxed text-slate-500">
              {auto?.businessStatus === 'CLOSED_PERMANENTLY'
                ? 'المصدر يذكر أن المكان مغلق نهائياً — تأكد منه.'
                : auto?.status === 'no_hours' || auto?.status === 'not_found'
                  ? 'لم نجد ساعات موثوقة لهذا المكان على الإنترنت. اختر «إدخال يدوي» لكتابتها.'
                  : 'اضغط «ابحث الآن» ليبحث Claude عن ساعات المكان في الإنترنت.'}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            {onLookup ? (
              <button
                type="button"
                onClick={onLookup}
                disabled={lookingUp}
                className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:underline disabled:opacity-60"
              >
                {lookingUp ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Search className="h-3.5 w-3.5" aria-hidden />}
                {lookingUp ? 'جاري البحث…' : auto ? 'ابحث مجدداً' : 'ابحث الآن'}
              </button>
            ) : (
              <span />
            )}
            {auto?.sourceUrl ? (
              <a
                href={auto.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-[60%] items-center gap-1 truncate text-[11px] text-slate-400 hover:text-slate-600"
                dir="ltr"
              >
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">{auto.sourceUrl.replace(/^https?:\/\/(www\.)?/, '')}</span>
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <HoursRowsEditor rows={rows} onRowsChange={onRowsChange} />
      )}
    </div>
  );
}

/** Seven day rows: closed / from / to. Shared by the places bank and the itinerary editor. */
export function HoursRowsEditor({ rows, onRowsChange }: { rows: HoursRow[]; onRowsChange: (rows: HoursRow[]) => void }) {
  const setRow = (i: number, patch: Partial<HoursRow>) => onRowsChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const copyFirst = () => {
    const first = rows.find((r) => !r.closed);
    if (first) onRowsChange(rows.map(() => ({ ...first })));
  };
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-16 shrink-0 font-bold text-slate-700 dark:text-slate-300">{weekdayLabelAr(i)}</span>
          <label className="flex shrink-0 items-center gap-1 text-slate-500">
            <input type="checkbox" checked={r.closed} onChange={(e) => setRow(i, { closed: e.target.checked })} />
            مغلق
          </label>
          <input type="time" value={r.from} disabled={r.closed} onChange={(e) => setRow(i, { from: e.target.value })} className={TIME_INPUT} dir="ltr" />
          <span className="text-slate-400">–</span>
          <input type="time" value={r.to} disabled={r.closed} onChange={(e) => setRow(i, { to: e.target.value })} className={TIME_INPUT} dir="ltr" />
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={copyFirst} className="text-xs font-bold text-amber-700 hover:underline">
          نفس الوقت لكل الأيام
        </button>
        <span className="text-[11px] text-slate-400">الإغلاق 00:00 = منتصف الليل</span>
      </div>
    </div>
  );
}
