'use client';

import { useCallback } from 'react';
import { Download } from 'lucide-react';

import type { PublicItinerary } from '@/lib/public-itinerary';

type VipBookingVoucherExportProps = {
  trip: PublicItinerary;
};

export default function VipBookingVoucherExport({ trip: _trip }: VipBookingVoucherExportProps) {
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="mb-6 print:hidden">
      <button
        type="button"
        onClick={handlePrint}
        className="group flex w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-[#1E2720]/10 bg-[#D4AF37] px-5 py-4 text-sm font-black text-[#1E2720] shadow-[0_8px_24px_rgba(212,175,55,0.35)] transition duration-200 hover:brightness-105 active:scale-[0.99]"
      >
        <Download
          className="h-5 w-5 shrink-0 text-[#1E2720] transition group-hover:scale-110"
          aria-hidden
        />
        <span>تحميل وثيقة الحجوزات الرسمية (PDF)</span>
      </button>
      <p className="mt-2 text-center text-[11px] font-medium text-[#1E2720]/45">
        يفتح نافذة الطباعة — اختر «حفظ كـ PDF» لحفظ الوثيقة على جهازك
      </p>
    </div>
  );
}
