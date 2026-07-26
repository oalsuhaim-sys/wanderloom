import { NextResponse, type NextRequest } from 'next/server';

import {
  accessFromEmployeeRow,
  FULL_CRM_PERMISSIONS,
  type CrmProfileAccess,
  type EmployeeRbacRow,
} from '@/lib/crm-permissions';
import { isEmergencyCrmOwnerBypass } from '@/lib/crm-roles';
import { mapExpertRow } from '@/lib/partner-entities';
import { provisionExpertAuthAccount } from '@/lib/expert-auth-provision';
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

function pickExpertName(row: Record<string, unknown>): string {
  const candidates = [
    row.name,
    row.full_name,
    row.display_name,
    row.expert_name,
    row.name_ar,
    row.name_en,
  ];
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (value) return value;
  }
  return '';
}

function bearerToken(request: NextRequest): string {
  const authorization = request.headers.get('authorization') ?? '';
  return authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';
}

async function resolveCrmAccess(
  request: NextRequest,
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<
  | {
      ok: true;
      access: CrmProfileAccess;
      getResponse: () => NextResponse;
    }
  | {
      ok: false;
      error: string;
      status: number;
      getResponse: () => NextResponse;
    }
> {
  const token = bearerToken(request);
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
    return {
      ok: false,
      error: 'غير مصرح',
      status: 401,
      getResponse,
    };
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
  if (employeeResult.error) {
    return {
      ok: false,
      error: employeeResult.error.message,
      status: 500,
      getResponse,
    };
  }

  return {
    ok: true,
    access: accessFromEmployeeRow(
      (employeeResult.data ?? null) as EmployeeRbacRow | null,
      user.email,
    ),
    getResponse,
  };
}

export async function GET(request: NextRequest) {
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json(
      { ok: false, rows: [], error: 'server_config' },
      { status: 503 },
    );
  }

  const auth = await resolveCrmAccess(request, admin);
  if (!auth.ok) {
    return jsonWithCookies(
      { ok: false, rows: [], error: auth.error },
      auth.status,
      auth.getResponse,
    );
  }
  if (
    auth.access.is_suspended ||
    (!auth.access.is_admin &&
      !auth.access.permissions.can_access_itineraries)
  ) {
    return jsonWithCookies(
      { ok: false, rows: [], error: 'صلاحية إدارة المسارات مطلوبة' },
      403,
      auth.getResponse,
    );
  }

  // Intentionally raw and unfiltered while diagnosing the itinerary dropdown.
  // The service-role client bypasses browser RLS, while this route remains admin-only.
  const { data, error } = await admin.from('experts').select('*');
  if (error) {
    return jsonWithCookies(
      { ok: false, rows: [], error: error.message },
      500,
      auth.getResponse,
    );
  }

  const rows = (data ?? [])
    .map((raw) => {
      const row = raw as Record<string, unknown>;
      const id = String(row.id ?? row.expert_id ?? '').trim();
      const name = pickExpertName(row) || (id ? `خبير ${id}` : '');
      const record = mapExpertRow({ ...row, id, name });
      if (!record) return null;
      return {
        ...record,
        specialty_regions:
          record.specialtyRegions,
        dna_profile: row.dna_profile ?? null,
      };
    })
    .filter((row) => row != null);

  return jsonWithCookies(
    { ok: true, rows, rawCount: data?.length ?? 0 },
    200,
    auth.getResponse,
  );
}

/** Admin adds expert → creates experts row + Auth user (service_role) + employees role=Expert */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const phone = String(body.phone ?? '').trim();
  const specialty = String(
    body.specialty_regions ?? body.specialtyRegions ?? body.specialty ?? '',
  ).trim();

  if (!name) {
    return NextResponse.json({ ok: false, error: 'اسم الخبير مطلوب.' }, { status: 400 });
  }
  if (!email || !email.includes('@')) {
    return NextResponse.json(
      { ok: false, error: 'بريد الخبير مطلوب لإنشاء حساب الدخول.' },
      { status: 400 },
    );
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const auth = await resolveCrmAccess(request, admin);
  if (!auth.ok) {
    return jsonWithCookies(
      { ok: false, error: auth.error },
      auth.status,
      auth.getResponse,
    );
  }
  if (auth.access.is_suspended || !auth.access.is_admin) {
    return jsonWithCookies(
      { ok: false, error: 'صلاحية المدير مطلوبة لإضافة خبير.' },
      403,
      auth.getResponse,
    );
  }

  const { data, error } = await admin
    .from('experts')
    .insert({
      name,
      email,
      phone: phone || null,
      specialty_regions: specialty || null,
      status: 'active',
    })
    .select('*')
    .single();

  if (error) {
    console.error('[crm/experts] insert failed:', error);
    return jsonWithCookies(
      { ok: false, error: error.message || 'insert_failed' },
      500,
      auth.getResponse,
    );
  }

  const authProvision = await provisionExpertAuthAccount(admin, {
    email,
    fullName: name,
    phone,
  });

  const row = mapExpertRow((data ?? {}) as Record<string, unknown>);
  return jsonWithCookies(
    {
      ok: true,
      row,
      auth: authProvision.ok
        ? {
            userId: authProvision.userId,
            createdAuthUser: authProvision.createdAuthUser,
            defaultPasswordHint: 'wl@123456',
          }
        : { error: authProvision.error },
    },
    200,
    auth.getResponse,
  );
}
