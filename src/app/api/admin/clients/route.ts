import { NextResponse, type NextRequest } from 'next/server';

import { fetchClientDirectoryAction } from '@/app/actions/clientDirectoryActions';
import type { ClientDirectoryPayload } from '@/app/crm/clients/useClientDirectory';
import type { VipClientProfile } from '@/lib/clientsTravelDna';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

/** Next.js route segment cache hint (paired with Cache-Control below). */
export const revalidate = 10;

const CACHE_CONTROL = 'private, max-age=10, s-maxage=10, stale-while-revalidate=59';

function uniqueClientsById(rows: VipClientProfile[]): VipClientProfile[] {
  const seen = new Set<string>();
  const out: VipClientProfile[] = [];
  for (const row of rows) {
    const id = String(row.id ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

/** Fast stats from row fields — avoids extra round-trips on every navigation */
function buildStatsFromRows(rows: VipClientProfile[]): Pick<
  ClientDirectoryPayload,
  'tripCounts' | 'profitTotals'
> {
  const tripCounts: Record<string, number> = {};
  const profitTotals: Record<string, number> = {};
  for (const row of rows) {
    const id = String(row.id ?? '').trim();
    if (!id) continue;
    tripCounts[id] = Math.max(0, Math.floor(Number(row.total_trips) || 0));
    profitTotals[id] = Number(row.total_profit ?? row.lifetime_value ?? 0) || 0;
  }
  return { tripCounts, profitTotals };
}

function jsonCached(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': CACHE_CONTROL,
      'CDN-Cache-Control': CACHE_CONTROL,
      'Vercel-CDN-Cache-Control': CACHE_CONTROL,
    },
  });
}

/**
 * GET /api/admin/clients
 * Cached CRM client directory for zero-latency navigations.
 * Uses singleton service-role Supabase admin client.
 */
export async function GET(request: NextRequest) {
  try {
    // Warm singleton admin connection (no re-auth per invocation)
    createSupabaseAdminClient();

    const authorization = request.headers.get('authorization') ?? '';
    const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';

    const auth = await getAuthenticatedCrmUser(request);
    if ('error' in auth) {
      return jsonCached(
        { ok: false, error: String(auth.error ?? 'غير مصرح') },
        auth.status ?? 401,
      );
    }

    if (auth.access.is_suspended) {
      return jsonCached({ ok: false, error: 'الحساب موقوف' }, 403);
    }

    const result = await fetchClientDirectoryAction(bearer || null, {
      skipBackfill: true,
    });
    if (!result.ok) {
      return jsonCached({ ok: false, error: result.error }, 500);
    }

    const rows = uniqueClientsById(result.rows);
    const stats = buildStatsFromRows(rows);

    return jsonCached({
      ok: true,
      rows,
      tripCounts: stats.tripCounts,
      profitTotals: stats.profitTotals,
    });
  } catch (err) {
    console.error('[api/admin/clients]', err);
    return jsonCached(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'تعذر تحميل قاعدة العملاء.',
      },
      500,
    );
  }
}
