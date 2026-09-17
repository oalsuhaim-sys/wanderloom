'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';

import type { GeneratedItineraryDay } from '@/lib/ai-generate-itinerary';
import { getClientAccessToken } from '@/lib/crm-session-token';
import { toast } from '@/lib/crm-toast';

export type GenerateItineraryAiContext = {
  clientName: string;
  destination: string;
  daysCount: number;
  interests: string[];
  dnaSummary: string[];
  dietary?: string;
  hotelPreferences?: string;
  secretNotes?: string;
  tripDateFrom?: string;
  tripDateTo?: string;
  /** Full DNA object sent to the API */
  dna?: Record<string, unknown> | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  context: GenerateItineraryAiContext;
  onGenerated: (days: GeneratedItineraryDay[]) => void;
  /** When true, replace existing days; UI confirms before generate */
  replaceExisting?: boolean;
};

export default function GenerateItineraryAiModal({
  open,
  onClose,
  context,
  onGenerated,
  replaceExisting = true,
}: Props) {
  const [destination, setDestination] = useState(context.destination);
  const [daysCount, setDaysCount] = useState(Math.max(1, context.daysCount || 1));
  const [chatContext, setChatContext] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDestination(context.destination);
    setDaysCount(Math.max(1, Math.min(14, context.daysCount || 1)));
    setChatContext('');
  }, [open, context.destination, context.daysCount]);

  const dnaLines = useMemo(() => {
    const lines = [...(context.dnaSummary ?? [])].filter(Boolean);
    if (context.dietary?.trim()) lines.push(`نظام غذائي: ${context.dietary.trim()}`);
    if (context.hotelPreferences?.trim()) lines.push(`تفضيل فندق: ${context.hotelPreferences.trim()}`);
    if (context.secretNotes?.trim()) lines.push(`ملاحظات VIP: ${context.secretNotes.trim()}`);
    return lines;
  }, [context]);

  async function handleGenerate() {
    const dest = destination.trim();
    if (!dest) {
      toast.error('أدخل الوجهة أولاً.');
      return;
    }

    setBusy(true);
    try {
      let accessToken = '';
      try {
        accessToken = await getClientAccessToken();
      } catch (authErr) {
        throw new Error(
          authErr instanceof Error
            ? authErr.message
            : 'انتهت الجلسة — يرجى تسجيل الدخول مرة أخرى.',
        );
      }

      const res = await fetch('/api/admin/generate-itinerary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          destination: dest,
          daysCount,
          clientName: context.clientName,
          interests: context.interests,
          dna: context.dna ?? null,
          dietary: context.dietary,
          hotelPreferences: context.hotelPreferences,
          secretNotes: context.secretNotes,
          tripDateFrom: context.tripDateFrom,
          tripDateTo: context.tripDateTo,
          chatContext: chatContext.trim(),
        }),
      });

      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        days?: GeneratedItineraryDay[];
        message?: string;
        error?: string;
        stopCount?: number;
      } | null;

      if (!res.ok || !json?.ok || !Array.isArray(json.days) || json.days.length === 0) {
        throw new Error(json?.message || json?.error || 'تعذر توليد المسار');
      }

      onGenerated(json.days);
      toast.success(
        `تم توليد ${json.days.length} يوم · ${json.stopCount ?? json.days.reduce((n, d) => n + d.stops.length, 0)} محطة — راجع وعدّل قبل الحفظ`,
      );
      onClose();
    } catch (err) {
      console.error('[GenerateItineraryAiModal]', err);
      toast.error(err instanceof Error ? err.message : 'فشل توليد المسار');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]" dir="rtl">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label="إغلاق"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[#E5E0D5] bg-[#FDFBF7] shadow-2xl sm:inset-y-auto sm:bottom-auto sm:top-1/2 sm:max-h-[85vh] sm:-translate-y-1/2 sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#E5E0D5] bg-[#FDFBF7]/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#b8954d]">
              Claude · Senior Travel Engineer
            </p>
            <h2 className="mt-1 text-lg font-extrabold text-[#1A3B2A]">
              توليد المسار بالذكاء الاصطناعي ✨
            </h2>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-2xl border border-[#C5A059]/25 bg-white p-4">
            <p className="text-xs font-black text-[#1A3B2A]">العميل</p>
            <p className="mt-1 text-sm font-bold text-slate-800">
              {context.clientName?.trim() || 'عميل VIP'}
            </p>
            {context.interests.length > 0 ? (
              <p className="mt-2 text-xs font-semibold text-slate-600">
                اهتمامات: {context.interests.join(' · ')}
              </p>
            ) : null}
            {dnaLines.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {dnaLines.slice(0, 8).map((line) => (
                  <li
                    key={line}
                    className="rounded-lg border border-amber-100/80 bg-amber-50/50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                لا DNA مفصّل بعد — سيُولَّد المسار من الوجهة والاهتمامات المتاحة.
              </p>
            )}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-black text-[#1A3B2A]">الوجهة</span>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="مثال: طوكيو · سيول · بالي"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-[#1A3B2A] outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/30"
              disabled={busy}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-black text-[#1A3B2A]">عدد الأيام</span>
            <input
              type="number"
              min={1}
              max={14}
              value={daysCount}
              onChange={(e) =>
                setDaysCount(Math.min(14, Math.max(1, Number(e.target.value) || 1)))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-[#1A3B2A] outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/30"
              dir="ltr"
              disabled={busy}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-black text-[#1A3B2A]">
              سياق إضافي من المحادثة (اختياري)
            </span>
            <textarea
              value={chatContext}
              onChange={(e) => setChatContext(e.target.value)}
              rows={3}
              placeholder="مثال: يحب الهدوء، يتجنب الحشود، يفضّل قهوة مقطّرة…"
              className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#1A3B2A] outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/30"
              disabled={busy}
            />
          </label>

          {replaceExisting ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
              سيتم استبدال أيام المسار الحالية في المُنشئ بالمسار المُولَّد — يمكنك التعديل وإضافة الصور
              قبل الحفظ.
            </p>
          ) : null}
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-[#E5E0D5] bg-[#FDFBF7] px-5 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleGenerate()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-black text-[#1A3B2A] shadow-sm transition hover:bg-[#c4a030] disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                جاري التوليد…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden />
                توليد المسار بـ AI
              </>
            )}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
