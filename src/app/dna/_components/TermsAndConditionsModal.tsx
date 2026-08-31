'use client';

import { useEffect, useState } from 'react';

import {
  GroupTripTermsCharterArticles,
  GroupTripTermsCharterHeader,
  GroupTripTermsCharterIntro,
  GroupTripTermsMediaConsent,
  GROUP_TRIP_TERMS_SECTIONS,
} from '@/app/group-onboarding/_components/group-trip-terms-charter';
import { BRAND_GOLD_BUTTON_CLASS } from '@/lib/brand-gold';

export { GROUP_TRIP_TERMS_SECTIONS };

type Props = {
  open: boolean;
  onClose: () => void;
  onAgree: (mediaOptIn: boolean) => void;
  initialMediaConsent?: boolean;
  isSubmitting?: boolean;
};

export function TermsAndConditionsModal({
  open,
  onClose,
  onAgree,
  initialMediaConsent = true,
  isSubmitting = false,
}: Props) {
  const [mediaConsent, setMediaConsent] = useState(initialMediaConsent);

  useEffect(() => {
    if (open) setMediaConsent(initialMediaConsent);
  }, [open, initialMediaConsent]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[400] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="group-terms-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white text-right text-slate-800 shadow-2xl sm:max-h-[90vh] sm:rounded-3xl"
        dir="rtl"
        lang="ar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/80 p-4 sm:p-5">
          <GroupTripTermsCharterHeader variant="modal" />
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-xs font-bold text-slate-500 transition-all hover:bg-slate-200"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          <GroupTripTermsCharterIntro variant="modal" />
          <GroupTripTermsCharterArticles variant="modal" />
          <GroupTripTermsMediaConsent
            mediaConsent={mediaConsent}
            onMediaConsentChange={setMediaConsent}
            inputName="mediaConsent"
            compact
          />
        </div>

        <div className="flex shrink-0 flex-col-reverse items-stretch justify-between gap-2 border-t border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-extrabold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => onAgree(mediaConsent)}
            disabled={isSubmitting}
            className={`cursor-pointer rounded-xl px-6 py-3 text-xs font-extrabold shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60 ${BRAND_GOLD_BUTTON_CLASS}`}
          >
            {isSubmitting ? 'جاري التأكيد…' : 'الموافقة وتأكيد انضمامي للرحلة ➔'}
          </button>
        </div>
      </div>
    </div>
  );
}
