import { canonicalTripCountryId, englishPlaceName } from '@/lib/destination-match';
import type { TailorLocale } from '@/lib/tailor-now';

function norm(v: string): string {
  return v.trim().replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ');
}

/** Country name in the page language. `countries` = t.tripLabels.countries for that language. */
export function tailorCountryName(id: string, bankLabel: string, countries: Record<string, string>, lang: TailorLocale): string {
  return countries[id] ?? (lang === 'en' ? englishPlaceName(bankLabel, countries) ?? id : bankLabel);
}

/** City name in the page language; a bank "city" that is the whole country reads as «country · various cities». */
export function tailorCityName(
  cityLabel: string,
  country: { id: string; label: string },
  countries: Record<string, string>,
  lang: TailorLocale,
  various: string,
): string {
  const isCountryWide = norm(cityLabel) === norm(country.label) || canonicalTripCountryId(cityLabel) === country.id;
  if (isCountryWide) return `${tailorCountryName(country.id, country.label, countries, lang)} · ${various}`;
  if (lang === 'en') return englishPlaceName(cityLabel, countries) ?? cityLabel;
  return cityLabel;
}
