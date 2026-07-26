'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

import {
  CRM_DRAWER_OVERLAY,
  CRM_DRAWER_PANEL,
  CRM_DRAWER_SAVE,
} from '@/lib/crm-luxury-ui';

type CrmSlideOverProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Primary action in the fixed footer */
  footer?: ReactNode;
  /** When true, ignore outside-click / escape close (e.g. while saving) */
  busy?: boolean;
  labelledBy?: string;
};

/**
 * RTL luxury slide-over (right drawer) for CRM add/edit flows.
 */
export function CrmSlideOver({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  busy = false,
  labelledBy = 'crm-slide-over-title',
}: CrmSlideOverProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]" dir="rtl">
      <button
        type="button"
        className={CRM_DRAWER_OVERLAY}
        aria-label="إغلاق"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`${CRM_DRAWER_PANEL} flex flex-col`}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-[#F9F9F6]/95 px-5 py-4 backdrop-blur-md">
          <div className="min-w-0 text-right">
            <h2 id={labelledBy} className="text-lg font-black text-[#1A3B2A]">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-xs font-semibold text-gray-500">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              if (!busy) onClose();
            }}
            disabled={busy}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:border-[#C5A059]/40 hover:text-[#1A3B2A] disabled:opacity-50"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer ? (
          <footer className="sticky bottom-0 border-t border-gray-100 bg-[#F9F9F6]/95 px-5 py-4 backdrop-blur-md">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

export { CRM_DRAWER_SAVE };
