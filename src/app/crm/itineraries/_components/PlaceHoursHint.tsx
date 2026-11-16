'use client';

import { useState } from 'react';
import { AlertTriangle, Clock, ExternalLink, Loader2, Pencil, Sparkles } from 'lucide-react';

import { HoursRowsEditor, type HoursRow } from '@/app/crm/vault/_components/PlaceHoursEditor';
import { toast } from '@/lib/crm-toast';
import {
  checkVisit,
  formatDayHoursAr,
  hoursForWeekday,
  parseStoredHours,
  periodsToWeekRows,
  weekdayLabelAr,
  weekRowsToStored,
  type StoredPlaceHours,
} from '@/lib/place-hours';
import { setPlaceHoursOverride } from '@/lib/use-place-hours';

async function authHeader(): Promise<Record<string, string>> {
  const { getClientAccessToken } = await import('@/lib/crm-session-token');
  return { Authorization: `Bearer ${await getClientAccessToken()}` };
}

/**
 * Staff-only, under each stop in the itinerary editor: the place's hours on this trip day, a warning
 * when the visit falls outside them, and two ways to fill them — Claude searches the web, or type them.
 * Hours are saved on the places-bank row, so every itinerary that uses the place gets them.
 */
export default function PlaceHoursHint({
  bankId,
  hours,
  weekday,
  visitTime,
}: {
  /** places-bank id of this stop (no id → nothing to save hours on) */
  bankId: string | null;
  hours: StoredPlaceHours | null | undefined;
  weekday: number | null;
  visitTime?: string;
}) {
  const [busy, setBusy] = useState<'search' | 'save' | null>(null);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<HoursRow[]>([]);

  if (!bankId) return null;

  const known = hours?.status === 'ok' || hours?.businessStatus === 'CLOSED_PERMANENTLY';
  const line = weekday != null ? formatDayHoursAr(hoursForWeekday(hours, weekday)) : null;
  const check = weekday != null ? checkVisit(hours, weekday, visitTime) : 'unknown';
  const dayName = weekday != null ? weekdayLabelAr(weekday) : '';

  const search = async () => {
    setBusy('search');
    try {
      const res = await fetch(`/api/crm/place-hours/${encodeURIComponent(bankId)}`, { method: 'POST', headers: await authHeader() });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; hours?: unknown } | null;
      const h = json?.ok ? parseStoredHours(json.hours) : null;
      if (!h) throw new Error('lookup');
      setPlaceHoursOverride(bankId, h);
      if (h.status === 'ok') toast.success('وجد Claude ساعات العمل ✨');
      else if (h.businessStatus === 'CLOSED_PERMANENTLY') toast.error('المصدر يذكر أن المكان مغلق نهائياً — تأكد منه.');
      else toast.error('لم يجد Claude ساعات موثوقة — أدخلها يدوياً.');
    } catch {
      toast.error('تعذر البحث الآن. أعد المحاولة بعد قليل.');
    } finally {
      setBusy(null);
    }
  };

  const startEdit = () => {
    setRows(periodsToWeekRows(hours?.status === 'ok' ? hours.periods : undefined));
    setEditing(true);
  };

  const saveManual = async () => {
    setBusy('save');
    try {
      const value = weekRowsToStored(rows);
      const res = await fetch(`/api/crm/place-hours/${encodeURIComponent(bankId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ hours: value }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!json?.ok) throw new Error('save');
      setPlaceHoursOverride(bankId, value);
      setEditing(false);
      toast.success('تم حفظ ساعات العمل لهذا المكان.');
    } catch {
      toast.error('تعذر حفظ ساعات العمل.');
    } finally {
      setBusy(null);
    }
  };

  const actionBtn =
    'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition disabled:opacity-60';

  return (
    <div className="mt-2 space-y-1.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {known && line ? (
        <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-600">
          <Clock className="h-3.5 w-3.5 shrink-0 text-[#b8952d]" aria-hidden />
          <span>
            {dayName}: {line}
          </span>
          {hours?.source === 'manual' ? <span className="text-[10px] text-slate-400">(يدوي)</span> : null}
          {hours?.sourceUrl ? (
            <a href={hours.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600" title="مصدر الساعات">
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : null}
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {hours?.status === 'not_found' || hours?.status === 'no_hours'
            ? 'لم يجد Claude ساعات موثوقة — أدخلها يدوياً.'
            : weekday == null && known
              ? 'حدّد تاريخ بداية الرحلة لعرض ساعات كل يوم.'
              : 'ساعات العمل غير معروفة بعد.'}
        </p>
      )}

      {check === 'closed_day' ? (
        <p className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          المكان مغلق يوم {dayName} — انقله ليوم آخر.
        </p>
      ) : check === 'outside_hours' ? (
        <p className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          وقت الزيارة خارج ساعات العمل — عدّل الوقت.
        </p>
      ) : null}

      {editing ? (
        <div className="rounded-xl border border-slate-200 bg-white p-2.5">
          <HoursRowsEditor rows={rows} onRowsChange={setRows} />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void saveManual()}
              disabled={busy === 'save'}
              className={`${actionBtn} border-[#D4AF37] bg-[#D4AF37] text-slate-900`}
            >
              {busy === 'save' ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
              حفظ الساعات
            </button>
            <button type="button" onClick={() => setEditing(false)} className={`${actionBtn} border-slate-200 text-slate-500`}>
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void search()}
            disabled={busy === 'search'}
            className={`${actionBtn} border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#8a6d1c] hover:bg-[#D4AF37]/20`}
          >
            {busy === 'search' ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Sparkles className="h-3 w-3" aria-hidden />}
            {busy === 'search' ? 'Claude يبحث…' : known ? 'ابحث مجدداً بـ Claude' : 'ابحث بـ Claude'}
          </button>
          <button type="button" onClick={startEdit} className={`${actionBtn} border-slate-200 text-slate-600 hover:bg-slate-50`}>
            <Pencil className="h-3 w-3" aria-hidden />
            {known ? 'تعديل يدوي' : 'إدخال يدوي'}
          </button>
        </div>
      )}
    </div>
  );
}
