'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

import { clearClientPortalSessionAuth } from '@/lib/itinerary-offline-cache';

type ClientPortalSignOutButtonProps = {
  slug?: string;
  className?: string;
  variant?: 'light' | 'dark';
};

export default function ClientPortalSignOutButton({
  slug,
  className = '',
  variant = 'light',
}: ClientPortalSignOutButtonProps) {
  const router = useRouter();

  const handleSignOut = () => {
    clearClientPortalSessionAuth(slug);
    router.push('/portal');
  };

  const styles =
    variant === 'dark'
      ? 'border-white/15 bg-white/5 text-white/75 hover:border-[#d4af37]/40 hover:bg-[#d4af37]/10 hover:text-[#d4af37]'
      : 'border-[#1E2720]/10 bg-white text-[#1E2720]/70 hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/5 hover:text-[#D4AF37]';

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold tracking-wide transition-colors ${styles} ${className}`}
      aria-label="إغلاق المسار والعودة لبوابة الرحلات"
    >
      <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden />
      إغلاق المسار
    </button>
  );
}
