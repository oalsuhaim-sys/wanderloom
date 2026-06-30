import type { PlaceBankRow } from '@/types/place';

/** تسميات الفئات — مطابقة لـ /crm/vault */
export const PLACES_BANK_CATEGORIES: Record<string, string> = {
  l: '🏛️ معلم',
  r: '🍽️ مطعم',
  c: '☕ كافيه',
  s: '🛍️ تسوق',
  d: '🎭 تجربة',
  h: '🏨 فندق',
  f: '🍜 طعام',
  o: '🧭 أخرى',
};

export const PLACES_BANK_PAGE_SIZE = 50;

export function placeBankCategoryLabel(code: string): string {
  return PLACES_BANK_CATEGORIES[code] ?? PLACES_BANK_CATEGORIES.o ?? '🧭 أخرى';
}

export function placeBankMapsSearchUrl(place: Pick<PlaceBankRow, 'name' | 'city' | 'country'>): string {
  const q = [place.name, place.city, place.country].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
}

export function placeBankGeocodeQuery(place: Pick<PlaceBankRow, 'name' | 'city' | 'country'>): string {
  return [place.name, place.city, place.country].filter(Boolean).join(', ');
}
