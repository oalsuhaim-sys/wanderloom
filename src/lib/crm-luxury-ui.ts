/**
 * Shared luxury CRM (Command Center) class tokens —
 * Off-White · Forest Green · Royal Gold
 */
export const CRM_FOREST = '#1A3B2A';
export const CRM_GOLD = '#C5A059';
export const CRM_OFFWHITE = '#F9F9F6';

/** KPI / overview stat cards */
export const CRM_KPI_CARD =
  'bg-white rounded-2xl p-6 border border-gray-100 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(0,0,0,0.05)]';

export const CRM_KPI_VALUE = 'text-[#C5A059] font-bold text-3xl';

/** Elegant data tables */
export const CRM_TABLE =
  'w-full min-w-0 border-collapse text-right text-sm';

export const CRM_TH =
  'bg-[#1A3B2A]/5 text-[#1A3B2A] font-semibold text-right py-4 px-6 border-b border-gray-200';

export const CRM_TR =
  'border-b border-gray-100 hover:bg-white transition-colors duration-200 cursor-default';

export const CRM_TD = 'py-4 px-6 text-[#1A3B2A]/90';

/** Status pills */
export const CRM_BADGE_SUCCESS =
  'bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold';

export const CRM_BADGE_PENDING =
  'bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold';

export const CRM_BADGE_NEUTRAL =
  'bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-bold';

export const CRM_BADGE_DANGER =
  'bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold';

/** Forms & inputs */
export const CRM_INPUT =
  'bg-white border border-gray-200 rounded-lg p-3 text-sm font-semibold text-[#1A3B2A] outline-none transition-all placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/50 focus:border-[#C5A059]';

export const CRM_SELECT = CRM_INPUT;

export const CRM_TEXTAREA = `${CRM_INPUT} resize-y min-h-[6rem]`;

/** Partner / contact cards */
export const CRM_PARTNER_CARD =
  'bg-white rounded-2xl p-6 border border-gray-100 flex flex-col hover:shadow-lg transition-all duration-300 hover:border-[#1A3B2A]/20';

export const CRM_PARTNER_AVATAR =
  'w-12 h-12 rounded-full bg-[#F9F9F6] text-[#C5A059] flex items-center justify-center font-bold text-xl border border-gray-200 shrink-0';

/** Vertical timeline (RTL) */
export const CRM_TIMELINE =
  'relative border-r-2 border-[#C5A059]/30 mr-4 pr-6 space-y-8';

export const CRM_TIMELINE_DOT =
  'absolute -right-[9px] top-0 w-4 h-4 rounded-full bg-[#1A3B2A] border-2 border-[#C5A059]';

export const CRM_TIMELINE_CARD =
  'bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow';

/** Slide-over drawer */
export const CRM_DRAWER_OVERLAY =
  'fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity';

export const CRM_DRAWER_PANEL =
  'fixed inset-y-0 right-0 w-full max-w-md bg-[#F9F9F6] shadow-2xl z-50 transform transition-transform duration-500 border-l border-gray-200 overflow-y-auto';

export const CRM_DRAWER_SAVE =
  'w-full rounded-xl bg-[#1A3B2A] px-4 py-3 text-sm font-black text-white transition-colors hover:bg-[#152e21] disabled:cursor-not-allowed disabled:opacity-60';

export function partnerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '؟';
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}

export function crmStatusBadgeClass(status: string | null | undefined): string {
  const s = String(status ?? '')
    .trim()
    .toLowerCase();
  if (
    s === 'approved' ||
    s === 'completed' ||
    s === 'active' ||
    s === 'confirmed' ||
    s === 'paid' ||
    s === 'معتمد' ||
    s === 'مكتمل' ||
    s === 'نشطة' ||
    s === 'مؤكّدة' ||
    s === 'مؤكدة'
  ) {
    return CRM_BADGE_SUCCESS;
  }
  if (
    s === 'pending' ||
    s === 'draft' ||
    s === 'sent' ||
    s === 'معلق' ||
    s === 'مسودة' ||
    s === 'مُرسل' ||
    s === 'مرسل'
  ) {
    return CRM_BADGE_PENDING;
  }
  if (s === 'archived' || s === 'cancelled' || s === 'rejected' || s === 'مؤرشفة') {
    return CRM_BADGE_DANGER;
  }
  return CRM_BADGE_NEUTRAL;
}
