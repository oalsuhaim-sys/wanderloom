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
      <div className="mb-3 rounded-xl border border-[#cda04c]/15 bg-[#0B1511]/40 px-3 py-3">
        <button
          type="button"
          onClick={() => void handleInstallClick()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#cda04c]/40 bg-[#cda04c]/90 px-3 py-2.5 text-xs font-semibold text-[#0B1511] transition hover:bg-[#cda04c] disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
          <span>{busy ? 'جارٍ الفتح…' : 'تثبيت النظام على الجهاز'}</span>
        </button>
      </div>
      <PwaInstallFallbackToast visible={showToast} message={toastMessage} />
    </>
  );
}
