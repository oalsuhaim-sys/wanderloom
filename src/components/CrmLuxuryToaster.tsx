'use client';

import { Toaster } from 'react-hot-toast';

/** Shared dual-theme toast host for CRM (and other shells that mount it once). */
export function CrmLuxuryToaster() {
  return (
    <Toaster
      position="top-center"
      gutter={10}
      containerClassName="crm-luxury-toaster no-print"
      toastOptions={{
        duration: 3200,
        className:
          '!bg-white dark:!bg-[#22302C] !text-slate-900 dark:!text-gray-100 !rounded-xl !shadow-lg !border !border-slate-200 dark:!border-[#2D3F3A] !font-medium !text-sm !px-4 !py-3',
        success: {
          iconTheme: {
            primary: '#10b981',
            secondary: '#ffffff',
          },
          className:
            '!bg-white dark:!bg-[#22302C] !text-slate-900 dark:!text-gray-100 !rounded-xl !shadow-lg !border !border-slate-200 dark:!border-[#2D3F3A] !font-medium !text-sm !px-4 !py-3 [&>div:first-child]:!text-emerald-500',
        },
        error: {
          iconTheme: {
            primary: '#f43f5e',
            secondary: '#ffffff',
          },
          className:
            '!bg-white dark:!bg-[#22302C] !text-slate-900 dark:!text-gray-100 !rounded-xl !shadow-lg !border !border-slate-200 dark:!border-[#2D3F3A] !font-medium !text-sm !px-4 !py-3 [&>div:first-child]:!text-rose-500',
        },
        loading: {
          className:
            '!bg-white dark:!bg-[#22302C] !text-slate-900 dark:!text-gray-100 !rounded-xl !shadow-lg !border !border-slate-200 dark:!border-[#2D3F3A] !font-medium !text-sm !px-4 !py-3',
        },
      }}
    />
  );
}
