'use client';

import { Download, Smartphone } from 'lucide-react';

import { PwaInstallFallbackToast } from '@/components/PwaInstallFallbackToast';
import { usePwaInstallPrompt } from '@/lib/use-pwa-install-prompt';

type PwaInstallButtonProps = {
  className?: string;
  label?: string;
  variant?: 'default' | 'sidebar' | 'banner';
};

export default function PwaInstallButton({
  className = '',
  label = '📥 تحميل تطبيق لوحة التحكم',
  variant = 'default',
}: PwaInstallButtonProps) {
  const { isStandalone, busy, showToast, toastMessage, handleInstallClick } =
    usePwaInstallPrompt();

  if (isStandalone) return null;

  const baseClass =
    variant === 'sidebar'
      ? 'flex w-full items-center justify-center gap-2 rounded-[14px] border border-[#cda04c]/45 bg-gradient-to-l from-[#cda04c]/15 to-white/5 px-3 py-2.5 text-xs font-black text-[#cda04c] transition hover:border-[#cda04c]/70 hover:bg-[#cda04c]/20'
      : variant === 'banner'
        ? 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#cda04c]/40 bg-[#0B1511] px-4 py-2.5 text-xs font-black text-[#cda04c] shadow-sm transition hover:bg-[#12201a] sm:w-auto sm:text-sm'
        : 'inline-flex items-center justify-center gap-2 rounded-full border border-[#cda04c]/45 bg-[#1E2720] px-4 py-2 text-xs font-bold text-[#cda04c] shadow-[0_4px_20px_rgba(205,160,76,0.18)] transition hover:border-[#cda04c]/70 hover:bg-[#252f28] sm:text-sm';

  return (
    <>
      <button
        type="button"
        onClick={() => void handleInstallClick()}
        disabled={busy}
        className={`${baseClass} disabled:opacity-60 ${className}`}
      >
        <Download className="h-4 w-4 shrink-0" aria-hidden />
        <span>{busy ? 'جارٍ الفتح…' : label}</span>
        <Smartphone className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      </button>
      <PwaInstallFallbackToast visible={showToast} message={toastMessage} />
    </>
  );
}
