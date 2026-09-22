import { NextRequest, NextResponse } from 'next/server';

import {
  FALLBACK_GENERATOR_OPTIONS,
  resolveMarketingGeneratorOptions,
} from '@/lib/marketing-generator-options';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if ('error' in auth) {
    // Still return fallbacks so the generator UI never blocks on auth edge cases.
    return NextResponse.json({
      ok: true,
      options: FALLBACK_GENERATOR_OPTIONS,
      warning: auth.error,
    });
  }

  try {
    const admin = createSupabaseAdminClient();
    const options = await resolveMarketingGeneratorOptions(admin);
    return NextResponse.json({ ok: true, options });
  } catch (error) {
    console.warn('[generator-options]', error);
    return NextResponse.json({
      ok: true,
      options: FALLBACK_GENERATOR_OPTIONS,
      warning: error instanceof Error ? error.message : 'options_fallback',
    });
  }
}
