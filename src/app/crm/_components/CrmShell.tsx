'use client';

import { Suspense, useState, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';

import { AdminNotificationBell } from '@/components/AdminNotificationBell';

import InternalDiscussion from './InternalDiscussion';
import { CrmPushNotifications } from './CrmPushNotifications';
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
          ? 'dark bg-brand-dark text-[#E8EDE9]'
          : 'bg-brand-offwhite text-brand-primary'
      }`}
    >
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-brand-gold/20 bg-brand-primary px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-gold/30 bg-white/5 text-brand-gold transition-colors duration-300 hover:bg-white/10"
          aria-expanded={sidebarOpen}
          aria-label="فتح القائمة"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <span className="text-sm font-black tracking-[0.2em] text-brand-gold">
          Wanderloom CRM
        </span>
        <CrmThemeToggle compact />
      </header>
      <AdminNotificationBell className="fixed left-4 top-3 z-50 lg:left-6 lg:top-5" />

      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[55] bg-brand-primary/50 backdrop-blur-[2px] lg:hidden"
          aria-label="إغلاق القائمة"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="flex min-h-[calc(100vh-3.25rem)] lg:min-h-screen">
        <Sidebar mobileOpen={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
        <main
          className={`w-full min-w-0 flex-1 p-4 text-sm transition-colors duration-300 md:p-6 md:text-base lg:p-8 ${
            isDark ? 'bg-brand-dark text-[#E8EDE9]' : 'bg-brand-offwhite text-brand-primary'
          }`}
        >
          {children}
        </main>
      </div>

      <Suspense fallback={null}>
        <InternalDiscussion />
      </Suspense>
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
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
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
      className={`flex max-h-[92dvh] w-[95%] max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[#D4AF37]/30 bg-white shadow-2xl dark:border-brand-gold/30 dark:bg-brand-surface dark:text-[#E8EDE9] sm:max-h-[90vh] sm:w-full sm:rounded-2xl md:w-3/4 md:max-w-2xl lg:w-1/2 lg:max-w-3xl ${className}`}
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
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 dark:border-brand-gold/25 dark:text-brand-muted dark:hover:bg-brand-dark"
      aria-label={label}
    >
      <X className="h-4 w-4" aria-hidden />
    </button>
  );
}
