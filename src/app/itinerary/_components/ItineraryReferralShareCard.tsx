'use client';

import { useState } from 'react';
import { Check, Copy, Gift } from 'lucide-react';

type ItineraryReferralShareCardProps = {
  referralCode?: string | null;
  /** When true and no code — show “coming soon” instead of hiding */
  showPending?: boolean;
};

export default function ItineraryReferralShareCard({
  referralCode,
  showPending = false,
}: ItineraryReferralShareCardProps) {
  const [copied, setCopied] = useState(false);
  const code = (referralCode ?? '').trim();

  if (!code && !showPending) return null;

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section
      className="mb-4 rounded-2xl border border-[#D4AF37]/25 bg-gradient-to-br from-[#FFFBF0] to-white p-4 shadow-sm"
      aria-label="كود الإحالة"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/15">
          <Gift className="h-4 w-4 text-[#D4AF37]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D4AF37]">
            شارك بحرية
          </p>
          <h3 className="mt-0.5 text-sm font-black text-[#1E2720]">كود الإحالة الخاص بك</h3>
          <p className="mt-1 text-xs font-semibold text-gray-600">
            آمن للمشاركة مع الأصدقاء — لا يفتح محفظتك أو بياناتك المالية.
          </p>
          {code ? (
            <div className="mt-3 flex items-center gap-2">
              <code
                className="min-w-0 flex-1 rounded-xl border border-[#D4AF37]/30 bg-white px-3 py-2 text-center font-mono text-sm font-black tracking-wider text-[#1E2720]"
                dir="ltr"
              >
                {code}
              </code>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/35 bg-[#1E2720] text-[#D4AF37] transition hover:bg-black"
                aria-label={copied ? 'تم النسخ' : 'نسخ كود الإحالة'}
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-[#D4AF37]/35 bg-white/80 px-3 py-3 text-center text-xs font-bold text-[#1E2720]/55">
              لا يوجد كود إحالة
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
