'use client';

import { useCallback, useEffect, useState } from 'react';
import { Heart, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import { InterestForm } from '@/app/_components/home/InterestForm';

export const OPEN_INTEREST_MODAL_EVENT = 'wanderloom:open-interest-modal';

export function openInterestModal() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_INTEREST_MODAL_EVENT));
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export function InterestModal({ open, onClose }: Props) {
  const [formKey, setFormKey] = useState(0);

  const handleClose = useCallback(() => {
    onClose();
    window.setTimeout(() => setFormKey((k) => k + 1), 300);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <>
      <Toaster position="top-center" toastOptions={{ className: 'text-sm font-bold' }} />
    <div
      className="fixed inset-0 z-[360] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="interest-modal-title"
      onClick={handleClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-[#1e3f20]/10 bg-gradient-to-b from-[#FEFDF9] to-white p-5 shadow-2xl sm:max-h-[min(90vh,640px)] sm:rounded-3xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
        lang="ar"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 text-right">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#1e3f20]/5 px-3 py-1 text-[10px] font-black text-[#1e3f20]">
              <Heart className="h-3.5 w-3.5 text-[#cda04c]" aria-hidden />
              تسجيل اهتمام
            </div>
            <h2 id="interest-modal-title" className="text-lg font-black text-[#111111] sm:text-xl">
              ابقَ على اطلاع بأفضل العروض
            </h2>
            <p className="mt-1.5 text-xs font-bold leading-relaxed text-gray-500 sm:text-sm">
              اسمك ورقمك فقط — بدون تواريخ أو ميزانيات.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-full bg-gray-100 p-2 text-gray-600 transition hover:bg-gray-200"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <InterestForm
          key={formKey}
          variant="modal"
          onSuccess={() => {
            window.setTimeout(handleClose, 2200);
          }}
        />
      </div>
    </div>
    </>
  );
}
