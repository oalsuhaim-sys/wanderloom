'use client';

import type { CSSProperties } from 'react';

import type { CrmLeadRow } from '@/lib/crm-leads';
import { resolveLeadBookingChannelLabel } from '@/lib/crm-leads';
import { brandGoldBadgeStyle, brandGoldButtonStyle } from '@/lib/brand-gold';

export function InboxLuxuryTripBadge({ isGroup }: { isGroup: boolean }) {
  if (!isGroup) {
    return (
      <span className="rounded-md border border-sky-200/70 bg-sky-50 px-2 py-0.5 text-[10px] font-extrabold text-sky-900">
        رحلة فردية
      </span>
    );
  }

  return (
    <span
      className="rounded-lg border px-3 py-1 text-[11px] font-extrabold"
      style={brandGoldBadgeStyle}
    >
      رحلة مجموعة
    </span>
  );
}

/** Inline badge for compact details header row */
export function InboxMediaConsentInline({ mediaConsent }: { mediaConsent?: boolean | null }) {
  const optedIn = mediaConsent !== false;

  return (
    <div className="flex shrink-0 items-center gap-1 text-[11px]">
      <span className="text-slate-400">📸 التصوير:</span>
      {optedIn ? (
        <span className="rounded bg-emerald-100/70 px-2 py-0.5 font-bold text-emerald-700">
          موافق (Opt-in)
        </span>
      ) : (
        <span className="rounded bg-rose-100/70 px-2 py-0.5 font-bold text-rose-700">
          غير موافق (Opt-out)
        </span>
      )}
    </div>
  );
}

export function InboxMediaConsentCell({ mediaConsent }: { mediaConsent?: boolean | null }) {
  const optedIn = mediaConsent !== false;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-400">📸 التصوير:</span>
      {optedIn ? (
        <span className="rounded bg-emerald-100/70 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
          موافق (Opt-in)
        </span>
      ) : (
        <span className="rounded bg-rose-100/70 px-2 py-0.5 text-[10px] font-bold text-rose-700">
          غير موافق (Opt-out)
        </span>
      )}
    </div>
  );
}

export function InboxBookingChannelCell({ lead }: { lead: CrmLeadRow & Record<string, unknown> }) {
  const booking = resolveLeadBookingChannelLabel(lead);

  return (
    <div className="min-w-0">
      <span className="text-slate-400">📞 الحجز: </span>
      <span className="font-bold text-slate-800">{booking.label}</span>
      {booking.detail ? (
        <span className="text-[10px] font-semibold text-slate-500" dir="ltr">
          {' '}
          ({booking.detail})
        </span>
      ) : null}
    </div>
  );
}

export const inboxLuxuryCardClass =
  'w-full max-w-2xl space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-right shadow-sm transition-all duration-200 sm:p-5';

export const inboxLuxuryDetailsClass =
  'space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs';

export const inboxLuxuryMetaGridClass =
  'grid grid-cols-2 gap-2 border-t border-slate-200/60 pt-1 text-[11px] font-semibold text-slate-600 sm:grid-cols-4';

export const inboxLuxuryGridClass =
  'grid grid-cols-1 gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs font-semibold text-slate-700 sm:grid-cols-2';

export const inboxCompactWhatsAppClass =
  'rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 transition-all hover:bg-emerald-100';

export const inboxCompactPrimaryBtnClass =
  'cursor-pointer whitespace-nowrap rounded-xl px-5 py-2.5 text-xs font-extrabold shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';

export const inboxCompactSecondaryBtnClass =
  'rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-200 disabled:opacity-60';

export const inboxCompactDangerBtnClass =
  'rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition-all hover:bg-rose-100 disabled:opacity-60';

export function inboxLuxuryPrimaryButtonStyle(disabled = false): CSSProperties {
  return {
    ...brandGoldButtonStyle,
    opacity: disabled ? 0.6 : 1,
  };
}
