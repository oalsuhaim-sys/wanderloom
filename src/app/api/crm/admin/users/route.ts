import { NextResponse, type NextRequest } from 'next/server';

import {
  CRM_PERMISSION_KEYS,
  DEFAULT_CRM_PERMISSIONS,
  employeePatchFromAccess,
  mapEmployeeToAdminUser,
  normalizeCrmPermissions,
} from '@/lib/crm-permissions';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireCrmAdmin } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';

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

export async function GET(request: NextRequest) {
  const auth = await requireCrmAdmin(request);
  if ('error' in auth) {
    return jsonWithCookies({ error: auth.error }, auth.status, auth.getResponse);
  }

  const { data, error } = await auth.supabase
    .from('employees')
    .select(
      'id, user_id, full_name, email, role, is_admin, is_suspended, permissions, can_access_dashboard, can_access_clients, can_access_itineraries, can_access_marketing, can_access_payments, created_at',
    )
    .order('created_at', { ascending: false });

  if (error) {
    return jsonWithCookies({ error: error.message }, 500, auth.getResponse);
  }

  const profiles = (data ?? []).map((row) => mapEmployeeToAdminUser(row));
  return jsonWithCookies({ profiles }, 200, auth.getResponse);
}

export async function POST(request: NextRequest) {
  const auth = await requireCrmAdmin(request);
  if ('error' in auth) {
    return jsonWithCookies({ error: auth.error }, auth.status, auth.getResponse);
  }

  let body: {
    full_name?: string;
    email?: string;
    password?: string;
    is_admin?: boolean;
    permissions?: Record<string, boolean>;
  };

  try {
    body = await request.json();
  } catch {
    return jsonWithCookies({ error: 'طلب غير صالح' }, 400, auth.getResponse);
  }

  const fullName = String(body.full_name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const isAdmin = Boolean(body.is_admin);
  const permissions = normalizeCrmPermissions(
    isAdmin
      ? Object.fromEntries(CRM_PERMISSION_KEYS.map((k) => [k, true]))
      : { ...DEFAULT_CRM_PERMISSIONS, ...body.permissions },
  );

  if (!fullName || !email || !password) {
    return jsonWithCookies({ error: 'الاسم والبريد وكلمة المرور مطلوبة' }, 400, auth.getResponse);
  }
  if (password.length < 8) {
    return jsonWithCookies({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' }, 400, auth.getResponse);
  }

  const admin = createSupabaseAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createErr || !created.user) {
    return jsonWithCookies(
      { error: createErr?.message ?? 'تعذر إنشاء المستخدم' },
      400,
      auth.getResponse,
    );
  }

  const userId = created.user.id;
  const employeePatch = employeePatchFromAccess({
    is_admin: isAdmin,
    is_suspended: false,
    permissions,
    full_name: fullName,
  });

  const { error: employeeErr } = await admin.from('employees').insert({
    user_id: userId,
    full_name: fullName,
    email,
    ...employeePatch,
  });

  if (employeeErr) {
    await admin.auth.admin.deleteUser(userId);
    return jsonWithCookies({ error: employeeErr.message }, 500, auth.getResponse);
  }

  return jsonWithCookies(
    {
      profile: mapEmployeeToAdminUser({
        user_id: userId,
        full_name: fullName,
        email,
        is_admin: isAdmin,
        is_suspended: false,
        permissions,
        role: isAdmin ? 'Admin' : 'Advisor',
      }),
    },
    201,
    auth.getResponse,
  );
}
