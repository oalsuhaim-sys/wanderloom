import { NextResponse, type NextRequest } from 'next/server';

import { resolveQuotationRouteId } from '@/lib/crm-quotations';
import { fetchPublicQuotationByIdAdmin } from '@/lib/crm-quotations-server';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Strip expert-only place references (Golden Rule): the hidden real place name
 * and place_id must NEVER reach the client-facing brochure payload.
 */
function stripExpertRefs<T>(quotation: T): T {
  const q = quotation as { itinerary_days?: unknown };
  if (!q || !Array.isArray(q.itinerary_days)) return quotation;
  q.itinerary_days = q.itinerary_days.map((day) => {
    const d = (day && typeof day === 'object' ? { ...(day as Record<string, unknown>) } : day) as
      | Record<string, unknown>
      | unknown;
    if (d && typeof d === 'object' && Array.isArray((d as Record<string, unknown>).stops)) {
      (d as Record<string, unknown>).stops = ((d as Record<string, unknown>).stops as unknown[]).map(
        (stop) => {
          if (!stop || typeof stop !== 'object') return stop;
          const clone = { ...(stop as Record<string, unknown>) };
          delete clone.place_id;
          delete clone.place_real_name;
          return clone;
        },
      );
    }
    return d;
  });
  return quotation;
}

/**
 * Public brochure fetch — no auth.
 * Uses service_role so guest clients can open /proposal/[id] despite RLS.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: rawId } = await context.params;
  const id = resolveQuotationRouteId(rawId);

  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'معرّف العرض غير صالح', id: rawId ?? null },
      { status: 400 },
    );
  }

  try {
    const quotation = await fetchPublicQuotationByIdAdmin(id);
    if (!quotation) {
      return NextResponse.json(
        {
          ok: false,
          error: 'تعذر العثور على عرض السعر',
          table: 'quotations',
          id,
        },
        { status: 404 },
      );
    }

    const safeQuotation = stripExpertRefs(quotation);

    return NextResponse.json({
      ok: true,
      quotation: safeQuotation,
      row: safeQuotation,
    });
  } catch (err) {
    console.error('[public-proposal] fetch failed:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'تعذر فتح العرض',
        id,
      },
      { status: 500 },
    );
  }
}
