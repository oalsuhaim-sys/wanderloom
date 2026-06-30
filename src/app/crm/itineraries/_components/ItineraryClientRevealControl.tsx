'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Lock, Unlock } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { parseBypass24hLock } from '@/lib/vip-vault-reveal';

type Toast = { type: 'success' | 'error'; message: string } | null;

type Props = {
  itineraryId: string | number;
  initialBypass: boolean;
  onBypassChange?: (value: boolean) => void;
};

export default function ItineraryClientRevealControl({
  itineraryId,
  initialBypass,
  onBypassChange,
}: Props) {
  const [bypass, setBypass] = useState(initialBypass);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    setBypass(initialBypass);
  }, [initialBypass]);

  const queryId =
    typeof itineraryId === 'number' || /^\d+$/.test(String(itineraryId))
      ? Number(itineraryId)
      : itineraryId;

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  const updateBypass = useCallback(
    async (next: boolean) => {
      if (!supabase) {
        showToast('error', 'قاعدة البيانات غير مهيأة.');
        return;
      }
      setSaving(true);
      try {
        const { error } = await supabase
          .from('itineraries')
          .update({ bypass_24h_lock: next })
          .eq('id', queryId);

        if (error) {
          const msg = error.message ?? '';
          if (/bypass_24h_lock|column|schema cache|does not exist/i.test(msg)) {
            showToast(
              'error',
              'عمود bypass_24h_lock غير موجود. نفّذ supabase/sql/itineraries_bypass_24h_lock.sql',
            );
          } else {
            showToast('error', msg || 'تعذر تحديث الإعداد.');
          }
          return;
        }

        setBypass(next);
        onBypassChange?.(next);
        showToast(
          'success',
          next
            ? 'تم فتح المسار للعميل فوراً — يتجاوز قفل 24 ساعة.'
            : 'تم تفعيل قفل 24 ساعة — العد التنازلي التلقائي مفعّل.',
        );
      } catch (e) {
        showToast('error', e instanceof Error ? e.message : 'تعذر تحديث الإعداد.');
      } finally {
        setSaving(false);
      }
    },
    [queryId, onBypassChange, showToast],
  );

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/35 bg-white p-4 shadow-sm ring-1 ring-[#1E2720]/5 sm:p-5"
      aria-labelledby="client-reveal-control-title"
    >
      <div className="pointer-events-none absolute -left-6 -top-6 h-24 w-24 rounded-full bg-[#D4AF37]/10 blur-2xl" aria-hidden />

      <div className="relative mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D4AF37]">
            VIP Client Portal
          </p>
          <h3
            id="client-reveal-control-title"
            className="mt-1 text-base font-black text-[#1E2720]"
          >
            التحكم في ظهور المسار للعميل
          </h3>
          <p className="mt-1 max-w-md text-xs font-medium text-[#1E2720]/55">
            {bypass
              ? 'المسار مفتوح الآن — العميل يرى البرنامج اليومي والتجارب فوراً.'
              : 'الوضع التلقائي — يُقفل البرنامج حتى 24 ساعة قبل الانطلاق.'}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black ${
            bypass
              ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
              : 'bg-[#1E2720]/5 text-[#1E2720]/70 ring-1 ring-[#1E2720]/10'
          }`}
        >
          {bypass ? (
            <>
              <Unlock className="h-3.5 w-3.5" aria-hidden />
              مفتوح للعميل
            </>
          ) : (
            <>
              <Lock className="h-3.5 w-3.5" aria-hidden />
              قفل تلقائي
            </>
          )}
        </span>
      </div>

      <div className="relative grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={saving || bypass}
          onClick={() => void updateBypass(true)}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-black transition ${
            bypass
              ? 'cursor-default border-[#D4AF37] bg-[#D4AF37]/15 text-[#1E2720]'
              : 'border-[#D4AF37]/40 bg-white text-[#1E2720] hover:border-[#D4AF37] hover:bg-[#D4AF37]/8'
          } disabled:opacity-70`}
        >
          {saving && !bypass ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Unlock className="h-4 w-4 shrink-0 text-[#D4AF37]" aria-hidden />
          )}
          فتح المسار فوراً
        </button>
        <button
          type="button"
          disabled={saving || !bypass}
          onClick={() => void updateBypass(false)}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-black transition ${
            !bypass
              ? 'cursor-default border-[#1E2720] bg-[#1E2720] text-[#FAFAFA]'
              : 'border-[#1E2720]/20 bg-white text-[#1E2720] hover:border-[#1E2720]/40 hover:bg-[#1E2720]/5'
          } disabled:opacity-70`}
        >
          {saving && bypass ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Lock className="h-4 w-4 shrink-0" aria-hidden />
          )}
          تفعيل قفل 24 ساعة
        </button>
      </div>

      {toast ? (
        <div
          role="status"
          className={`relative mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {toast.type === 'success' ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          ) : null}
          <span>{toast.message}</span>
        </div>
      ) : null}
    </section>
  );
}

/** قراءة أولية من صف itineraries */
export function bypassLockFromRow(row: Record<string, unknown>): boolean {
  return parseBypass24hLock(row.bypass_24h_lock ?? row.bypass24hLock);
}
