'use server';

import { revalidatePath } from 'next/cache';

import {
  DEFAULT_CRM_PERMISSIONS,
  FULL_CRM_PERMISSIONS,
  accessFromEmployeeRow,
  defaultPermissionsForAccountRole,
  employeePatchFromAccess,
  normalizeCrmPermissions,
  permissionsToDbArray,
  type CrmPermissions,
  type EmployeeRbacRow,
} from '@/lib/crm-permissions';
import {
  insertEmployeeWithRbacFallback,
  selectEmployeesWithFallback,
  updateEmployeeWithRbacFallback,
} from '@/lib/employees-rbac-db';
import { EXPERT_DEFAULT_PASSWORD } from '@/lib/expert-auth-constants';
import { provisionExpertAuthAccount } from '@/lib/expert-auth-provision';
import { isEmployeeAdminRole, isEmployeeExpertRole } from '@/lib/crm-roles';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  assertServiceRoleKeyConfigured,
  requireAdminServerAction,
} from '@/lib/supabase/server-action-auth';

/** أدوار إنشاء الحساب من شاشة إدارة الحسابات */
export type AccountCreateRole = 'employee' | 'expert' | 'admin';

export type AccountRow = {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  role: string;
  /** Normalized UI role key */
  role_key: AccountCreateRole;
  is_admin: boolean;
  is_expert: boolean;
  is_suspended: boolean;
  permissions: CrmPermissions;
  created_at: string | null;
};

export type AccountsActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string };

function revalidateAccounts() {
  revalidatePath('/crm/accounts');
  revalidatePath('/crm/admin');
  revalidatePath('/crm/team');
  revalidatePath('/crm', 'layout');
}

function resolveCreatePermissions(
  role: AccountCreateRole,
  raw: Partial<CrmPermissions> | null | undefined,
): CrmPermissions {
  if (role === 'admin') return { ...FULL_CRM_PERMISSIONS };
  if (raw && typeof raw === 'object') {
    return normalizeCrmPermissions({ ...DEFAULT_CRM_PERMISSIONS, ...raw });
  }
  return defaultPermissionsForAccountRole(role);
}

export async function listAccountsAction(
  accessToken?: string | null,
): Promise<AccountsActionResult<AccountRow[]>> {
  const auth = await requireAdminServerAction(accessToken);
  if (!auth.ok) return { ok: false, error: auth.error };

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const admin = createSupabaseAdminClient();
  const listed = await selectEmployeesWithFallback(admin, { orderByCreatedAt: true });
  if (listed.error) {
    return { ok: false, error: listed.error };
  }

  const rawRows = Array.isArray(listed.data) ? listed.data : listed.data ? [listed.data] : [];
  const rows: AccountRow[] = rawRows.map((row) => mapEmployeeToAccountRow(row));

  return { ok: true, data: rows };
}

function mapEmployeeToAccountRow(row: EmployeeRbacRow & { id?: string }): AccountRow {
  const access = accessFromEmployeeRow(row, row.email);
  const role = String(row.role ?? '').trim() || 'Advisor';
  const role_key: AccountCreateRole = access.is_admin
    ? 'admin'
    : access.is_expert
      ? 'expert'
      : 'employee';
  return {
    id: String(row.id ?? ''),
    user_id: String(row.user_id ?? '').trim(),
    full_name: String(row.full_name ?? '').trim() || '—',
    email: row.email ? String(row.email) : null,
    role,
    role_key,
    is_admin: access.is_admin,
    is_expert: access.is_expert,
    is_suspended: access.is_suspended,
    permissions: access.permissions,
    created_at: row.created_at ? String(row.created_at) : null,
  };
}

function normalizeCreateRole(raw: unknown): AccountCreateRole {
  const t = String(raw ?? '').trim().toLowerCase();
  if (t === 'admin') return 'admin';
  if (t === 'expert') return 'expert';
  return 'employee';
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
  const result = await insertEmployeeWithRbacFallback(admin, payload);
  if (result.error) {
    return { data: null, error: { message: result.error } };
  }
  return { data: result.data, error: null };
}

/**
 * إنشاء حساب فريق (موظف / خبير / مدير) — Auth عبر service_role + صف في employees.
 */
