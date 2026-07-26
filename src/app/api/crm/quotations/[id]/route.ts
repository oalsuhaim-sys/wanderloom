import { NextResponse, type NextRequest } from 'next/server';

import { resolveQuotationRouteId } from '@/lib/crm-quotations';
import { fetchQuotationForEditAdmin } from '@/lib/crm-quotations-server';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

function jsonWithCookies(
  body: unknown,
  status: number,
  getResponse: () => NextResponse,
) {
  const res = NextResponse.json(body, { status });
  const cookieResponse = getResponse();
  cookieResponse.cookies.getAll().forEach((cookie) => {
    res.cookies.set(cookie);
  });
  return res;
}

/** CRM quotation fetch — authenticated session; service_role bypasses RLS when configured. */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedCrmUser(request);
  if ('error' in auth) {
    return jsonWithCookies({ error: auth.error }, auth.status, auth.getResponse);
  }

  const { id: rawId } = await context.params;
  const id = resolveQuotationRouteId(rawId);
  if (!id) {
    return jsonWithCookies({ error: 'معرّف العرض غير صالح' }, 400, auth.getResponse);
  }

  let row: Record<string, unknown> | null = null;
  try {
    const quotation = await fetchQuotationForEditAdmin(id);
    row = quotation as unknown as Record<string, unknown> | null;
  } catch {
    row = null;
  }

  if (!row) {
    return jsonWithCookies(
      {
        error: 'تعذر العثور على عرض السعر',
        table: 'quotations',
        id,
      },
      404,
      auth.getResponse,
    );
  }

  return jsonWithCookies({ row }, 200, auth.getResponse);
}
