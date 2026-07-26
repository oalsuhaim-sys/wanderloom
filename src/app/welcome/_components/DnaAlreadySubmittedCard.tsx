'use client';

import { CheckCircle2, Sparkles } from 'lucide-react';

const GOLD = '#D4AF37';

type DnaAlreadySubmittedCardProps = {
  displayName?: string;
  message?: string;
};

export function DnaAlreadySubmittedCard({
  displayName,
  message = 'استلمنا تفاصيل حلمك بعناية. فريقنا ينسج الآن تجربةً خاصة بك — سنعود إليك قريباً بلمسة Wanderloom.',
}: DnaAlreadySubmittedCardProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-[#D4AF37]/35 bg-[#141816]/90 px-6 py-14 text-center shadow-[0_0_60px_rgba(212,175,55,0.12)] backdrop-blur-sm">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10">
        <CheckCircle2 className="h-10 w-10 text-[#D4AF37]" aria-hidden />
      </div>
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-1.5 text-xs font-bold tracking-widest text-[#D4AF37]">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        WANDERLOOM VIP
      </div>
      <h2 className="text-xl font-black text-[#D4AF37] sm:text-2xl">شكراً لثقتك</h2>
      <p className="mx-auto mt-4 max-w-md text-sm leading-8 text-[#E8E4DC] sm:text-base">
        {displayName ? `${displayName}، ` : ''}
        {message}
      </p>
      <p className="mt-3 text-xs font-semibold text-[#A8A49C]">
        لا حاجة لإعادة تعبئة النموذج؛ نحن نتابع من هنا.
      </p>
      <a
        href="/"
        className="mt-8 inline-flex rounded-2xl px-8 py-3.5 text-sm font-black text-[#0D0F0E] transition hover:brightness-110"
        style={{
          background: `linear-gradient(135deg, ${GOLD} 0%, #E8C96A 50%, ${GOLD} 100%)`,
          boxShadow: '0 8px 32px rgba(212,175,55,0.35)',
        }}
      >
        العودة للموقع
      </a>
    </div>
  );
}
