'use client';

import { useState, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';

import { Sidebar } from './Sidebar';

type CrmShellProps = {
  children: ReactNode;
};

export function CrmShell({ children }: CrmShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div dir="rtl" className="min-h-screen bg-[#F6F4F0] font-sans">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[#cda04c]/20 bg-gradient-to-l from-[#0F1E16] to-[#07100D] px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#cda04c]/30 bg-white/5 text-[#cda04c] transition hover:bg-[#cda04c]/10"
          aria-expanded={sidebarOpen}
          aria-label="فتح القائمة"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <span className="text-sm font-black tracking-[0.2em] text-[#cda04c]">Wanderloom CRM</span>
        <div className="w-10" aria-hidden />
      </header>

      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[55] bg-[#001f3f]/50 backdrop-blur-[2px] lg:hidden"
          aria-label="إغلاق القائمة"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="flex min-h-[calc(100vh-3.25rem)] lg:min-h-screen">
        <Sidebar mobileOpen={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
        <main className="w-full min-w-0 flex-1 p-4 text-sm md:p-6 md:text-base lg:p-8">{children}</main>
      </div>
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
      className={`flex max-h-[92dvh] w-[95%] max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[#D4AF37]/30 bg-white shadow-2xl sm:max-h-[90vh] sm:w-full sm:rounded-2xl md:w-3/4 md:max-w-2xl lg:w-1/2 lg:max-w-3xl ${className}`}
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
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50"
      aria-label={label}
    >
      <X className="h-4 w-4" aria-hidden />
    </button>
  );
}
