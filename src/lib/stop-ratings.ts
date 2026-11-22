/** Shared helpers for client stop ratings (client itinerary + CRM editor). */

/** Same key on both sides: the places-bank id when known, otherwise the place name. */
export function stopRatingKey(bankId: string | null | undefined, name: string | null | undefined): string {
  const id = String(bankId ?? '').trim();
  if (id) return `bank:${id}`;
  return `name:${String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 160)}`;
}

export type StopRatingsMap = Record<string, number>;

/** «3:bank:…» — one rating per stop per day. */
export function ratingSlot(dayIndex: number, key: string): string {
  return `${dayIndex}:${key}`;
}
