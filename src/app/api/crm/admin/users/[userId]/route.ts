import { NextResponse, type NextRequest } from 'next/server';

import {
  CRM_PERMISSION_KEYS,
  employeePatchFromAccess,
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

type RouteContext = { params: Promise<{ userId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireCrmAdmin(request);
  if ('error' in auth) {
    return jsonWithCookies({ error: auth.error }, auth.status, auth.getResponse);
  }

  const { userId } = await context.params;
  if (!userId) {
    return jsonWithCookies({ error: 'معرّف المستخدم مطلوب' }, 400, auth.getResponse);
  }

  if (userId === auth.user.id) {
    return jsonWithCookies({ error: 'لا يمكنك تعديل صلاحيات حسابك من هنا' }, 400, auth.getResponse);
  }

  let body: {
    permissions?: Record<string, boolean>;
    is_admin?: boolean;
    is_suspended?: boolean;
    full_name?: string;
  };

  try {
    body = await request.json();
  } catch {
    return jsonWithCookies({ error: 'طلب غير صالح' }, 400, auth.getResponse);
  }

  const admin = createSupabaseAdminClient();

  const { data: existing, error: fetchErr } = await admin
    .from('employees')
    .select('is_admin, permissions, full_name, role, can_access_dashboard, can_access_clients, can_access_itineraries, can_access_marketing, can_access_payments')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr) {
    return jsonWithCookies({ error: fetchErr.message }, 500, auth.getResponse);
  }
  if (!existing) {
    return jsonWithCookies({ error: 'المستخدم غير موجود' }, 404, auth.getResponse);
  }

  const nextIsAdmin = typeof body.is_admin === 'boolean' ? body.is_admin : Boolean(existing.is_admin);
  const nextPermissions = normalizeCrmPermissions(
    nextIsAdmin
      ? Object.fromEntries(CRM_PERMISSION_KEYS.map((k) => [k, true]))
      : body.permissions ?? existing.permissions,
  );

  const patch = employeePatchFromAccess({
    is_admin: nextIsAdmin,
    is_suspended: typeof body.is_suspended === 'boolean' ? body.is_suspended : undefined,
    permissions: nextPermissions,
    full_name: typeof body.full_name === 'string' ? body.full_name : undefined,
  });

  const { error: updateErr } = await admin.from('employees').update(patch).eq('user_id', userId);
  if (updateErr) {
    return jsonWithCookies({ error: updateErr.message }, 500, auth.getResponse);
  }

  if (typeof body.is_suspended === 'boolean') {
    await admin.auth.admin.updateUserById(userId, {
      ban_duration: body.is_suspended ? '876000h' : 'none',
    });
  }

  return jsonWithCookies({ ok: true }, 200, auth.getResponse);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireCrmAdmin(request);
  if ('error' in auth) {
    return jsonWithCookies({ error: auth.error }, auth.status, auth.getResponse);
  }

  const { userId } = await context.params;
  if (!userId) {
    return jsonWithCookies({ error: 'معرّف المستخدم مطلوب' }, 400, auth.getResponse);
  }
  if (userId === auth.user.id) {
    return jsonWithCookies({ error: 'لا يمكنك حذف حسابك الحالي' }, 400, auth.getResponse);
  }

  const admin = createSupabaseAdminClient();

  const { data: admins } = await admin
    .from('employees')
    .select('user_id')
    .eq('is_admin', true)
    .eq('is_suspended', false);

  const { data: target } = await admin
    .from('employees')
    .select('is_admin, role')
    .eq('user_id', userId)
    .maybeSingle();

  const targetIsAdmin =
    Boolean(target?.is_admin) || String(target?.role ?? '').toLowerCase() === 'admin';
  if (targetIsAdmin && (admins?.length ?? 0) <= 1) {
    return jsonWithCookies({ error: 'لا يمكن حذف آخر مدير في النظام' }, 400, auth.getResponse);
  }

  const { error: suspendErr } = await admin
    .from('employees')
    .update({ is_suspended: true })
    .eq('user_id', userId);

  if (suspendErr) {
    return jsonWithCookies({ error: suspendErr.message }, 500, auth.getResponse);
  }

  await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' });

  return jsonWithCookies({ ok: true, suspended: true }, 200, auth.getResponse);
}
