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

export function expertMatchesDestination(
  expert: MatchableExpert,
  destinations: unknown[],
): boolean {
  const targets = destinations
    .flatMap(splitDestinationText)
    .map(normalizeDestination)
    .filter(Boolean);
  if (targets.length === 0) return false;

  return expertSpecialtyDestinations(expert)
    .map(normalizeDestination)
    .filter(Boolean)
    .some((specialty) =>
      targets.some(
        (target) =>
          specialty === target ||
          specialty.includes(target) ||
          target.includes(specialty),
      ),
    );
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
