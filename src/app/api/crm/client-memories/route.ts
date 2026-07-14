import { NextResponse } from 'next/server';

import { fetchAllClientMemoriesAdmin } from '@/lib/client-memories-server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const { memories, error } = await fetchAllClientMemoriesAdmin(admin);

  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, memories });
}
