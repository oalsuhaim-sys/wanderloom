import type { ExpertDnaProfile } from '@/lib/expert-dna';
import { parseExpertDnaProfile } from '@/lib/expert-dna';
import type { PartnerDnaProfile } from '@/lib/partner-dna';
import { parsePartnerDnaProfile } from '@/lib/partner-dna';
import { resolveCommissionRate } from '@/lib/partner-commission';

export type LeaderRecord = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  languages: string[];
  experienceYears: number | null;
  destinations: string | null;
  status: string | null;
  createdAt: string | null;
  dnaProfile: PartnerDnaProfile;
  countryCode: string | null;
  city: string | null;
  rating: number | null;
  completedTrips: number;
  availabilityStatus: string | null;
  category: string | null;
  iban: string | null;
  referralCode: string | null;
  /** % of profit margin — default 15 */
  commissionRate: number;
};

export type ExpertRecord = {
  id: string;
  name: string;
  specialtyRegions: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  createdAt: string | null;
  dnaProfile: ExpertDnaProfile;
  partnerDna: PartnerDnaProfile;
  countryCode: string | null;
  city: string | null;
  rating: number | null;
  completedTrips: number;
  availabilityStatus: string | null;
  category: string | null;
  iban: string | null;
  referralCode: string | null;
  /** % of profit margin — default 15 */
  commissionRate: number;
};

export type CelebrityRecord = {
  id: string;
  name: string;
  platforms: string | null;
  contentFocus: string | null;
  profileUrl: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  createdAt: string | null;
  dnaProfile: PartnerDnaProfile;
  countryCode: string | null;
  city: string | null;
  rating: number | null;
  completedTrips: number;
  availabilityStatus: string | null;
  category: string | null;
  iban: string | null;
};

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function parseLanguages(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }
  const text = String(raw ?? '').trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {
      /* fall through */
    }
  }
  return text.split(/[,،]/).map((s) => s.trim()).filter(Boolean);
}

function pickPartnerIntelligence(row: Record<string, unknown>) {
  const ratingRaw = row.rating;
  const rating =
    ratingRaw != null && Number.isFinite(Number(ratingRaw)) ? Number(ratingRaw) : null;
  const tripsRaw = row.completed_trips ?? row.total_trips;
  const completedTrips =
    tripsRaw != null && Number.isFinite(Number(tripsRaw))
      ? Math.max(0, Math.floor(Number(tripsRaw)))
      : 0;

  return {
    countryCode: pickString(row, ['country_code', 'country']),
    city: pickString(row, ['city']),
    rating,
    completedTrips,
    availabilityStatus: pickString(row, ['availability_status']),
    category: pickString(row, ['category', 'specialty', 'tier']),
    iban: pickString(row, ['iban', 'bank_iban']),
  };
}

export function mapLeaderRow(row: Record<string, unknown>): LeaderRecord | null {
  const id = row.id != null ? String(row.id) : '';
  const name = pickString(row, ['name']);
  if (!id || !name) return null;

  return {
    id,
    name,
    phone: pickString(row, ['phone']),
    email: pickString(row, ['email']),
    languages: parseLanguages(row.languages),
    experienceYears:
      row.experience_years != null && Number.isFinite(Number(row.experience_years))
        ? Number(row.experience_years)
        : null,
    destinations:
      pickString(row, ['destinations', 'preferred_destinations']) ?? null,
    status: pickString(row, ['status']),
    createdAt: pickString(row, ['created_at']),
    dnaProfile: parsePartnerDnaProfile(row.dna_profile),
    ...pickPartnerIntelligence(row),
    referralCode: pickString(row, ['referral_code', 'ref_code']),
    commissionRate: resolveCommissionRate(row.commission_rate),
  };
}

export function mapExpertRow(row: Record<string, unknown>): ExpertRecord | null {
  const id = row.id != null ? String(row.id) : '';
  const name = pickString(row, ['name']);
  if (!id || !name) return null;

  return {
    id,
    name,
    specialtyRegions:
      pickString(row, ['specialty_regions', 'specialty', 'preferred_destinations']) ??
      null,
    phone: pickString(row, ['phone']),
    email: pickString(row, ['email']),
    status: pickString(row, ['status']),
    createdAt: pickString(row, ['created_at']),
    dnaProfile: parseExpertDnaProfile(row.dna_profile),
    partnerDna: parsePartnerDnaProfile(row.dna_profile),
    ...pickPartnerIntelligence(row),
    referralCode: pickString(row, ['referral_code', 'ref_code']),
    commissionRate: resolveCommissionRate(row.commission_rate),
  };
}

export function mapCelebrityRow(row: Record<string, unknown>): CelebrityRecord | null {
  const id = row.id != null ? String(row.id) : '';
  const name = pickString(row, ['name']);
  if (!id || !name) return null;

  return {
    id,
    name,
    platforms: pickString(row, ['platforms']),
    contentFocus: pickString(row, ['content_type', 'content_focus']),
    profileUrl: pickString(row, ['profile_url']),
    phone: pickString(row, ['phone']),
    email: pickString(row, ['email']),
    status: pickString(row, ['status']),
    createdAt: pickString(row, ['created_at']),
    dnaProfile: parsePartnerDnaProfile(row.dna_profile),
    ...pickPartnerIntelligence(row),
  };
}
