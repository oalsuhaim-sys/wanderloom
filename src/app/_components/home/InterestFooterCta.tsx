'use client';

import { Heart } from 'lucide-react';

import { openInterestModal } from '@/app/_components/home/InterestModal';

export function InterestFooterCta() {
  return (
    <div className="mx-auto mb-8 max-w-md rounded-2xl border border-[#9C7A3C]/25 bg-gradient-to-br from-[#F4EFE6] to-white px-6 py-6 shadow-sm">
      <p className="text-sm font-black text-[#1C2E3A] sm:text-base">هل تخطط لرحلة مستقبلاً؟</p>
      <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500">
        سجّل اهتمامك وسنُبقيك على اطلاع بأفضل الوجهات والعروض.
      </p>
      <button
        type="button"
        onClick={openInterestModal}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1C2E3A] px-5 py-3 text-sm font-black text-[#F4EFE6] shadow-md transition hover:bg-[#122029] hover:shadow-lg"
      >
        <Heart className="h-4 w-4" aria-hidden />
        سجل اهتمامك
      </button>
    </div>
  );
}
