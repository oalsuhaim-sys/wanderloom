/** VIP CRM Edit Dashboard — palette only (#FAFAFA / #1E2720 / #D4AF37) */

export const VIP = {
  bg: '#FAFAFA',
  olive: '#1E2720',
  gold: '#D4AF37',
} as const;

export const VIP_BTN_GOLD =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-2.5 text-sm font-extrabold text-black shadow-sm transition hover:bg-[#b8952d] disabled:opacity-50';

export const VIP_BTN_OLIVE =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-2.5 text-sm font-extrabold text-black shadow-sm transition hover:bg-[#b8952d] disabled:opacity-50';

export const VIP_BTN_GHOST =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200';

export const VIP_PANEL =
  'flex h-[calc(100vh-280px)] min-h-[480px] max-h-[800px] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm';

export const VIP_PANEL_HEAD =
  'shrink-0 border-b border-slate-100 bg-slate-50 px-4 py-3';

export const VIP_PANEL_BODY = 'min-h-0 flex-1 overflow-y-auto bg-white p-3';

export const VIP_CARD =
  'rounded-2xl border border-slate-200/90 bg-white shadow-sm';

export const VIP_INPUT =
  'w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-[#D4AF37] focus:bg-white focus:ring-2 focus:ring-[#D4AF37]/40';

export const VIP_SELECT =
  'w-full cursor-pointer rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm font-extrabold text-slate-900 outline-none transition-all [color-scheme:light] focus:bg-white focus:ring-2 focus:ring-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-50';

export const VIP_OPTION = 'bg-white font-bold text-slate-900';

export const VIP_LABEL =
  'mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-600';

export const VIP_PAGE = 'min-h-screen bg-[#f8fafc] text-slate-800 p-6';
