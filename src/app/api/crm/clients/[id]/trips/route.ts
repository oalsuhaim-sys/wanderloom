import { NextResponse, type NextRequest } from 'next/server';

import {
  accessFromEmployeeRow,
  FULL_CRM_PERMISSIONS,
  type CrmProfileAccess,
  type EmployeeRbacRow,
} from '@/lib/crm-permissions';
import { isEmergencyCrmOwnerBypass } from '@/lib/crm-roles';
import { fetchUnifiedClientTripsAdmin } from '@/lib/client-itineraries-server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonWithCookies(
  body: unknown,
  status: number,
  getResponse: () => NextResponse,
) {
  const response = NextResponse.json(body, { status });
  getResponse()
    .cookies.getAll()
    .forEach((cookie) => response.cookies.set(cookie));
  return response;
}

async function authorizeCrmUser(
  request: NextRequest,
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<
  | { ok: true; access: CrmProfileAccess; getResponse: () => NextResponse }
  | {
      ok: false;
      error: string;
      status: number;
      getResponse: () => NextResponse;
    }
> {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';

  if (!token) {
    const cookieAuth = await getAuthenticatedCrmUser(request);
    if ('error' in cookieAuth) {
      return {
        ok: false,
        error: String(cookieAuth.error ?? 'غير مصرح'),
        status: cookieAuth.status ?? 401,
        getResponse: cookieAuth.getResponse,
      };
    }
    return {
      ok: true,
      access: cookieAuth.access,
      getResponse: cookieAuth.getResponse,
    };
  }

  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token);
  const getResponse = () => NextResponse.next({ request });
  if (error || !user) {
    return { ok: false, error: 'غير مصرح', status: 401, getResponse };
  }

  const email = user.email?.trim().toLowerCase() ?? null;
  if (isEmergencyCrmOwnerBypass(email)) {
    return {
      ok: true,
      access: {
        is_admin: true,
        is_expert: false,
        is_suspended: false,
        permissions: { ...FULL_CRM_PERMISSIONS },
      },
      getResponse,
    };
  }

  let employeeResult = await admin
    .from('employees')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!employeeResult.data && email) {
    employeeResult = await admin
      .from('employees')
      .select('*')
      .eq('email', email)
      .maybeSingle();
  }

  const access = accessFromEmployeeRow(
    (employeeResult.data ?? null) as EmployeeRbacRow | null,
    user.email,
  );

  return { ok: true, access, getResponse };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { id: clientId } = await context.params;
  if (!clientId?.trim()) {
    return NextResponse.json({ ok: false, error: 'missing_client_id' }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const auth = await authorizeCrmUser(request, admin);
  if (!auth.ok) {
    return jsonWithCookies(
      { ok: false, error: auth.error },
      auth.status,
      auth.getResponse,
    );
  }
  if (auth.access.is_suspended) {
    return jsonWithCookies(
      { ok: false, error: 'الحساب معلّق' },
      403,
      auth.getResponse,
    );
  }

  const { trips, error } = await fetchUnifiedClientTripsAdmin(admin, clientId);
  if (error) {
    return jsonWithCookies(
      { ok: false, error },
      500,
      auth.getResponse,
    );
  }

  return jsonWithCookies(
    {
      ok: true,
      trips,
      count: trips.length,
      refreshedAt: new Date().toISOString(),
    },
    200,
    auth.getResponse,
  );
}
