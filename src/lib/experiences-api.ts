import type { ExperienceApiResult } from '@/app/actions/experiences';
import type { PlacesBankPlaceRowData } from '@/app/crm/itineraries/_components/PlacesBankPlaceRow';

/** Attraction → `l` (landmark), Fun → `f` (family entertainment) — places bank codes */
export function experienceCategoryCode(hint?: ExperienceApiResult['category_hint']): 'l' | 'f' {
  return hint === 'attraction' ? 'l' : 'f';
}

export function experienceToPlaceBankRow(
  experience: ExperienceApiResult,
  destination?: string,
): PlacesBankPlaceRowData {
  const city = experience.destination?.trim() || destination?.trim() || '';
  const category = experienceCategoryCode(experience.category_hint);

  return {
    id: `api-${experience.provider}-${experience.id}`,
    name: experience.title,
    category,
    city,
    rating: experience.rating,
    image_url: experience.image_url,
    price: experience.price,
    price_currency: experience.currency,
    experience_provider: experience.provider,
    external_experience_id: experience.id,
    source: 'experiences_api',
    sub_tag: `${experience.provider.toUpperCase()} · تجربة حية`,
  };
}

export function formatExperiencePrice(price: number, currency = 'SAR'): string {
  const amount = Number.isFinite(price) ? price : 0;
  return `${amount.toLocaleString('ar-SA')} ${currency}`;
}

export function renderExperienceStars(rating: number): string {
  const clamped = Math.max(0, Math.min(5, rating));
  const full = Math.round(clamped);
  return '⭐'.repeat(full) + (full < 5 ? '☆'.repeat(5 - full) : '');
}
