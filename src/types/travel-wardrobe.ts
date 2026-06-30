export type TravelWardrobeRow = {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  purchase_url: string | null;
  /** بديل اختياري لرابط الشراء (يتوافق مع قواعد بيانات تستخدم purchase_link) */
  purchase_link?: string | null;
  seasons: string[] | null;
  destinations: string[] | null;
  season_tags?: string[] | null;
  destination_tags?: string[] | null;
  created_at: string;
};
