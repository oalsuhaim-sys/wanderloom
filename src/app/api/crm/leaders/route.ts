import { NextResponse } from 'next/server';

import { fetchLeadersAdmin } from '@/lib/partner-entities-server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const { rows, error } = await fetchLeadersAdmin(admin);
  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows });
}
