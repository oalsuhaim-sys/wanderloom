'use client';

import type { QuotationDetails } from '@/lib/quotation-details';
import { quotationTotalEstimate } from '@/lib/quotation-details';

type Props = {
  customerName: string;
  destination: string;
  quotation: QuotationDetails;
};

export default function VipLuxuryQuotationView({ customerName, destination, quotation }: Props) {
  const total = quotationTotalEstimate(quotation);

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-[#D4AF37]/45 bg-gradient-to-br from-[#FFFBF0] via-white to-[#FEFDF9] p-6 shadow-[0_8px_32px_rgba(212,175,55,0.15)]">
      <div className="mb-6 text-center">
        <span className="inline-block rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#1E2720]">
          Wanderloom Proposal
        </span>
        <h2 className="mt-3 text-2xl font-black text-[#1E2720]">عرض سعر حصري ✨</h2>
        <p className="mt-2 text-sm font-semibold text-gray-600">
          مُعدّ خصيصاً لـ {customerName}
          {destination ? ` · ${destination}` : ''}
        </p>
      </div>

      <div className="space-y-3">
        <PriceRow label="السعر التقديري للفنادق" value={quotation.hotelsEstimate} />
        <PriceRow label="السعر التقديري للطيران" value={quotation.flightsEstimate} />
        <PriceRow label="رسوم الخدمة والكونسيرج" value={quotation.serviceFee} />
      </div>

      <div className="mt-6 rounded-xl border border-[#D4AF37]/30 bg-[#1E2720] px-5 py-4 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]/80">الإجمالي التقديري</p>
        <p className="mt-1 text-3xl font-black text-[#D4AF37]">
          {total > 0 ? `${total.toLocaleString('ar-SA')} SAR` : 'حسب التخصيص'}
        </p>
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-gray-500">
        هذا عرض تقديري فاخر — وليس مساراً مؤكداً بعد. فريق Wanderloom يتواصل معك لتأكيد
        التفاصيل والخيارات.
      </p>
    </section>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  const num = Number(String(value).replace(/,/g, '')) || 0;
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3">
      <span className="text-sm font-bold text-gray-700">{label}</span>
      <span className="text-sm font-black text-[#1E2720]" dir="ltr">
        {num > 0 ? `${num.toLocaleString('ar-SA')} SAR` : '—'}
      </span>
    </div>
  );
}
