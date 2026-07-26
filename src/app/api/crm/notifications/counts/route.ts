import { NextResponse, type NextRequest } from 'next/server';

import {
  accessFromEmployeeRow,
  FULL_CRM_PERMISSIONS,
  type CrmProfileAccess,
  type EmployeeRbacRow,
} from '@/lib/crm-permissions';
import { isEmergencyCrmOwnerBypass } from '@/lib/crm-roles';
import { RADAR_INBOX_STATUS_OR } from '@/lib/lead-status';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Match Partner Radar: pending + null/empty (normalizeStatus treats them as pending). */
const PENDING_PARTNER_OR = 'status.eq.pending,status.is.null';

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

function safeCount(result: {
  count: number | null;
  error: { message?: string } | null;
}): number {
  if (result.error) {
    console.warn('[crm/notifications] count failed:', result.error.message);
    return 0;
  }
  return result.count ?? 0;
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

export async function GET(request: NextRequest) {
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'server_config' },
      { status: 503 },
    );
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

  const canSeeLeads =
    auth.access.is_admin || auth.access.permissions.can_access_itineraries;

  const [leaders, experts, legacyPartners, leads] = await Promise.all([
    admin
      .from('leaders')
      .select('id', { count: 'exact', head: true })
      .or(PENDING_PARTNER_OR),
    admin
      .from('experts')
      .select('id', { count: 'exact', head: true })
      .or(PENDING_PARTNER_OR),
    admin
      .from('partner_applications')
      .select('id', { count: 'exact', head: true })
      .or(PENDING_PARTNER_OR)
      .in('partner_kind', ['leader', 'expert']),
    canSeeLeads
      ? admin
          .from('leads')
          .select('id', { count: 'exact', head: true })
          // Must match Radar inbox (`fetchNewCrmLeads` / RADAR_INBOX_STATUS_OR)
          .or(RADAR_INBOX_STATUS_OR)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  const pendingPartners =
    safeCount(leaders) + safeCount(experts) + safeCount(legacyPartners);
  const pendingTrips = safeCount(leads);

  return jsonWithCookies(
    {
      ok: true,
      pendingPartners,
      pendingTrips,
      totalPending: pendingPartners + pendingTrips,
      refreshedAt: new Date().toISOString(),
    },
    200,
    auth.getResponse,
  );
}
