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
        className={`${CRM_DRAWER_PANEL} flex flex-col overflow-hidden`}
      >
        <header className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 rounded-t-2xl border-b border-[#2D3F3A] bg-[#1A2421] p-6 text-white">
          <div className="min-w-0 text-right">
            <h2 id={labelledBy} className="text-xl font-bold text-white">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              if (!busy) onClose();
            }}
            disabled={busy}
            className="rounded-xl border border-[#2D3F3A] bg-[#22302C] p-2 text-slate-300 transition hover:text-white disabled:opacity-50"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#22302C] px-5 py-5">
          {children}
        </div>

        {footer ? (
          <footer className="sticky bottom-0 shrink-0 border-t border-[#2D3F3A] bg-[#1A2421] px-5 py-4">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

export { CRM_DRAWER_SAVE };
