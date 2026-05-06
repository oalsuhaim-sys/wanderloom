export type ExperienceCategory = 'cooking' | 'heritage' | 'shopping' | 'relaxation';

export type ExperienceRow = {
  id: string;
  title: string;
  country: string;
  city: string;
  category: ExperienceCategory;
  description: string;
  detail_url: string | null;
  created_at: string;
};
