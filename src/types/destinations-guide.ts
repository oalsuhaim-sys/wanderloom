/** صف كما يعيده Supabase (أسماء الأعمدة في قاعدة البيانات). */
export type DestinationsGuideDbRow = {
  id?: string;
  country_name?: string | null;
  city_name?: string | null;
  culture_info?: string | null;
  guidelines_tips?: string | null;
  weather_seasons?: string | null;
  professional_impression?: string | null;
  highlights?: string | null;
};

/** شكل موحّد للواجهة بعد المطابقة مع حقول النموذج. */
export type DestinationsGuideRow = {
  country_name: string;
  city_name: string;
  culture: string | null;
  guidelines: string | null;
  weather_seasons: string | null;
  professional_impression: string | null;
};
