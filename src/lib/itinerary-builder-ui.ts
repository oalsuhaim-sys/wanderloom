/**
 * Itinerary Builder — unified light system UI tokens.
 * Prefer these over ad-hoc dark olive / slate-950 section classes.
 */

export const WL_GOLD = '#D4AF37';
export const WL_SURFACE = '#f8fafc';
export const WL_ELEVATED = '#ffffff';
export const WL_BORDER = '#e2e8f0';

/** Outer section / panel shell */
export const WL_SECTION =
  'w-full max-w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 text-slate-800 shadow-sm';

/** Nested card inside a section */
export const WL_CARD =
  'rounded-xl border border-slate-200/90 bg-slate-50/80 p-4 text-slate-800 sm:p-5';

/** Section / block titles */
export const WL_TITLE =
  'mb-4 flex items-center gap-2 text-lg font-extrabold text-slate-900';

export const WL_SUBTITLE = 'text-xs font-medium text-slate-500';

export const WL_LABEL = 'mb-2 block text-xs font-semibold text-slate-600';

export const WL_HINT = 'text-xs text-slate-500';

/** Form controls */
export const WL_INPUT =
  'w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-600 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-[#D4AF37] [color-scheme:light] disabled:cursor-not-allowed disabled:opacity-50';

/** Native <select> — forced dark text (survives inherited white from CRM shells) */
export const WL_SELECT =
  'w-full cursor-pointer rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm font-extrabold text-slate-900 outline-none transition-all [color-scheme:light] focus:bg-white focus:ring-2 focus:ring-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-50';

export const WL_OPTION = 'bg-white font-bold text-slate-900';

export const WL_TEXTAREA = `${WL_INPUT} min-h-[5.5rem] resize-y`;

/** Primary CTA — solid gold, dark text (always readable) */
export const WL_BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-2.5 text-sm font-extrabold text-black shadow-sm transition-all hover:bg-[#b8952d] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50';

/** Secondary / neutral actions */
export const WL_BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50';

/** Ghost / outline on light */
export const WL_BTN_GHOST =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

/** Icon buttons — pencil / edit */
export const WL_ICON_BTN_GOLD =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 p-2 text-[#b8952d] shadow-sm transition-all hover:bg-[#D4AF37]/20 disabled:cursor-not-allowed disabled:opacity-40';

/** Icon buttons — reorder arrows */
export const WL_ICON_BTN_NEUTRAL =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 p-2 text-sm text-slate-700 shadow-sm transition-all hover:bg-slate-200 hover:text-[#b8952d] disabled:cursor-not-allowed disabled:opacity-35';

/** Native date input — light field, gold focus */
export const WL_DATE_INPUT =
  'wl-date-input w-full cursor-pointer rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none transition-all [color-scheme:light] focus:border-transparent focus:bg-white focus:ring-2 focus:ring-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-50';

/** Destructive */
export const WL_BTN_DANGER =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-100';

/** WhatsApp / share / supplier notify */
export const WL_BTN_WHATSAPP =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 shadow-sm transition-all hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50';

/** Segmented toggle — active / inactive */
export const WL_TOGGLE_ACTIVE =
  'bg-[#D4AF37] text-black font-extrabold shadow-sm';

export const WL_TOGGLE_INACTIVE =
  'border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200';

export const WL_TOGGLE_BASE =
  'inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm transition-all';

export const WL_EMPTY =
  'rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm font-medium text-slate-500';

export const WL_PAGE =
  'itinerary-builder-page -m-4 min-h-[calc(100vh-3.25rem)] bg-[#f8fafc] p-4 text-slate-800 sm:p-6 md:-m-6 lg:-m-8 lg:min-h-screen lg:p-8';
