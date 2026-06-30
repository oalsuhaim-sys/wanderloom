'use client';

import { User } from 'lucide-react';

type GroupTripLeaderBadgeProps = {
  name: string;
  compact?: boolean;
  className?: string;
};

function leaderInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '؟';
  return trimmed.charAt(0).toUpperCase();
}

/** شارة الليدر المشرف — «بإشراف: الاسم» */
export default function GroupTripLeaderBadge({
  name,
  compact = false,
  className = '',
}: GroupTripLeaderBadgeProps) {
  const display = name.trim();
  if (!display) return null;

  if (compact) {
    return (
      <span
        className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-700/80 bg-gray-800/90 px-3 py-1 text-[11px] font-bold text-[#d4af37]/90 ${className}`}
        title={`بإشراف: ${display}`}
      >
        <User className="h-3.5 w-3.5 shrink-0 text-[#d4af37]/75" aria-hidden />
        <span className="truncate">
          بإشراف: <span className="font-black text-[#f5f0e6]">{display}</span>
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/35 bg-gradient-to-l from-[#1E2720]/5 to-[#D4AF37]/10 px-3 py-1.5 text-[11px] font-black text-[#1E2720] ${className}`}
      title={`بإشراف: ${display}`}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1E2720] text-[10px] font-black text-[#D4AF37]"
        aria-hidden
      >
        {leaderInitial(display)}
      </span>
      <User className="h-3.5 w-3.5 shrink-0 text-[#6b5c38]" aria-hidden />
      <span className="text-[10px] font-bold text-[#6b5c38]">بإشراف</span>
      <span className="text-[#1c4532]">{display}</span>
    </span>
  );
}
