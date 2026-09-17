'use client';

import { X } from 'lucide-react';

import {
  ExpertHandbookHeader,
  ExpertHandbookPanel,
} from '@/components/crm/ExpertHandbookPanel';
import type { ExpertHandbookTabId } from '@/lib/expert-handbook-content';

type Props = {
  open: boolean;
  onClose: () => void;
  initialTab?: ExpertHandbookTabId;
};

export function ExpertHandbookModal({
  open,
  onClose,
  initialTab = 'proposals',
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expert-handbook-modal-title"
      dir="rtl"
      lang="ar"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0a1210]/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="إغلاق"
      />
      <div className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-[#D4AF37]/25 bg-[#FDFBF7] shadow-[0_32px_80px_rgba(0,0,0,0.45)] dark:bg-[#1A2421] sm:max-h-[90vh] sm:rounded-[1.75rem]">
        <div className="flex items-start justify-between gap-3 border-b border-[#D4AF37]/15 px-4 py-4 sm:px-6">
          <div id="expert-handbook-modal-title">
            <ExpertHandbookHeader compact />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-slate-300"
            aria-label="إغلاق النافذة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <ExpertHandbookPanel initialTab={initialTab} compact />
        </div>
        <div className="border-t border-[#D4AF37]/15 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[#D4AF37] py-3 text-sm font-black text-[#1A3B2A] shadow-sm transition hover:bg-[#c4a030]"
          >
            فهمت — العودة للعمل
          </button>
        </div>
      </div>
    </div>
  );
}
