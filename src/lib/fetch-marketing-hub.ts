import { queryMarketingHub } from '@/lib/marketing-hub-fetch-core';
import { marketingSupabase } from '@/lib/marketing-supabase-client';

export async function fetchMarketingHubData() {
  return queryMarketingHub(marketingSupabase);
}