export async function createAccountAction(input: {
  full_name: string;
  email: string;
  role: AccountCreateRole;
  phone?: string | null;
  /** Fine-grained CRM access; ignored for admin (full access). */
  permissions?: Partial<CrmPermissions> | null;
  access_token?: string | null;
}): Promise<AccountsActionResult<{ userId: string; defaultPassword: string; role: AccountCreateRole }>> {
  const auth = await requireAdminServerAction(input.access_token);
  if (!auth.ok) return { ok: false, error: auth.error };

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const fullName = String(input.full_name ?? '').trim();
  const email = String(input.email ?? '').trim().toLowerCase();
  const role = normalizeCreateRole(input.role);
  const permissions = resolveCreatePermissions(role, input.permissions);
  const enabledPermissionIds = permissionsToDbArray(permissions);

  if (!fullName) return { ok: false, error: 'الاسم مطلوب.' };
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'بريد إلكتروني صالح مطلوب.' };
  }

  const admin = createSupabaseAdminClient();

  // Experts keep the dedicated provisioner (also syncs experts table)
  if (role === 'expert') {
    const provision = await provisionExpertAuthAccount(admin, {
      email,
      fullName,
      phone: input.phone,
      permissions,
    });
    if (!provision.ok) return { ok: false, error: provision.error };

    const existingExpert = await admin
      .from('experts')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (!existingExpert.data) {
      await admin
        .from('experts')
        .insert({
          name: fullName,
          email,
          phone: input.phone?.trim() || null,
          status: 'active',
        })
        .then(({ error }) => {
          if (error) console.warn('[createAccount] experts insert:', error.message);
        });
    }

    revalidateAccounts();
    return {
      ok: true,
      message: `تم إنشاء حساب الخبير. كلمة المرور الافتراضية: ${EXPERT_DEFAULT_PASSWORD}`,
      data: {
        userId: provision.userId,
        defaultPassword: EXPERT_DEFAULT_PASSWORD,
        role: 'expert',
      },
    };
  }

  const existingEmployee = await admin
    .from('employees')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existingEmployee.data) {
    return { ok: false, error: 'هذا البريد الإلكتروني مسجل مسبقاً.' };
  }

  const isAdmin = role === 'admin';

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: EXPERT_DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
      permissions: enabledPermissionIds,
    },
  });

  if (createErr || !created.user) {
    if (isDuplicateEmailError(createErr?.message)) {
      return { ok: false, error: 'هذا البريد الإلكتروني مسجل مسبقاً.' };
    }
    return { ok: false, error: createErr?.message ?? 'تعذر إنشاء المستخدم.' };
  }

  const userId = created.user.id;
  const employeePatch = employeePatchFromAccess({
    is_admin: isAdmin,
    is_expert: false,
    is_suspended: false,
    permissions,
    full_name: fullName,
  });

  const { error: employeeErr } = await insertEmployeeWithFallback(admin, {
    user_id: userId,
    full_name: fullName,
    email,
    phone_wa: input.phone?.trim() || null,
    ...employeePatch,
  });

  if (employeeErr) {
    await admin.auth.admin.deleteUser(userId);
    if (isDuplicateEmailError(employeeErr.message)) {
      return { ok: false, error: 'هذا البريد الإلكتروني مسجل مسبقاً.' };
    }
    return { ok: false, error: employeeErr.message || 'تعذر حفظ بيانات المستخدم.' };
  }

  revalidateAccounts();
  const roleLabel = isAdmin ? 'المدير' : 'الموظف';
  return {
    ok: true,
    message: `تم إنشاء حساب ${roleLabel}. كلمة المرور الافتراضية: ${EXPERT_DEFAULT_PASSWORD}`,
    data: {
      userId,
      defaultPassword: EXPERT_DEFAULT_PASSWORD,
      role,
    },
  };
}

/** إضافة خبير — توافق خلفي مع الاستدعاءات القديمة */
export async function createExpertAccountAction(input: {
  full_name: string;
  email: string;
  phone?: string | null;
  access_token?: string | null;
}): Promise<AccountsActionResult<{ userId: string; defaultPassword: string }>> {
  const result = await createAccountAction({
    ...input,
    role: 'expert',
  });
  if (!result.ok) return result;
  return {
    ok: true,
    message: result.message,
    data: {
      userId: result.data!.userId,
      defaultPassword: result.data!.defaultPassword,
    },
  };
}

export type BulkExpertSyncStats = {
  scanned: number;
  created: number;
  reused: number;
  failed: number;
  skippedNoEmail: number;
};

/**
 * مؤقت: يولّد حسابات Auth للخبراء الموجودين في `experts` / `employees`
 * بكلمة المرور الافتراضية، ويتخطى من لديهم حساب مسبقاً.
 */
