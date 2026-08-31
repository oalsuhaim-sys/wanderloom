import { CRM_DESTINATIONS_GUIDE } from '@/lib/crm-destinations-guide-data';
import { parsePartnerDnaProfile } from '@/lib/partner-dna';

export type MatchableExpert = {
  id: string;
  name: string;
  status?: string | null;
  specialtyRegions?: string | null;
  specialty_regions?: string | null;
  partnerDna?: unknown;
  dnaProfile?: unknown;
  dna_profile?: unknown;
};

function normalizeDestination(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('ar')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function splitDestinationText(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(splitDestinationText);
  }
  return String(value ?? '')
    .split(/[,،·/|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isActiveExpertStatus(status: unknown): boolean {
  const normalized = String(status ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('ar');

  return (
    !normalized ||
    ['active', 'approved', 'نشط', 'معتمد'].includes(normalized)
  );
}

/** Expand Arabic/English destination tokens so "روسيا" also matches "Russia" / guide ids / cities. */
function expandDestinationTokens(raw: string): string[] {
  const base = normalizeDestination(raw);
  if (!base) return [];

  const out = new Set<string>([base]);

  for (const country of CRM_DESTINATIONS_GUIDE) {
    const label = normalizeDestination(country.labelAr);
    const id = normalizeDestination(country.id);
    const related = [label, id, ...country.cities.map((c) => normalizeDestination(c.labelAr))];
    const hits = related.some(
      (token) =>
        token &&
        (base === token || base.includes(token) || token.includes(base)),
    );
    if (!hits) continue;
    for (const token of related) {
      if (token) out.add(token);
    }
  }

  return [...out];
}

export function expertSpecialtyDestinations(expert: MatchableExpert): string[] {
  const dna = parsePartnerDnaProfile(
    expert.partnerDna ?? expert.dnaProfile ?? expert.dna_profile,
  );
  return Array.from(
    new Set([
      ...dna.approvedDestinations,
      ...splitDestinationText(
        expert.specialtyRegions ?? expert.specialty_regions,
      ),
    ]),
  );
}

function expertSpecialtyTokens(expert: MatchableExpert): string[] {
  return Array.from(
    new Set(
      expertSpecialtyDestinations(expert).flatMap((dest) =>
        expandDestinationTokens(dest),
      ),
    ),
  ).filter(Boolean);
}

function tripHaystackTokens(fields: unknown[]): string[] {
  return Array.from(
    new Set(
      fields
        .flatMap(splitDestinationText)
        .flatMap((part) => expandDestinationTokens(part)),
    ),
  ).filter(Boolean);
}

function tokensOverlap(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  return a.some((left) =>
    b.some(
      (right) =>
        left === right || left.includes(right) || right.includes(left),
    ),
  );
}

export function expertMatchesDestination(
  expert: MatchableExpert,
  destinations: unknown[],
): boolean {
  return tokensOverlap(
    expertSpecialtyTokens(expert),
    tripHaystackTokens(destinations),
  );
}

/**
 * Match expert destinations against trip destination / country / title / description fields.
 * Returns false only when the expert has no destinations OR the trip haystack is empty.
 */
export function expertMatchesTripFields(
  expert: MatchableExpert,
  fields: {
    destination?: unknown;
    country?: unknown;
    title?: unknown;
    titleAr?: unknown;
    titleEn?: unknown;
    description?: unknown;
    descriptionAr?: unknown;
    descriptionEn?: unknown;
    badge?: unknown;
    badgeAr?: unknown;
    badgeEn?: unknown;
  },
): boolean {
  return expertMatchesDestination(expert, [
    fields.destination,
    fields.country,
    fields.title,
    fields.titleAr,
    fields.titleEn,
    fields.description,
    fields.descriptionAr,
    fields.descriptionEn,
    fields.badge,
    fields.badgeAr,
    fields.badgeEn,
  ]);
}

export function groupExpertsByDestination<T extends MatchableExpert>(
  experts: T[],
  destinations: unknown[],
): { recommended: T[]; others: T[] } {
  const activeExperts = experts.filter((expert) =>
    isActiveExpertStatus(expert.status),
  );
  return {
    recommended: activeExperts.filter((expert) =>
      expertMatchesDestination(expert, destinations),
    ),
    others: activeExperts.filter(
      (expert) => !expertMatchesDestination(expert, destinations),
    ),
  };
}
