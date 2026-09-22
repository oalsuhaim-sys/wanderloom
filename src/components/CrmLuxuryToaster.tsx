'use client';

import toast, { Toaster, ToastBar } from 'react-hot-toast';

const TOAST_DURATION_MS = 4000;

/** Shared dual-theme toast host for CRM — auto-dismiss + mobile close button. */
export function CrmLuxuryToaster() {
  return (
    <Toaster
      position="top-center"
      gutter={10}
      containerClassName="crm-luxury-toaster no-print"
      containerStyle={{
        zIndex: 99999,
        top: 'max(0.75rem, env(safe-area-inset-top))',
        pointerEvents: 'none',
      }}
      toastOptions={{
        duration: TOAST_DURATION_MS,
        className:
          '!pointer-events-auto !relative !bg-white dark:!bg-[#22302C] !text-slate-900 dark:!text-gray-100 !rounded-xl !shadow-lg !border !border-slate-200 dark:!border-[#2D3F3A] !font-medium !text-sm !px-4 !py-3 !pe-10',
        success: {
          duration: TOAST_DURATION_MS,
          iconTheme: {
            primary: '#10b981',
            secondary: '#ffffff',
          },
          className:
            '!pointer-events-auto !relative !bg-white dark:!bg-[#22302C] !text-slate-900 dark:!text-gray-100 !rounded-xl !shadow-lg !border !border-slate-200 dark:!border-[#2D3F3A] !font-medium !text-sm !px-4 !py-3 !pe-10 [&>div:first-child]:!text-emerald-500',
        },
        error: {
          duration: TOAST_DURATION_MS,
          iconTheme: {
            primary: '#f43f5e',
            secondary: '#ffffff',
          },
          className:
            '!pointer-events-auto !relative !bg-white dark:!bg-[#22302C] !text-slate-900 dark:!text-gray-100 !rounded-xl !shadow-lg !border !border-slate-200 dark:!border-[#2D3F3A] !font-medium !text-sm !px-4 !py-3 !pe-10 [&>div:first-child]:!text-rose-500',
        },
        loading: {
          duration: Infinity,
          className:
            '!pointer-events-auto !relative !bg-white dark:!bg-[#22302C] !text-slate-900 dark:!text-gray-100 !rounded-xl !shadow-lg !border !border-slate-200 dark:!border-[#2D3F3A] !font-medium !text-sm !px-4 !py-3 !pe-10',
        },
      }}
    >
      {(t) => (
        <ToastBar
          toast={t}
          style={{
            ...t.style,
            pointerEvents: 'auto',
            maxWidth: 'min(92vw, 420px)',
          }}
        >
          {({ icon, message }) => (
            <div
              className="relative flex w-full items-start gap-2 pe-1"
              dir="rtl"
              onTouchEnd={(e) => e.stopPropagation()}
            >
              {icon}
              <div className="min-w-0 flex-1 text-right leading-snug">{message}</div>
              {t.type !== 'loading' ? (
                <button
                  type="button"
                  aria-label="إغلاق الإشعار"
                  className="absolute right-0 top-0 z-10 inline-flex h-8 w-8 touch-manipulation items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:bg-slate-200 dark:hover:bg-[#2D3F3A] dark:hover:text-gray-100"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toast.dismiss(t.id);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toast.dismiss(t.id);
                  }}
                >
                  <span aria-hidden className="text-lg leading-none">
                    ×
                  </span>
                </button>
              ) : null}
            </div>
          )}
        </ToastBar>
      )}
    </Toaster>
  );
}

/** Success toast that always auto-dismisses (mobile-safe). */
export function showCrmSuccessToast(message: string, opts?: { duration?: number; icon?: string }) {
  const duration = opts?.duration ?? TOAST_DURATION_MS;
  const id = toast.success(message, {
    duration,
    ...(opts?.icon ? { icon: opts.icon } : {}),
  });
  if (typeof window !== 'undefined' && duration > 0 && Number.isFinite(duration)) {
    window.setTimeout(() => {
      toast.dismiss(id);
    }, duration + 50);
  }
  return id;
}
