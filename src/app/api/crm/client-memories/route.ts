import { NextResponse } from 'next/server';

import { fetchAllClientMemoriesAdmin } from '@/lib/client-memories-server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET() {
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'server_config' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const { memories, error } = await fetchAllClientMemoriesAdmin(admin);

  if (error) {
    return NextResponse.json(
      { ok: false, error },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  // Live exact counts by client_id — source of truth for the client cards
  const countsByClient: Record<string, number> = {};
  for (const memory of memories) {
    const key =
      memory.client_id != null && String(memory.client_id).trim() !== ''
        ? String(memory.client_id)
        : '__unassigned__';
    countsByClient[key] = (countsByClient[key] ?? 0) + 1;
  }

  const { count: totalCount, error: countError } = await admin
    .from('client_memories')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.warn('[client-memories] exact count failed:', countError.message);
  }

  return NextResponse.json(
    {
      ok: true,
      memories,
      countsByClient,
      totalCount: totalCount ?? memories.length,
      fetchedAt: new Date().toISOString(),
    },
    { headers: NO_STORE_HEADERS },
  );
}
