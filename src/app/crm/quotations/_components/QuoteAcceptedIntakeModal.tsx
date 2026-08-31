'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, Copy, Dna, MessageCircle, X } from 'lucide-react';

import DnaInviteTripTypePicker from '@/app/crm/_components/DnaInviteTripTypePicker';
import {
  buildDnaInviteWhatsAppPayload,
  markDnaLinkSent,
  type ClientIntakeAutomationResult,
  type DnaInviteTripType,
} from '@/lib/client-intake-pipeline';
import { supabase } from '@/lib/supabase';

export type QuoteAcceptedIntakePayload = ClientIntakeAutomationResult & {
  clientName: string;
  clientPhone: string;
};

type QuoteAcceptedIntakeModalProps = {
  payload: QuoteAcceptedIntakePayload;
  onClose: () => void;
};

export function QuoteAcceptedIntakeModal({ payload, onClose }: QuoteAcceptedIntakeModalProps) {
  const [tripType, setTripType] = useState<DnaInviteTripType>('private');
  const [copied, setCopied] = useState<'message' | 'dna' | 'calendar' | null>(null);
  const [sending, setSending] = useState(false);

  const invite = useMemo(() => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : undefined;
    return buildDnaInviteWhatsAppPayload(
      payload.clientPhone,
      payload.clientId,
      tripType,
      origin,
    );
  }, [payload.clientPhone, payload.clientId, tripType]);

  async function copyText(text: string, key: 'message' | 'dna' | 'calendar') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  async function handleWhatsAppSend() {
    setSending(true);
    try {
      if (supabase) {
        await markDnaLinkSent(supabase, payload.clientId);
      }
      window.open(invite.whatsAppUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-0 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-[95%] max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[#cda04c]/35 bg-gradient-to-b from-[#0a1410] to-[#0f1e16] shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#cda04c]/20 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#cda04c]/80">
              قبول عرض السعر
            </p>
            <h2 className="mt-1 text-lg font-black text-white">أرسل دعوة DNA للعميل</h2>
            <p className="mt-1 text-xs font-semibold text-white/50">
              {payload.clientName} — الخطوة التالية بعد الاعتماد
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-2 text-white/60 transition hover:bg-white/10"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-950/25 px-4 py-3 text-sm font-bold text-emerald-100">
            تم قبول العرض بنجاح. اختر نوع الرحلة ثم افتح واتساب بالرسالة المناسبة.
          </div>

          <DnaInviteTripTypePicker
            value={tripType}
            onChange={setTripType}
            disabled={sending}
            className="rounded-2xl border border-white/10 bg-white/5 p-3 [&_p]:text-white/70 [&_button]:border-white/15 [&_button]:bg-white/5 [&_button]:text-white/80 [&_button[aria-pressed=true]]:border-[#cda04c] [&_button[aria-pressed=true]]:bg-[#cda04c]/20 [&_button[aria-pressed=true]]:text-[#f5e6c0]"
          />

          <p className="text-[10px] font-bold text-white/45" dir="ltr">
            الرابط الموحّد: {invite.dnaUrl}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyText(invite.dnaUrl, 'dna')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-black text-white/85"
            >
              <Dna className="h-3.5 w-3.5 text-[#cda04c]" />
              {copied === 'dna' ? 'تم النسخ ✓' : 'نسخ رابط DNA'}
            </button>
            <button
              type="button"
              onClick={() => void copyText(payload.bookingUrl, 'calendar')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-black text-white/85"
            >
              <CalendarDays className="h-3.5 w-3.5 text-[#cda04c]" />
              {copied === 'calendar' ? 'تم النسخ ✓' : 'نسخ رابط التقويم'}
            </button>
            <button
              type="button"
              onClick={() => void copyText(invite.whatsAppMessage, 'message')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-black text-white/85"
            >
              <Copy className="h-3.5 w-3.5 text-[#cda04c]" />
              {copied === 'message' ? 'تم النسخ ✓' : 'نسخ الرسالة'}
            </button>
          </div>

          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 p-4 text-[11px] font-semibold leading-relaxed text-white/75">
            {invite.whatsAppMessage}
          </pre>
        </div>

        <div className="border-t border-[#cda04c]/20 p-5">
          <button
            type="button"
            disabled={sending}
            onClick={() => void handleWhatsAppSend()}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-[#25D366]/25 transition hover:brightness-110 disabled:opacity-60"
          >
            <MessageCircle className="h-5 w-5" />
            {sending ? 'جارٍ الفتح...' : 'إرسال للعميل عبر الواتساب'}
          </button>
          {!payload.clientPhone ? (
            <p className="mt-2 text-center text-[10px] font-bold text-amber-300/90">
              تنبيه: لا يوجد رقم واتساب للعميل — الصق الرقم يدوياً في واتساب.
            </p>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full rounded-xl border border-white/10 py-2.5 text-xs font-bold text-white/55 transition hover:bg-white/5"
          >
            إغلاق — سأرسل لاحقاً
          </button>
        </div>
      </div>
    </div>
  );
}
