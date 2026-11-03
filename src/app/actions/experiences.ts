'use server';

export type ExperienceApiResult = {
  id: string;
  title: string;
  image_url: string;
  price: number;
  currency: string;
  rating: number;
  provider: 'viator' | 'getyourguide' | 'mock';
  destination?: string;
  category_hint?: 'attraction' | 'fun';
};

export type SearchExperiencesResult =
  | { ok: true; results: ExperienceApiResult[] }
  | { ok: false; error: string };

const MOCK_EXPERIENCES: ExperienceApiResult[] = [
  {
    id: 'mock-paris-1',
    title: 'جولة إرشادية في متحف اللوفر مع تذكرة دخول',
    image_url: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=640&q=80',
    price: 285,
    currency: 'SAR',
    rating: 4.8,
    provider: 'viator',
    category_hint: 'attraction',
  },
  {
    id: 'mock-paris-2',
    title: 'رحلة بحرية على نهر السين عند الغروب',
    image_url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=640&q=80',
    price: 195,
    currency: 'SAR',
    rating: 4.6,
    provider: 'getyourguide',
    category_hint: 'fun',
  },
  {
    id: 'mock-paris-3',
    title: 'تجربة طهي فرنسية مع شيف محلي',
    image_url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=640&q=80',
    price: 420,
    currency: 'SAR',
    rating: 4.9,
    provider: 'viator',
    category_hint: 'fun',
  },
];

/**
 * Placeholder search — returns mock experiences until Viator/GetYourGuide keys are wired.
 */
export async function searchExperiencesAPI(destination: string): Promise<SearchExperiencesResult> {
  const query = String(destination ?? '').trim();
  if (!query) {
    return { ok: false, error: 'يرجى إدخال اسم المدينة أو الوجهة' };
  }

  // TODO: Replace with real Viator/GetYourGuide fetch logic once API key is provided
  await new Promise((resolve) => setTimeout(resolve, 650));

  const label = query.split(/[،,]/)[0]?.trim() || query;
  const results = MOCK_EXPERIENCES.map((item, index) => ({
    ...item,
    id: `${item.id}-${index}`,
    title: item.title.replace('متحف اللوفر', `متحف ${label}`).replace('نهر السين', `معالم ${label}`),
    destination: label,
  }));

  return { ok: true, results };
}
