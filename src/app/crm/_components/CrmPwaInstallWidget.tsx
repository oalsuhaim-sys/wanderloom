'use client';

import { Download } from 'lucide-react';

import { PwaInstallFallbackToast } from '@/components/PwaInstallFallbackToast';
import { usePwaInstallPrompt } from '@/lib/use-pwa-install-prompt';

/** ويدجت تثبيت PWA — الزر ظاهر دائماً (ما عدا وضع التطبيق المثبت standalone) */
export function CrmPwaInstallWidget() {
  const { isStandalone, busy, showToast, toastMessage, handleInstallClick } =
    usePwaInstallPrompt();

  if (isStandalone) return null;

  return (
    <>
      <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-[#2D3F3A] dark:bg-[#2A3834]">
        <button
          type="button"
          onClick={() => void handleInstallClick()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-medium text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60 dark:border dark:border-[#D4AF37]/30 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37] dark:hover:bg-[#D4AF37]/20"
        >
          <Download className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
          <span>{busy ? 'جارٍ الفتح…' : 'تثبيت النظام على الجهاز'}</span>
        </button>
      </div>
      <PwaInstallFallbackToast visible={showToast} message={toastMessage} />
    </>
  );
}
