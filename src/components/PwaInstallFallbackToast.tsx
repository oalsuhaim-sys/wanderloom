'use client';

type PwaInstallFallbackToastProps = {
  visible: boolean;
  message: string;
};

export function PwaInstallFallbackToast({ visible, message }: PwaInstallFallbackToastProps) {
  if (!visible || !message) return null;

  return (
    <>
      <style>{`
        @keyframes pwaToastIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4 sm:bottom-8"
        role="status"
        aria-live="polite"
        dir="rtl"
      >
        <div
          className="pointer-events-auto max-w-md rounded-2xl border border-[#D4AF37]/55 bg-[#0B1511] px-4 py-3.5 text-center text-[12px] font-medium leading-relaxed text-[#f5e6c0]/90 shadow-[0_16px_48px_rgba(0,0,0,0.45)] ring-1 ring-[#D4AF37]/15"
          style={{ animation: 'pwaToastIn 0.35s ease-out forwards' }}
        >
          {message}
        </div>
      </div>
    </>
  );
}
