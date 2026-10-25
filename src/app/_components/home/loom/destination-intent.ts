/**
 * «اختر وجهتك» shortcuts (destinations thread, advisor) → pre-select that country in
 * «سجّل رحلتك» without a server round-trip when the form is already on the page.
 */
export const SELECT_DESTINATION_EVENT = 'wl:select-destination';

export type SelectDestinationDetail = { country: string };

/** Returns true when handled in-page (caller should preventDefault the link). */
export function requestTripDestination(country: string): boolean {
  if (typeof window === 'undefined') return false;
  const lead = document.getElementById('lead');
  if (!lead) return false;
  window.dispatchEvent(new CustomEvent<SelectDestinationDetail>(SELECT_DESTINATION_EVENT, { detail: { country } }));
  try {
    window.history.replaceState(window.history.state, '', `/?dest=${encodeURIComponent(country)}#lead`);
  } catch {
    /* ignore */
  }
  lead.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}
