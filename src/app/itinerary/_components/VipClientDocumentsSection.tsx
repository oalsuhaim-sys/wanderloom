'use client';

import { Download, FileText } from 'lucide-react';

import type { ItineraryDocument } from '@/lib/itinerary-documents';

type Props = {
  documents: ItineraryDocument[];
};

export default function VipClientDocumentsSection({ documents }: Props) {
  if (!documents.length) {
    return (
      <section className="rounded-2xl border border-dashed border-[#D4AF37]/30 bg-[#FAFAFA] px-4 py-8 text-center">
        <FileText className="mx-auto mb-3 h-8 w-8 text-[#D4AF37]/60" aria-hidden />
        <p className="text-sm font-bold text-[#1E2720]/70">لا توجد وثائق PDF مرفوعة بعد</p>
        <p className="mt-1 text-xs text-[#1E2720]/45">
          تذاكر الطيران وقسائم الفنادق ستظهر هنا فور رفعها من فريق الكونسيرج.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#D4AF37]/30 bg-white p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-[#1E2720]">
        <FileText className="h-4 w-4 text-[#D4AF37]" aria-hidden />
        وثائق الحجوزات الرسمية (PDF)
      </h2>
      <ul className="space-y-2">
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-[#FAFAFA] p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-lg" aria-hidden>
                📄
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900">{doc.name}</p>
                {doc.uploadedAt ? (
                  <p className="text-[10px] text-gray-500">
                    {new Date(doc.uploadedAt).toLocaleDateString('ar-SA')}
                  </p>
                ) : null}
              </div>
            </div>
            <a
              href={doc.url}
              target="_blank"
              rel="noreferrer"
              download
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1E2720] px-3 py-2 text-xs font-bold text-[#D4AF37] transition hover:bg-black"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              تحميل
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-center text-[11px] font-medium text-[#1E2720]/45">
        ملفات آمنة — للاستخدام الشخصي فقط. لا تشارك الرابط خارج عائلتك المقربة.
      </p>
    </section>
  );
}
