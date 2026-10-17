import { NextResponse } from 'next/server';

import { getPlacesBankDestinations } from '@/lib/places-bank';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** GET /api/places-bank/destinations → { countries, citiesByCountry } */
export async function GET() {
  try {
    const client = createServerSupabase();
    const data = await getPlacesBankDestinations(client);
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    console.error('[api/places-bank/destinations]', err);
    return NextResponse.json(
      { countries: [], citiesByCountry: {}, error: 'failed_to_load_destinations' },
      { status: 500 },
    );
  }
}
