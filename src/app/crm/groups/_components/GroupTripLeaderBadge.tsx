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
        className={`inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-600/10 ${className}`}
        title={`بإشراف: ${display}`}
      >
        <User className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        <span className="truncate">
          بإشراف: <span className="font-semibold text-slate-800">{display}</span>
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 ${className}`}
      title={`بإشراف: ${display}`}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white"
        aria-hidden
      >
        {leaderInitial(display)}
      </span>
      <User className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
      <span className="text-xs text-slate-500">بإشراف</span>
      <span className="font-semibold text-slate-900">{display}</span>
    </span>
  );
}