export async function syncOldExpertAccountsAction(
  accessToken?: string | null,
): Promise<AccountsActionResult<BulkExpertSyncStats>> {
  const auth = await requireAdminServerAction(accessToken);
  if (!auth.ok) return { ok: false, error: auth.error };

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const admin = createSupabaseAdminClient();

  const [expertsRes, employeesRes] = await Promise.all([
    admin.from('experts').select('id, name, email, phone'),
    admin
      .from('employees')
      .select('id, full_name, email, phone_wa, role, is_admin')
      .order('created_at', { ascending: false }),
  ]);

  // Continue if one source fails — still sync the other
  if (expertsRes.error) {
    console.warn('[syncOldExpertAccounts] experts:', expertsRes.error.message);
  }
  if (employeesRes.error) {
    console.warn('[syncOldExpertAccounts] employees:', employeesRes.error.message);
  }

  if (expertsRes.error && employeesRes.error) {
    return {
      ok: false,
      error:
        expertsRes.error.message ||
        employeesRes.error.message ||
        'تعذر قراءة سجلات الخبراء.',
    };
  }

  type Candidate = { email: string; fullName: string; phone?: string | null };
  const byEmail = new Map<string, Candidate>();

  for (const row of expertsRes.data ?? []) {
    const email = String(row.email ?? '')
      .trim()
      .toLowerCase();
    if (!email || !email.includes('@')) continue;
    const fullName = String(row.name ?? '').trim() || 'خبير وجهات';
    if (!byEmail.has(email)) {
      byEmail.set(email, {
        email,
        fullName,
        phone: row.phone ? String(row.phone) : null,
      });
    }
  }

  for (const row of employeesRes.data ?? []) {
    const role = String(row.role ?? '');
    if (Boolean(row.is_admin) || isEmployeeAdminRole(role)) continue;
    if (!isEmployeeExpertRole(role)) continue;

    const email = String(row.email ?? '')
      .trim()
      .toLowerCase();
    if (!email || !email.includes('@')) continue;
    const existing = byEmail.get(email);
    const fullName = String(row.full_name ?? '').trim() || existing?.fullName || 'خبير وجهات';
    byEmail.set(email, {
      email,
      fullName,
      phone: row.phone_wa ? String(row.phone_wa) : existing?.phone ?? null,
    });
  }

  const stats: BulkExpertSyncStats = {
    scanned: byEmail.size,
    created: 0,
    reused: 0,
    failed: 0,
    skippedNoEmail: 0,
  };

  // Count experts/employees missing usable email (for feedback only)
  const expertNoEmail = (expertsRes.data ?? []).filter((r) => {
    const e = String(r.email ?? '')
      .trim()
      .toLowerCase();
    return !e || !e.includes('@');
  }).length;
  stats.skippedNoEmail = expertNoEmail;

  for (const candidate of byEmail.values()) {
    try {
      const result = await provisionExpertAuthAccount(admin, {
        email: candidate.email,
        fullName: candidate.fullName,
        phone: candidate.phone,
      });
      if (!result.ok) {
        stats.failed += 1;
        console.warn('[syncOldExpertAccounts]', candidate.email, result.error);
        continue;
      }
      if (result.createdAuthUser) stats.created += 1;
      else stats.reused += 1;
    } catch (err) {
      stats.failed += 1;
      console.error('[syncOldExpertAccounts]', candidate.email, err);
    }
  }

  revalidateAccounts();

  const message = [
    `تمت المزامنة: ${stats.created} حساب جديد`,
    `${stats.reused} موجود مسبقاً`,
    stats.failed > 0 ? `${stats.failed} فشل` : null,
    stats.skippedNoEmail > 0 ? `${stats.skippedNoEmail} بدون بريد` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return { ok: true, message, data: stats };
}

/** حذف نهائي من employees + Supabase Auth */
export async function deleteAccountAction(
  userId: string,
  accessToken?: string | null,
): Promise<AccountsActionResult> {
  const auth = await requireAdminServerAction(accessToken);
  if (!auth.ok) return { ok: false, error: auth.error };

  const key = String(userId ?? '').trim();
  if (!key) return { ok: false, error: 'معرّف المستخدم غير صالح.' };
  if (key === auth.userId) {
    return { ok: false, error: 'لا يمكنك حذف حسابك الحالي.' };
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const admin = createSupabaseAdminClient();

  const { data: target } = await admin
    .from('employees')
    .select('is_admin, role, email')
    .eq('user_id', key)
    .maybeSingle();

  if (!target) {
    return { ok: false, error: 'الحساب غير موجود في جدول الموظفين.' };
  }

  const targetIsAdmin =
    Boolean(target.is_admin) || isEmployeeAdminRole(String(target.role ?? ''));
  if (targetIsAdmin) {
    const { data: admins } = await admin
      .from('employees')
      .select('user_id')
      .eq('is_admin', true)
      .eq('is_suspended', false);
    if ((admins?.length ?? 0) <= 1) {
      return { ok: false, error: 'لا يمكن حذف آخر مدير في النظام.' };
    }
  }

  const { error: deleteEmpErr } = await admin.from('employees').delete().eq('user_id', key);
  if (deleteEmpErr) {
    return { ok: false, error: deleteEmpErr.message || 'تعذر حذف سجل الموظف.' };
  }

  const { error: deleteAuthErr } = await admin.auth.admin.deleteUser(key);
  if (deleteAuthErr) {
    console.error('[deleteAccountAction] auth delete:', deleteAuthErr);
    return {
      ok: false,
      error: `حُذف من الموظفين لكن فشل حذف Auth: ${deleteAuthErr.message}`,
    };
  }

  revalidateAccounts();
  return { ok: true, message: 'تم حذف الحساب نهائياً من النظام وAuth.' };
}

/**
 * تحديث اسم / دور / صلاحيات / حالة حساب موجود في employees.
 */
export async function updateAccountAction(input: {
  user_id: string;
  full_name: string;
  role: AccountCreateRole;
  permissions?: Partial<CrmPermissions> | null;
  is_suspended?: boolean;
  access_token?: string | null;
}): Promise<AccountsActionResult> {
  const auth = await requireAdminServerAction(input.access_token);
  if (!auth.ok) return { ok: false, error: auth.error };

  const userId = String(input.user_id ?? '').trim();
  if (!userId) return { ok: false, error: 'معرّف المستخدم غير صالح.' };

  const fullName = String(input.full_name ?? '').trim();
  if (!fullName) return { ok: false, error: 'الاسم مطلوب.' };

  const role = normalizeCreateRole(input.role);
  const isAdmin = role === 'admin';
  const isExpert = role === 'expert';
  const permissions = resolveCreatePermissions(role, input.permissions);
  const isSuspended = Boolean(input.is_suspended);

  if (userId === auth.userId) {
    if (!isAdmin) {
      return { ok: false, error: 'لا يمكنك إزالة صلاحيات المدير من حسابك الحالي.' };
    }
    if (isSuspended) {
      return { ok: false, error: 'لا يمكنك إيقاف حسابك الحالي.' };
    }
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const admin = createSupabaseAdminClient();
  const { data: existing, error: fetchErr } = await admin
    .from('employees')
    .select('id, user_id, is_admin, role, is_suspended, email')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!existing) return { ok: false, error: 'الحساب غير موجود.' };

  const wasAdmin =
    Boolean(existing.is_admin) || isEmployeeAdminRole(String(existing.role ?? ''));
  if (wasAdmin && !isAdmin) {
    const { data: admins } = await admin
      .from('employees')
      .select('user_id')
      .eq('is_admin', true)
      .eq('is_suspended', false);
    const otherAdmins = (admins ?? []).filter((a) => String(a.user_id) !== userId);
    if (otherAdmins.length === 0) {
      return { ok: false, error: 'لا يمكن إزالة آخر مدير في النظام.' };
    }
  }

  const employeePatch = employeePatchFromAccess({
    is_admin: isAdmin,
    is_expert: isExpert,
    is_suspended: isSuspended,
    permissions,
    full_name: fullName,
  });

  const updated = await updateEmployeeWithRbacFallback(
    admin,
    { column: 'user_id', value: userId },
    employeePatch,
  );

  if (updated.error) {
    return { ok: false, error: updated.error || 'تعذر تحديث الحساب.' };
  }

  // Sync Auth metadata + ban status
  try {
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        full_name: fullName,
        role,
        permissions: permissionsToDbArray(permissions),
      },
      ban_duration: isSuspended ? '876000h' : 'none',
    });
  } catch (err) {
    console.warn('[updateAccountAction] auth metadata sync failed:', err);
  }

  revalidateAccounts();
  return { ok: true, message: 'تم تحديث بيانات وصلاحيات المستخدم بنجاح!' };
}
