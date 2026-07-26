'use client';

import Link from 'next/link';
import { Toaster } from 'react-hot-toast';
import { ArrowRight, Sparkles } from 'lucide-react';

import MarketingProductionStudio from '@/app/crm/marketing/_components/MarketingProductionStudio';

export default function MarketingAiStudioClient() {
  return (
    <>
      <Toaster position="top-center" toastOptions={{ duration: 2500, style: { fontWeight: 700 } }} />

      <div
        className="min-h-full pb-24 font-[family-name:var(--font-tajawal),system-ui,sans-serif]"
        dir="rtl"
        style={{
          background:
            'radial-gradient(ellipse 90% 50% at 50% -10%, rgba(205,160,76,0.12), transparent), #0a0c0b',
        }}
      >
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
          <Link
            href="/crm/marketing"
            className="mb-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-black text-[#E8E4DC] backdrop-blur-sm transition hover:border-[#cda04c]/40 hover:bg-white/10 hover:text-[#cda04c]"
          >
            <ArrowRight className="h-4 w-4" aria-hidden />
            <span>← العودة للعمليات والجدولة</span>
          </Link>

          <header className="mb-8 rounded-[1.75rem] border border-[#cda04c]/25 bg-[#111111]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#cda04c]/35 bg-[#cda04c]/10 px-3 py-1.5 text-[10px] font-black text-[#cda04c] sm:text-[11px]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              AI Content Studio
            </p>
            <h1 className="mt-4 text-2xl font-black text-white sm:text-3xl md:text-4xl">المحتوى والحملات</h1>
            <p className="mt-2 max-w-2xl text-sm font-bold leading-relaxed text-[#A8A49C]">
              مصنع محتوى الـ AI — بطاقات البرومبت · فلاتر الفيديو والصورة · التصنيفات (بيع الشعور، حياة المدينة، وغيرها)
            </p>
          </header>

          <div className="rounded-[1.75rem] border border-white/8 bg-[#FDFBF7]/[0.97] p-4 shadow-2xl sm:p-6 md:p-8">
            <div className="mb-6">
              <p className="text-xs font-black text-[#cda04c]">Production Workflow</p>
              <h2 className="mt-1 text-lg font-black text-[#1e3f20]">استوديو الإنتاج — AI × بشري</h2>
            </div>
            <MarketingProductionStudio />
          </div>
        </div>
      </div>
    </>
  );
}
