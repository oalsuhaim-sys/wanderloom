import 'server-only';

import {
  EXPERT_CRM_PERMISSIONS,
  LEGACY_ACCESS_KEYS,
  normalizeCrmPermissions,
  permissionsToDbArray,
  type CrmPermissions,
} from '@/lib/crm-permissions';
import {
  insertEmployeeWithRbacFallback,
  updateEmployeeWithRbacFallback,
} from '@/lib/employees-rbac-db';
import { EXPERT_DEFAULT_PASSWORD } from '@/lib/expert-auth-constants';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export { EXPERT_DEFAULT_PASSWORD } from '@/lib/expert-auth-constants';

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type ProvisionExpertAuthResult =
  | { ok: true; userId: string; createdAuthUser: boolean; reusedExisting: boolean }
  | { ok: false; error: string };

function isDuplicateAuthError(message: string | undefined): boolean {
  const msg = String(message ?? '').toLowerCase();
  return (
    msg.includes('already') ||
    msg.includes('registered') ||
    msg.includes('exists') ||
    msg.includes('duplicate') ||
    msg.includes('unique')
  );
}

async function findAuthUserIdByEmail(
  admin: AdminClient,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  // Paginate lightly — expert emails are rare; prefer exact match if API supports it
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.warn('[expert-auth] listUsers:', error.message);
      return null;
    }
    const hit = (data.users ?? []).find(
      (u) => String(u.email ?? '').trim().toLowerCase() === normalized,
    );
    if (hit?.id) return hit.id;
    if ((data.users ?? []).length < 200) break;
  }
  return null;
}

async function upsertExpertEmployee(
  admin: AdminClient,
  input: {
    userId: string;
    fullName: string;
    email: string;
    phone?: string | null;
    permissions?: CrmPermissions;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const permissions = input.permissions
    ? normalizeCrmPermissions(input.permissions)
    : { ...EXPERT_CRM_PERMISSIONS };
  const permissionsArray = permissionsToDbArray(permissions);
  const permissionColumns = Object.fromEntries(
    LEGACY_ACCESS_KEYS.map((key) => [key, permissions[key]]),
  );

  const payload: Record<string, unknown> = {
    user_id: input.userId,
    full_name: input.fullName,
    email: input.email,
    phone_wa: input.phone?.trim() || null,
    role: 'Expert',
    job_title: 'Destination Expert',
    is_admin: false,
    is_suspended: false,
    permissions: permissionsArray,
    ...permissionColumns,
  };

  const existing = await admin
    .from('employees')
    .select('id, user_id')
    .eq('email', input.email)
    .maybeSingle();

  if (existing.data?.id) {
    const updated = await updateEmployeeWithRbacFallback(
      admin,
      { column: 'id', value: String(existing.data.id) },
      {
        user_id: input.userId,
        full_name: input.fullName,
        role: 'Expert',
        job_title: 'Destination Expert',
        is_admin: false,
        permissions: permissionsArray,
        ...permissionColumns,
        ...(input.phone?.trim() ? { phone_wa: input.phone.trim() } : {}),
      },
    );
    if (updated.error) return { ok: false, error: updated.error };
    return { ok: true };
  }

  const byUser = await admin
    .from('employees')
    .select('id')
    .eq('user_id', input.userId)
    .maybeSingle();

  if (byUser.data?.id) {
    const updated = await updateEmployeeWithRbacFallback(
      admin,
      { column: 'id', value: String(byUser.data.id) },
      {
        full_name: input.fullName,
        email: input.email,
        role: 'Expert',
        job_title: 'Destination Expert',
        is_admin: false,
        permissions: permissionsArray,
        ...permissionColumns,
      },
    );
    if (updated.error) return { ok: false, error: updated.error };
    return { ok: true };
  }

  const inserted = await insertEmployeeWithRbacFallback(admin, payload);
  if (inserted.error) return { ok: false, error: inserted.error };
  return { ok: true };
}

/**
 * Creates (or reuses) a Supabase Auth user for an expert and links an `employees`
 * row with role=Expert. Uses service_role only — never client signUp.
 */
export async function provisionExpertAuthAccount(
  admin: AdminClient,
  input: {
    email?: string | null;
    fullName?: string | null;
    phone?: string | null;
    permissions?: CrmPermissions | null;
  },
): Promise<ProvisionExpertAuthResult> {
  const email = String(input.email ?? '').trim().toLowerCase();
  const fullName = String(input.fullName ?? '').trim() || 'خبير وجهات';
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'بريد الخبير مطلوب لإنشاء حساب الدخول.' };
  }

  const permissions = input.permissions
    ? normalizeCrmPermissions(input.permissions)
    : { ...EXPERT_CRM_PERMISSIONS };
  const enabledPermissionIds = permissionsToDbArray(permissions);

  let userId: string | null = null;
  let createdAuthUser = false;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: EXPERT_DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: 'expert',
      permissions: enabledPermissionIds,
    },
  });

  if (!createErr && created.user?.id) {
    userId = created.user.id;
    createdAuthUser = true;
  } else if (isDuplicateAuthError(createErr?.message)) {
    userId = await findAuthUserIdByEmail(admin, email);
    if (!userId) {
      return {
        ok: false,
        error: 'البريد مسجّل مسبقاً لكن تعذر استرجاع معرّف المستخدم.',
      };
    }
    await admin.auth.admin
      .updateUserById(userId, {
        user_metadata: {
          full_name: fullName,
          role: 'expert',
          permissions: enabledPermissionIds,
        },
      })
      .catch(() => undefined);
  } else {
    return {
      ok: false,
      error: createErr?.message || 'تعذر إنشاء حساب Auth للخبير.',
    };
  }

  const employee = await upsertExpertEmployee(admin, {
    userId,
    fullName,
    email,
    phone: input.phone,
    permissions,
  });

  if (!employee.ok) {
    if (createdAuthUser) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
    return { ok: false, error: employee.error };
  }

  return {
    ok: true,
    userId,
    createdAuthUser,
    reusedExisting: !createdAuthUser,
  };
}

/** Convenience when caller already has createSupabaseAdminClient singleton */
export async function provisionExpertAuthAccountStandalone(input: {
  email?: string | null;
  fullName?: string | null;
  phone?: string | null;
  permissions?: CrmPermissions | null;
}): Promise<ProvisionExpertAuthResult> {
  const admin = createSupabaseAdminClient();
  return provisionExpertAuthAccount(admin, input);
}
