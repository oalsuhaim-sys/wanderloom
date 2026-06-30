'use client';

import { Download, FileText, X } from 'lucide-react';
import { useState } from 'react';

import type { ItineraryDocument } from '@/lib/itinerary-documents';

type Props = {
  documents: ItineraryDocument[];
};

export default function VipBookingDocumentsWallet({ documents }: Props) {
  const [open, setOpen] = useState(false);

  if (!documents.length) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#D4AF37]/50 bg-gradient-to-l from-[#2A362C] to-[#1E2720] py-4 text-sm font-black text-[#D4AF37] shadow-[0_0_18px_rgba(212,175,55,0.25)] transition hover:border-[#D4AF37]/70"
      >
        <span className="text-lg" aria-hidden>
          📁
        </span>
        محفظة الحجوزات الرسمية
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vip-wallet-title"
        >
          <div className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-2xl border border-[#D4AF37]/40 bg-[#FDFBF7] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#D4AF37]/20 bg-white px-5 py-4">
              <h2 id="vip-wallet-title" className="text-lg font-black text-[#1E2720]">
                محفظة الحجوزات الرسمية
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="max-h-[60vh] space-y-2 overflow-y-auto p-4">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="h-5 w-5 shrink-0 text-[#D4AF37]" aria-hidden />
                    <span className="truncate text-sm font-bold text-gray-900">{doc.name}</span>
                  </div>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#1E2720] px-3 py-2 text-xs font-bold text-[#D4AF37]"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    تحميل
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
