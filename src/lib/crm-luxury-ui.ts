/**
 * Shared luxury CRM class tokens —
 * Light: Off-White / Navy · Dark: Olive / Gold
 * Mobile-first: grids, tables, filters, modals, and 44px touch targets.
 */
export const CRM_FOREST = '#0F172A';
export const CRM_GOLD = '#D4AF37';
export const CRM_OFFWHITE = '#F9FAFB';

/** Interactive card hover (partners, clients, paths, etc.) */
export const CRM_CARD_INTERACTIVE =
  'transition-all duration-300 hover:-translate-y-1 hover:shadow-lg';

/** KPI / overview / directory card grids */
export const CRM_CARD_GRID =
  'grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

/** KPI / overview stat cards */
export const CRM_KPI_CARD =
  `bg-white dark:bg-[#22302C] rounded-xl p-5 border border-slate-200 dark:border-[#2D3F3A] shadow-sm ${CRM_CARD_INTERACTIVE}`;

export const CRM_KPI_VALUE =
  'text-slate-900 dark:text-gray-100 font-bold text-2xl';

/** Elegant data tables — keep min-width so phones scroll instead of crush */
export const CRM_TABLE =
  'w-full min-w-[650px] border-collapse text-right text-sm';

/** Mobile-safe table shell — wrap every CRM `<table>` with this */
export const CRM_TABLE_SCROLL =
  'w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-[#2D3F3A] dark:bg-[#1A2421]';

export const CRM_TH =
  'bg-slate-50 text-slate-600 font-semibold text-right py-3 px-4 border-b border-slate-200 dark:bg-[#22302C] dark:text-slate-300 dark:border-[#2D3F3A] whitespace-nowrap text-sm';

export const CRM_TR =
  'border-b border-slate-100 dark:border-[#2D3F3A] hover:bg-slate-50 dark:hover:bg-[#2A3834]/50 transition-colors duration-200 cursor-default';

export const CRM_TD = 'py-3.5 px-4 text-slate-900 dark:text-gray-100 text-sm';

export const CRM_TD_NOWRAP = `${CRM_TD} whitespace-nowrap`;

/** Page toolbar: search + filters + CTA — stacks on mobile */
export const CRM_FILTER_BAR =
  'flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center';

/** Mobile-first modal overlay — always viewport-centered (pairs with .crm-modal-overlay CSS) */
export const CRM_MODAL_OVERLAY =
  'crm-modal-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm sm:p-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';

/** Mobile-first modal panel — centered, scrollable, no visible scrollbar chrome */
export const CRM_MODAL_PANEL =
  'relative my-auto w-[95vw] max-w-xl sm:w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 pb-6 shadow-2xl dark:border-[#2D3F3A] dark:bg-[#1A2421] sm:p-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';

/** Status pills */
export const CRM_BADGE_SUCCESS =
  'bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full text-xs font-medium dark:bg-emerald-950/40 dark:text-emerald-300';

export const CRM_BADGE_PENDING =
  'bg-amber-50 text-amber-800 px-3 py-1 rounded-full text-xs font-medium dark:bg-[#D4AF37]/10 dark:text-[#D4AF37]';

export const CRM_BADGE_NEUTRAL =
  'bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-medium dark:bg-[#1A2421] dark:text-slate-300';

export const CRM_BADGE_DANGER =
  'bg-rose-50 text-rose-800 px-3 py-1 rounded-full text-xs font-medium dark:bg-rose-950/40 dark:text-rose-300';

/** Forms & inputs — min 44px touch height on mobile */
export const CRM_INPUT =
  'w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-600 focus:border-slate-300 focus:ring-2 focus:ring-slate-200 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-100 dark:placeholder:text-slate-400 dark:focus:border-[#D4AF37]/40 dark:focus:ring-[#D4AF37]/15';

export const CRM_SELECT = CRM_INPUT;

export const CRM_TEXTAREA = `${CRM_INPUT} resize-y min-h-[6rem]`;

/** Partner / contact cards */
export const CRM_PARTNER_CARD =
  `bg-white dark:bg-[#22302C] rounded-xl p-5 border border-slate-200 dark:border-[#2D3F3A] shadow-sm flex flex-col ${CRM_CARD_INTERACTIVE}`;

export const CRM_PARTNER_AVATAR =
  'w-12 h-12 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-semibold text-lg border border-slate-200 shrink-0 dark:bg-[#1A2421] dark:text-[#D4AF37] dark:border-[#2D3F3A]';

/** Primary CTA — solid gold with dark text (high contrast on light & dark CRM) */
export const CRM_BTN_PRIMARY =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-slate-950 shadow-md transition-all duration-100 hover:bg-[#B8952B] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50';

export const CRM_BTN_GHOST =
  'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-200 active:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50';

/** Vertical timeline (RTL) */
export const CRM_TIMELINE =
  'relative border-s-2 border-slate-200 dark:border-[#2D3F3A] ps-6 space-y-4';

export const CRM_TIMELINE_DOT =
  'absolute -start-[9px] top-1 w-4 h-4 rounded-full bg-white border-2 border-slate-300 dark:bg-[#1A2421] dark:border-[#D4AF37]';

export const CRM_TIMELINE_CARD =
  `bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/90 text-slate-800 shadow-sm mb-6 ${CRM_CARD_INTERACTIVE}`;

/** Slide-over drawer */
export const CRM_DRAWER_OVERLAY =
  'fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity dark:bg-[#1A2421]/70';

export const CRM_DRAWER_PANEL =
  'fixed inset-y-0 right-0 z-50 w-full max-w-md transform overflow-y-auto border-l border-slate-200 bg-[#F9FAFB] shadow-2xl transition-transform duration-500 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden dark:border-[#2D3F3A] dark:bg-[#22302C]';

export const CRM_DRAWER_SAVE = CRM_BTN_PRIMARY + ' w-full';

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
