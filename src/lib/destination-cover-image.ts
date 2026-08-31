/** Dynamic destination hero / banner images for itineraries and group cards. */

const unsplash = (photoId: string, w = 1200) =>
  `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${w}&q=80`;

const DESTINATION_COVER_BANNERS: Array<{ keys: string[]; photoId: string }> = [
  {
    keys: ['korea', 'seoul', 'كوريا', 'سيول', 'سول'],
    photoId: 'photo-1538485399081-7191377e8241',
  },
  {
    keys: ['japan', 'tokyo', 'kyoto', 'osaka', 'اليابان', 'طوكيو', 'كيوتو', 'اوساكا', 'أوساكا'],
    photoId: 'photo-1493976040374-85c8e12f0c0e',
  },
  {
    keys: ['france', 'paris', 'فرنسا', 'باريس'],
    photoId: 'photo-1502602898657-3e91760cbb34',
  },
  {
    keys: ['italy', 'rome', 'milan', 'venice', 'إيطاليا', 'ايطاليا', 'روما', 'ميلان', 'فينيسيا'],
    photoId: 'photo-1523906834658-6e24ef2386f9',
  },
  {
    keys: ['spain', 'barcelona', 'madrid', 'إسبانيا', 'اسبانيا', 'برشلونة', 'مدريد'],
    photoId: 'photo-1558642452-9d2a7deb7f62',
  },
  {
    keys: ['maldives', 'المالديف', 'مالدي'],
    photoId: 'photo-1514282401047-d79a71a590e8',
  },
  {
    keys: ['turkey', 'istanbul', 'تركيا', 'اسطنبول', 'إسطنبول'],
    photoId: 'photo-1524231757912-21f4fe3a7200',
  },
  {
    keys: ['swiss', 'switzerland', 'سويسرا', 'زيورخ', 'جنيف', 'جبال'],
    photoId: 'photo-1506905925346-21bda4d32df4',
  },
  {
    keys: ['china', 'beijing', 'shanghai', 'الصين', 'بكين', 'شنغهاي'],
    photoId: 'photo-1508804185872-d7badad00f7d',
  },
  {
    keys: ['uk', 'london', 'المملكة', 'لندن', 'بريطانيا'],
    photoId: 'photo-1513635269975-59663e0ac1ad',
  },
  {
    keys: ['uae', 'dubai', 'abu dhabi', 'الإمارات', 'الامارات', 'دبي', 'أبوظبي', 'ابوظبي'],
    photoId: 'photo-1512453979798-5ea266f9340d',
  },
];

export const DEFAULT_DESTINATION_COVER = unsplash('photo-1469854523086-cc02fe5d8800');

export type DestinationCoverOptions = {
  /** Trip-level cover (`cover_image` on itinerary / trip row). */
  coverImage?: string | null;
  /** Destination row image (`destination.image_url`). */
  destinationImageUrl?: string | null;
  /** Unsplash width param — 1200 for hero banners, 900 for cards. */
  width?: number;
};

/**
 * Resolve a cover image URL: explicit trip/destination image first, then
 * destination-name dictionary, then a neutral travel default.
 */
export function resolveDestinationCoverImage(
  destination: string,
  options: DestinationCoverOptions = {},
): string {
  const cover = String(options.coverImage ?? '').trim();
  if (cover) return cover;

  const destImg = String(options.destinationImageUrl ?? '').trim();
  if (destImg) return destImg;

  const hay = String(destination ?? '').toLowerCase();
  const width = options.width ?? 1200;

  for (const row of DESTINATION_COVER_BANNERS) {
    if (row.keys.some((k) => hay.includes(k.toLowerCase()))) {
      return unsplash(row.photoId, width);
    }
  }

  return unsplash('photo-1469854523086-cc02fe5d8800', width);
}
