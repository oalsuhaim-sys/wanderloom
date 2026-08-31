'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Menu, X } from 'lucide-react';

import { AdminNotificationBell } from '@/components/AdminNotificationBell';
import { CrmLuxuryToaster } from '@/components/CrmLuxuryToaster';
import { CRM_MODAL_OVERLAY, CRM_MODAL_PANEL } from '@/lib/crm-luxury-ui';

import InternalDiscussion from './InternalDiscussion';
import { CrmPushNotifications } from './CrmPushNotifications';
import { RealtimeListener } from './RealtimeListener';
import CommandPalette from './CommandPalette';
import CrmThemeToggle from './CrmThemeToggle';
import { useCrmTheme } from './CrmThemeProvider';
import { Sidebar } from './Sidebar';

type CrmShellProps = {
  children: ReactNode;
};

export function CrmShell({ children }: CrmShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme } = useCrmTheme();
  const isDark = theme === 'dark';

  return (
    <div
      dir="rtl"
      className={`crm-command-center min-h-screen font-sans transition-colors duration-300 ${
        isDark
          ? 'dark bg-[#1A2421] text-gray-100'
          : 'bg-[#F9FAFB] text-slate-900'
      }`}
    >
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] dark:shadow-none lg:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 dark:border-[#2D3F3A] dark:bg-[#2A3834] dark:text-gray-300 dark:hover:border-[#D4AF37]/30 dark:hover:text-[#D4AF37]"
          aria-expanded={sidebarOpen}
          aria-label="فتح القائمة"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-[#D4AF37]">
          Wanderloom CRM
        </span>
        <CrmThemeToggle compact />
      </header>
      <AdminNotificationBell className="fixed left-4 top-3 z-50 lg:left-6 lg:top-5" />

      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[55] bg-[#1A2421]/70 backdrop-blur-[2px] lg:hidden"
          aria-label="إغلاق القائمة"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="flex min-h-[calc(100vh-3.25rem)] lg:min-h-screen">
        <Sidebar mobileOpen={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
        <main
          className={`crm-animate-in w-full min-w-0 flex-1 p-4 text-sm transition-colors duration-300 md:p-6 md:text-base lg:p-8 ${
            isDark ? 'bg-[#1A2421] text-gray-100' : 'bg-[#F9FAFB] text-slate-900'
          }`}
        >
          {children}
        </main>
      </div>

      <Suspense fallback={null}>
        <InternalDiscussion />
      </Suspense>
      <RealtimeListener />
      <CrmLuxuryToaster />
      <CrmPushNotifications />
      <CommandPalette />
    </div>
  );
}

export function CrmModalBackdrop({
  children,
  onClose,
  labelledBy,
}: {
  children: ReactNode;
  onClose?: () => void;
  labelledBy?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const overlay = (
    <div
      className={CRM_MODAL_OVERLAY}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      dir="rtl"
      lang="ar"
      onClick={onClose}
    >
      {children}
    </div>
  );

  if (!mounted || typeof document === 'undefined') return overlay;
  return createPortal(overlay, document.body);
}

export function CrmModalPanel({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={`${CRM_MODAL_PANEL} dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-100 ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CrmModalCloseButton({
  onClick,
  label = 'إغلاق',
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#2A3834] dark:text-gray-400 dark:hover:border-[#D4AF37]/30 dark:hover:text-[#D4AF37]"
      aria-label={label}
    >
      <X className="h-4 w-4" aria-hidden />
    </button>
  );
}
