import { NextResponse } from 'next/server';

import { fetchMarketingHubData } from '@/lib/fetch-marketing-hub';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await fetchMarketingHubData();
  if (data.loadError) {
    return NextResponse.json(data, { status: 200 });
  }
  return NextResponse.json(data);
}
