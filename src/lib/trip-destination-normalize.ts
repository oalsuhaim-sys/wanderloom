/**
 * Normalizes destination tokens that reach quotes from different forms:
 *   «كوريا:سيول» · «japan:طوكيو» · «كوريا الجنوبية — سيول» · «كوريا — نامي» · «سيول» · «Seoul»
 * into one clean entry per place, so days, hotels, the route map and the client page all agree
 * (and «كوريا:سيول» + «كوريا الجنوبية — سيول» count as the same city).
 */

import { canonicalTripCountryId, englishPlaceName } from '@/lib/destination-match';
import { TRIP_DESTINATIONS } from '@/lib/trip-destination-data';

export type NormalizedDestination = {
  /** Canonical country id (e.g. "korea") or null when unknown. */
  countryId: string | null;
  /** Arabic country label for display (e.g. «كوريا الجنوبية»). */
  countryLabel: string;
  /** City / area in Arabic for display (e.g. «سيول»); the country label when only a country was given. */
  label: string;
  /** Normalized key used to match places/hotels and to de-duplicate. */
  key: string;
  /** Labels to try when matching bank rows (places.city / hotels.city). */
  aliases: string[];
  /** True when only a country (no city) was given. */
  countryOnly: boolean;
  raw: string;
};

/** Extra spellings seen in the places / hotels banks. Keys and values are matched after normText. */
const CITY_ALIASES: Record<string, string[]> = {
  سيول: ['سيؤول', 'seoul'],
  بوسان: ['busan', 'pusan'],
  جيجو: ['جزيرة جيجو', 'jeju', 'jeju island'],
  غانغوون: ['gangwon', 'كانغوون', 'غانغ وون'],
  تشونغتشونغ: ['chungcheong'],
  نامي: ['جزيرة نامي', 'nami', 'nami island'],
  طوكيو: ['tokyo'],
  كيوتو: ['kyoto', 'كيوتو/أوساكا'],
  أوساكا: ['اوساكا', 'osaka', 'كيوتو/أوساكا'],
  شانغهاي: ['شنغهاي', 'shanghai'],
  كوانزو: ['غوانزو', 'guangzhou'],
  لندن: ['london'],
  باريس: ['paris'],
};

export function normText(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/ـ/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[_\s]+/g, ' ')
    .trim();
}

/** Remove a leading «جزيرة / island» so «جزيرة جيجو» ≡ «جيجو». */
function stripIsland(v: string): string {
  return v.replace(/^(جزيره|جزر)\s+/, '').replace(/\s+(island|islands)$/, '').trim();
}

function aliasGroup(cityNorm: string): string[] {
  const base = stripIsland(cityNorm);
  for (const [canon, alts] of Object.entries(CITY_ALIASES)) {
    const all = [canon, ...alts].map((x) => stripIsland(normText(x)));
    if (all.includes(base)) return [...new Set(all)];
  }
  return [base];
}

/** Do two city labels refer to the same place («سيؤول» ≡ «سيول», «جزيرة جيجو» ≡ «جيجو»)? */
export function sameCity(a: string, b: string): boolean {
  const na = stripIsland(normText(a));
  const nb = stripIsland(normText(b));
  if (!na || !nb) return false;
  if (na === nb) return true;
  return aliasGroup(na).includes(nb);
}

function countryLabelFor(id: string | null, fallback: string): string {
  if (!id) return fallback;
  return TRIP_DESTINATIONS.find((c) => c.id === id)?.labelAr ?? fallback;
}

