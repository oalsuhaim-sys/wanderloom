import 'server-only';

import {
  EXPERT_CRM_PERMISSIONS,
  CRM_PERMISSION_KEYS,
} from '@/lib/crm-permissions';
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
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const permissions = { ...EXPERT_CRM_PERMISSIONS };
  const permissionColumns = Object.fromEntries(
    CRM_PERMISSION_KEYS.map((key) => [key, permissions[key]]),
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
    permissions,
    ...permissionColumns,
  };

  const existing = await admin
    .from('employees')
    .select('id, user_id')
    .eq('email', input.email)
    .maybeSingle();

  if (existing.data?.id) {
    const { error } = await admin
      .from('employees')
      .update({
        user_id: input.userId,
        full_name: input.fullName,
        role: 'Expert',
        job_title: 'Destination Expert',
        is_admin: false,
        permissions,
        ...permissionColumns,
        ...(input.phone?.trim() ? { phone_wa: input.phone.trim() } : {}),
      })
      .eq('id', existing.data.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const byUser = await admin
    .from('employees')
    .select('id')
    .eq('user_id', input.userId)
    .maybeSingle();

  if (byUser.data?.id) {
    const { error } = await admin
      .from('employees')
      .update({
        full_name: input.fullName,
        email: input.email,
        role: 'Expert',
        job_title: 'Destination Expert',
        is_admin: false,
        permissions,
        ...permissionColumns,
      })
      .eq('id', byUser.data.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const insert = await admin.from('employees').insert(payload).select('id').single();
  if (!insert.error) return { ok: true };

  if (/column|schema cache|does not exist/i.test(insert.error.message ?? '')) {
    const minimal = await admin
      .from('employees')
      .insert({
        user_id: input.userId,
        full_name: input.fullName,
        email: input.email,
        role: 'Expert',
        job_title: 'Destination Expert',
      })
      .select('id')
      .single();
    if (minimal.error) return { ok: false, error: minimal.error.message };
    return { ok: true };
  }

  return { ok: false, error: insert.error.message || 'تعذر حفظ موظف الخبير.' };
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
  },
): Promise<ProvisionExpertAuthResult> {
  const email = String(input.email ?? '').trim().toLowerCase();
  const fullName = String(input.fullName ?? '').trim() || 'خبير وجهات';
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'بريد الخبير مطلوب لإنشاء حساب الدخول.' };
  }

  let userId: string | null = null;
  let createdAuthUser = false;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: EXPERT_DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: 'expert',
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
}): Promise<ProvisionExpertAuthResult> {
  const admin = createSupabaseAdminClient();
  return provisionExpertAuthAccount(admin, input);
}
