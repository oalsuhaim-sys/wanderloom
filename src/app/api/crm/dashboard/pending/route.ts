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

function destinationsLabel(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean).join('، ');
  }
  return String(value ?? '').trim();
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

  const [expertsResult, leadersResult, leadsResult] = await Promise.all([
    admin
      .from('experts')
      .select('id, name, created_at', { count: 'exact' })
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(6),
    admin
      .from('leaders')
      .select('id, name, created_at', { count: 'exact' })
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(6),
    canSeeLeads
      ? admin
          .from('leads')
          .select('id, full_name, destinations, status, created_at', {
            count: 'exact',
          })
          // Same filter as Radar «صندوق الوارد» / fetchNewCrmLeads
          .or(RADAR_INBOX_STATUS_OR)
          .order('created_at', { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [], count: 0, error: null }),
  ]);

  const error =
    expertsResult.error || leadersResult.error || leadsResult.error;
  if (error) {
    return jsonWithCookies(
      { ok: false, error: error.message },
      500,
      auth.getResponse,
    );
  }

  const partnerRequests = [
    ...(expertsResult.data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? '').trim() || 'خبير بدون اسم',
      type: 'expert' as const,
      createdAt: String(row.created_at ?? ''),
    })),
    ...(leadersResult.data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? '').trim() || 'قائد بدون اسم',
      type: 'leader' as const,
      createdAt: String(row.created_at ?? ''),
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  const clientRequests = (leadsResult.data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.full_name ?? '').trim() || 'عميل بدون اسم',
    destination: destinationsLabel(row.destinations) || 'لم تُحدد الوجهة',
    status: String(row.status ?? ''),
    createdAt: String(row.created_at ?? ''),
  }));

  return jsonWithCookies(
    {
      ok: true,
      partnerRequests,
      clientRequests,
      counts: {
        partners:
          (expertsResult.count ?? 0) + (leadersResult.count ?? 0),
        clients: leadsResult.count ?? clientRequests.length,
      },
    },
    200,
    auth.getResponse,
  );
}
