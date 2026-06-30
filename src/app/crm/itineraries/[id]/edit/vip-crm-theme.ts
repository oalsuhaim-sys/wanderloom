/** VIP CRM Edit Dashboard — palette only (#FAFAFA / #1E2720 / #D4AF37) */

export const VIP = {
  bg: '#FAFAFA',
  olive: '#1E2720',
  gold: '#D4AF37',
} as const;

export const VIP_PAGE = 'min-h-screen bg-[#FAFAFA] text-[#1E2720]';

export const VIP_CARD =
  'rounded-xl border border-[#D4AF37] bg-white shadow-sm';

export const VIP_INPUT =
  'w-full rounded-lg border border-[#D4AF37] bg-white px-3 py-2 text-sm font-semibold text-[#1E2720] placeholder:text-gray-400 outline-none transition focus:border-[#1E2720] focus:ring-2 focus:ring-[#D4AF37]/40';

export const VIP_SELECT = VIP_INPUT;

export const VIP_LABEL =
  'mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#1E2720]';

export const VIP_BTN_GOLD =
  'inline-flex items-center justify-center gap-2 rounded-lg border-2 border-[#1E2720] bg-[#D4AF37] px-4 py-2.5 text-sm font-bold text-[#1E2720] shadow-sm transition hover:brightness-105 disabled:opacity-50';

export const VIP_BTN_OLIVE =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-[#1E2720] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#2a3530] disabled:opacity-50';

export const VIP_BTN_GHOST =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-[#D4AF37] bg-white px-3 py-2 text-xs font-bold text-[#1E2720] transition hover:bg-[#D4AF37]/15';

export const VIP_PANEL =
  'flex h-[calc(100vh-280px)] min-h-[480px] max-h-[800px] flex-col overflow-hidden rounded-xl border border-[#D4AF37] bg-white';

export const VIP_PANEL_HEAD =
  'shrink-0 border-b border-[#D4AF37]/50 bg-[#FAFAFA] px-4 py-3';

export const VIP_PANEL_BODY = 'min-h-0 flex-1 overflow-y-auto bg-white p-3';