/** Parse one raw token. */
export function parseDestination(rawInput: unknown): NormalizedDestination | null {
  const raw = String(rawInput ?? '').trim();
  if (!raw || raw === '—' || raw === '-') return null;

  // Split «country:city» · «country — city» · «country - city» · «country – city»
  let countryPart = '';
  let cityPart = raw;
  const colon = raw.indexOf(':');
  if (colon > 0) {
    countryPart = raw.slice(0, colon);
    cityPart = raw.slice(colon + 1);
  } else {
    const m = /^(.+?)\s+[—–-]\s+(.+)$/.exec(raw);
    if (m) {
      countryPart = m[1]!;
      cityPart = m[2]!;
    }
  }
  countryPart = countryPart.trim();
  cityPart = cityPart.trim();

  let countryId = canonicalTripCountryId(countryPart) ?? null;
  // Only a country was given («كوريا» / «korea»)
  if (!countryPart && canonicalTripCountryId(cityPart)) {
    countryId = canonicalTripCountryId(cityPart);
    const label = countryLabelFor(countryId, cityPart);
    return { countryId, countryLabel: label, label, key: `${countryId}:*`, aliases: [normText(cityPart), normText(label)], countryOnly: true, raw };
  }

  // Resolve the city against the curated list (also infers the country when missing)
  const cityNorm = normText(cityPart);
  let label = cityPart;
  for (const c of TRIP_DESTINATIONS) {
    if (countryId && c.id !== countryId) continue;
    const hit = c.cities.find((x) => normText(x.id) === cityNorm || sameCity(x.labelAr, cityPart));
    if (hit) {
      countryId = c.id;
      label = hit.labelAr.replace(/^جزيرة\s+/, '');
      break;
    }
  }
  // English city names → Arabic when we know them
  if (/^[a-z\s.'-]+$/i.test(label)) {
    for (const [canon, alts] of Object.entries(CITY_ALIASES)) {
      if (alts.some((a) => normText(a) === cityNorm)) {
        label = canon;
        break;
      }
    }
  }
  const countryLabel = countryLabelFor(countryId, countryPart);
  const group = aliasGroup(normText(label));
  return {
    countryId,
    countryLabel,
    label,
    key: `${countryId ?? normText(countryPart) ?? ''}:${group[0]}`,
    aliases: [...new Set([...group, normText(label), normText(cityPart)])],
    countryOnly: false,
    raw,
  };
}

/** Clean, de-duplicated list in the original order. */
export function normalizeDestinations(list: unknown[] | null | undefined): NormalizedDestination[] {
  const out: NormalizedDestination[] = [];
  const seen = new Set<string>();
  for (const item of list ?? []) {
    const d = parseDestination(item);
    if (!d || seen.has(d.key)) continue;
    // A bare country next to its own cities adds nothing
    if (d.countryOnly && out.some((o) => o.countryId && o.countryId === d.countryId)) continue;
    seen.add(d.key);
    out.push(d);
  }
  // Drop a bare country entry if a city of that country appears later
  return out.filter((d) => !d.countryOnly || !out.some((o) => !o.countryOnly && o.countryId === d.countryId));
}

/** Display label for any raw token («كوريا:سيول» → «سيول»). */
export function destinationLabel(raw: unknown): string {
  return parseDestination(raw)?.label ?? String(raw ?? '').trim();
}

/** «سيول · بوسان · غانغوون» */
export function destinationsLine(list: unknown[] | null | undefined): string {
  return normalizeDestinations(list)
    .map((d) => d.label)
    .join(' · ');
}

/** Does a bank row (places / hotels) belong to this destination? Strict: city must match (never country-only). */
export function bankRowMatches(dest: NormalizedDestination, row: { city?: unknown; country?: unknown }): boolean {
  const city = String(row.city ?? '').trim();
  if (dest.countryOnly) {
    const rowCountry = canonicalTripCountryId(String(row.country ?? ''));
    return Boolean(dest.countryId && rowCountry === dest.countryId);
  }
  if (!city) return false;
  if (dest.aliases.some((a) => sameCity(a, city))) return true;
  // «كيوتو/أوساكا» style combined bank labels
  return city.split(/[\/|،,]/).some((part) => dest.aliases.some((a) => sameCity(a, part)));
}

export function englishDestinationLabel(d: NormalizedDestination, enCountries?: Record<string, string>): string {
  return englishPlaceName(d.label, enCountries) ?? d.label;
}
