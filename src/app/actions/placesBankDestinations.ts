'use server';

import {
  getPlacesBankDestinations,
  type PlacesBankDestinations,
} from '@/lib/places-bank';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Server Action — مصدر الحقيقة لدول/مدن بنك الأماكن.
 * يُستخدم من الواجهات العامة والـ CRM بدل القوائم الثابتة.
 */
export async function getPlacesBankDestinationsAction(): Promise<PlacesBankDestinations> {
  try {
    const client = createServerSupabase();
    return await getPlacesBankDestinations(client);
  } catch (err) {
    console.error('[getPlacesBankDestinationsAction]', err);
    return { countries: [], citiesByCountry: {} };
  }
}
