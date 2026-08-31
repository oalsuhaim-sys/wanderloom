/** صف بنك الأماكن — جدول `places` (نفس واجهة /crm/vault) */
export type PlaceBankRow = {
  id: string;
  name: string;
  country: string;
  city: string;
  category: string;
  sub_tag?: string | null;
  image_url?: string | null;
  /** فرع / منطقة — لتمييز فروع نفس العلامة */
  branch_name?: string | null;
  /** رابط خريطة مباشر (Google / Naver) */
  map_url?: string | null;
  maps_url?: string | null;
  google_maps_url?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  /** أنواع الغرف — للفنادق (category = h) */
  room_types?: string[] | null;
};
