'use client';

import Link from 'next/link';
import { CalendarDays, Sparkles } from 'lucide-react';

import { DEFAULT_INTAKE_BOOKING_URL } from '@/lib/client-intake-pipeline';

const GOLD = '#D4AF37';

export default function DnaSuccessPage() {
  return (
    <main
      dir="rtl"
      className="relative min-h-screen overflow-hidden bg-[#0D0F0E] text-[#F5F0E8]"
      style={{ fontFamily: 'var(--font-tajawal), system-ui, sans-serif' }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            'radial-gradient(ellipse 80% 55% at 50% -5%, rgba(212,175,55,0.18), transparent), radial-gradient(ellipse 45% 35% at 100% 100%, rgba(30,39,32,0.9), transparent)',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 py-14 text-center sm:px-6">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-1.5 text-xs font-bold tracking-widest text-[#D4AF37]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          WANDERLOOM VIP
        </div>

        <div className="w-full rounded-3xl border border-[#D4AF37]/35 bg-[#141816]/90 px-6 py-12 shadow-[0_0_60px_rgba(212,175,55,0.12)] backdrop-blur-sm sm:px-10 sm:py-14">
          <div className="mb-6 text-5xl" aria-hidden>
            🦅🌿
          </div>
          <h1 className="text-2xl font-black text-[#D4AF37] sm:text-3xl">تم حفظ بطاقة DNA بنجاح</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-8 text-[#E8E4DC] sm:text-base">
            شكراً لثقتك. مستشار السفر الخاص بك بدأ قراءة تفضيلاتك — الخطوة التالية هي اختيار موعد جلسة
            قراءة الأمنيات عبر اتصال مرئي.
          </p>

          <a
            href={DEFAULT_INTAKE_BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex w-full max-w-sm flex-row-reverse items-center justify-center gap-2 rounded-2xl py-4 text-base font-black text-[#0D0F0E] transition hover:brightness-110"
            style={{
              background: `linear-gradient(135deg, ${GOLD} 0%, #E8C96A 50%, ${GOLD} 100%)`,
              boxShadow: '0 8px 32px rgba(212,175,55,0.35)',
            }}
          >
            <CalendarDays className="h-5 w-5" aria-hidden />
            <span>📅 حدد موعد اجتماعك الآن</span>
          </a>

          <Link
            href="/"
            className="mt-6 inline-block text-xs font-bold text-[#A8A49C] underline-offset-4 transition hover:text-[#D4AF37] hover:underline"
          >
            العودة للموقع
          </Link>
        </div>

        <footer className="mt-10 text-[10px] font-bold tracking-[0.2em] text-[#5C5850]">
          WANDERLOOM · VIP CONCIERGE
        </footer>
      </div>
    </main>
  );
}
