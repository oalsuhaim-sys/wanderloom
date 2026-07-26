'use server';

import { revalidatePath } from 'next/cache';

import {
  CRM_PERMISSION_KEYS,
  DEFAULT_CRM_PERMISSIONS,
  employeePatchFromAccess,
  mapEmployeeToAdminUser,
  normalizeCrmPermissions,
  type CrmPermissions,
} from '@/lib/crm-permissions';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  assertServiceRoleKeyConfigured,
  requireAdminServerAction,
} from '@/lib/supabase/server-action-auth';

export type AdminActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string };

export type AdminTeamMember = {
  id: string;
  full_name: string;
  email: string | null;
  is_admin: boolean;
  is_suspended: boolean;
  permissions: CrmPermissions;
  created_at: string | null;
};

function duplicateEmailMessage(): string {
  return 'هذا البريد الإلكتروني مسجل مسبقاً';
}

function isDuplicateEmailError(message: string | undefined): boolean {
  const msg = String(message ?? '').toLowerCase();
  return (
    msg.includes('already') ||
    msg.includes('registered') ||
    msg.includes('exists') ||
    msg.includes('duplicate') ||
    msg.includes('unique')
  );
}

async function insertEmployeeWithFallback(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  payload: Record<string, unknown>,
) {
  const full = await admin.from('employees').insert(payload).select('id').single();
  if (!full.error) return full;

  if (/column|schema cache|does not exist/i.test(full.error.message ?? '')) {
    const minimal: Record<string, unknown> = {
      user_id: payload.user_id,
      full_name: payload.full_name,
      email: payload.email,
      role: payload.role,
      job_title: payload.job_title,
    };
    if (payload.phone_wa) minimal.phone_wa = payload.phone_wa;
    return admin.from('employees').insert(minimal).select('id').single();
  }

  return full;
}

export async function listTeamMembersAction(
  accessToken?: string | null,
): Promise<AdminActionResult<AdminTeamMember[]>> {
  const auth = await requireAdminServerAction(accessToken);
  if (!auth.ok) return { ok: false, error: auth.error };

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('employees')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return { ok: false, error: error.message || 'تعذر تحميل الفريق.' };
  }

  const members = (data ?? []).map((row) => {
    const mapped = mapEmployeeToAdminUser(row);
    return {
      id: mapped.id,
      full_name: mapped.full_name,
      email: mapped.email,
      is_admin: mapped.is_admin,
      is_suspended: mapped.is_suspended,
      permissions: mapped.permissions,
      created_at: row.created_at ?? null,
    };
  });

  return { ok: true, data: members };
}

export async function createTeamMemberAction(input: {
  full_name: string;
  email: string;
  password: string;
  is_admin?: boolean;
  permissions?: Partial<CrmPermissions>;
  phone_wa?: string | null;
  access_token?: string | null;
}): Promise<AdminActionResult<{ userId: string }>> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const auth = await requireAdminServerAction(input.access_token);
  if (!auth.ok) return { ok: false, error: auth.error };

  const fullName = String(input.full_name ?? '').trim();
  const email = String(input.email ?? '').trim().toLowerCase();
  const password = String(input.password ?? '');
  const isAdmin = Boolean(input.is_admin);
  const permissions = normalizeCrmPermissions(
    isAdmin
      ? Object.fromEntries(CRM_PERMISSION_KEYS.map((k) => [k, true]))
      : { ...DEFAULT_CRM_PERMISSIONS, ...input.permissions },
  );

  if (!fullName || !email || !password) {
    return { ok: false, error: 'الاسم والبريد وكلمة المرور مطلوبة.' };
  }
  if (password.length < 8) {
    return { ok: false, error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' };
  }

  const admin = createSupabaseAdminClient();

  const existingEmployee = await admin
    .from('employees')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existingEmployee.data) {
    return { ok: false, error: duplicateEmailMessage() };
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createErr || !created.user) {
    if (isDuplicateEmailError(createErr?.message)) {
      return { ok: false, error: duplicateEmailMessage() };
    }
    return { ok: false, error: createErr?.message ?? 'تعذر إنشاء المستخدم.' };
  }

  const userId = created.user.id;
  const employeePatch = employeePatchFromAccess({
    is_admin: isAdmin,
    is_suspended: false,
    permissions,
    full_name: fullName,
  });

  const { error: employeeErr } = await insertEmployeeWithFallback(admin, {
    user_id: userId,
    full_name: fullName,
    email,
    phone_wa: input.phone_wa?.trim() || null,
    ...employeePatch,
  });

  if (employeeErr) {
    await admin.auth.admin.deleteUser(userId);
    if (isDuplicateEmailError(employeeErr.message)) {
      return { ok: false, error: duplicateEmailMessage() };
    }
    return { ok: false, error: employeeErr.message || 'تعذر حفظ بيانات الموظف.' };
  }

  revalidatePath('/crm/admin');
  revalidatePath('/crm/team');
  return {
    ok: true,
    message: '✅ تم إنشاء حساب الموظف بنجاح',
    data: { userId },
  };
}

/** Alias requested in spec */
export async function createTeamMember(
  input: Parameters<typeof createTeamMemberAction>[0],
): Promise<AdminActionResult<{ userId: string }>> {
  return createTeamMemberAction(input);
}

export async function updateTeamMemberAction(
  userId: string,
  patch: {
    permissions?: CrmPermissions;
    is_admin?: boolean;
    is_suspended?: boolean;
  },
  accessToken?: string | null,
): Promise<AdminActionResult> {
  const auth = await requireAdminServerAction(accessToken);
  if (!auth.ok) return { ok: false, error: auth.error };

  if (userId === auth.userId) {
    return { ok: false, error: 'لا يمكنك تعديل صلاحيات حسابك من هنا.' };
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const admin = createSupabaseAdminClient();
  const { data: existing, error: fetchErr } = await admin
    .from('employees')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!existing) return { ok: false, error: 'المستخدم غير موجود.' };

  const nextIsAdmin = typeof patch.is_admin === 'boolean' ? patch.is_admin : Boolean(existing.is_admin);
  const nextPermissions = normalizeCrmPermissions(
    nextIsAdmin
      ? Object.fromEntries(CRM_PERMISSION_KEYS.map((k) => [k, true]))
      : patch.permissions ?? existing.permissions,
  );

  const updatePatch = employeePatchFromAccess({
    is_admin: nextIsAdmin,
    is_suspended:
      typeof patch.is_suspended === 'boolean' ? patch.is_suspended : Boolean(existing.is_suspended),
    permissions: nextPermissions,
  });

  const { error: updateErr } = await admin.from('employees').update(updatePatch).eq('user_id', userId);
  if (updateErr) return { ok: false, error: updateErr.message };

  if (typeof patch.is_suspended === 'boolean') {
    await admin.auth.admin.updateUserById(userId, {
      ban_duration: patch.is_suspended ? '876000h' : 'none',
    });
  }

  revalidatePath('/crm/admin');
  return { ok: true, message: 'تم تحديث الصلاحيات.' };
}

export async function suspendTeamMemberAction(
  userId: string,
  accessToken?: string | null,
): Promise<AdminActionResult> {
  return updateTeamMemberAction(userId, { is_suspended: true }, accessToken);
}
