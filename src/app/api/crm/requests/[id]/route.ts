import { NextResponse, type NextRequest } from 'next/server';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Inbox requests are rows in public.leads.
 * Deletes that lead only. public.clients is never read or written.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id: rawId } = await context.params;
  const requestId = String(rawId ?? '').trim();
  console.log('Deleting ID:', requestId);

  if (!requestId) {
    return NextResponse.json({ success: false, error: 'معرّف الطلب غير صالح.' }, { status: 400 });
  }

  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin.from('leads').delete().eq('id', requestId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'تعذر حذف الطلب.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
