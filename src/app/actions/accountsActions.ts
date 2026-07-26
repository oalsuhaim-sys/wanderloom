'use server';

import { revalidatePath } from 'next/cache';

import { EXPERT_DEFAULT_PASSWORD } from '@/lib/expert-auth-constants';
import { provisionExpertAuthAccount } from '@/lib/expert-auth-provision';
import { isEmployeeAdminRole, isEmployeeExpertRole } from '@/lib/crm-roles';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  assertServiceRoleKeyConfigured,
  requireAdminServerAction,
} from '@/lib/supabase/server-action-auth';

export type AccountRow = {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  role: string;
  is_admin: boolean;
  is_expert: boolean;
  is_suspended: boolean;
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

export async function listAccountsAction(
  accessToken?: string | null,
): Promise<AccountsActionResult<AccountRow[]>> {
  const auth = await requireAdminServerAction(accessToken);
  if (!auth.ok) return { ok: false, error: auth.error };

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('employees')
    .select('id, user_id, full_name, email, role, is_admin, is_suspended, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return { ok: false, error: error.message || 'تعذر تحميل الحسابات.' };
  }

  const rows: AccountRow[] = (data ?? []).map((row) => {
    const role = String(row.role ?? '').trim() || 'Advisor';
    const isAdmin = Boolean(row.is_admin) || isEmployeeAdminRole(role);
    return {
      id: String(row.id),
      user_id: String(row.user_id ?? '').trim(),
      full_name: String(row.full_name ?? '').trim() || '—',
      email: row.email ? String(row.email) : null,
      role,
      is_admin: isAdmin,
      is_expert: !isAdmin && isEmployeeExpertRole(role),
      is_suspended: Boolean(row.is_suspended),
      created_at: row.created_at ? String(row.created_at) : null,
    };
  });

  return { ok: true, data: rows };
}

/** إضافة خبير — Auth عبر service_role + employees.role=Expert */
export async function createExpertAccountAction(input: {
  full_name: string;
  email: string;
  phone?: string | null;
  access_token?: string | null;
}): Promise<AccountsActionResult<{ userId: string; defaultPassword: string }>> {
  const auth = await requireAdminServerAction(input.access_token);
  if (!auth.ok) return { ok: false, error: auth.error };

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const fullName = String(input.full_name ?? '').trim();
  const email = String(input.email ?? '').trim().toLowerCase();
  if (!fullName) return { ok: false, error: 'اسم الخبير مطلوب.' };
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'بريد إلكتروني صالح مطلوب.' };
  }

  const admin = createSupabaseAdminClient();
  const provision = await provisionExpertAuthAccount(admin, {
    email,
    fullName,
    phone: input.phone,
  });

  if (!provision.ok) {
    return { ok: false, error: provision.error };
  }

  // Best-effort: keep partners directory in sync when email is new
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
        if (error) console.warn('[createExpertAccount] experts insert:', error.message);
      });
  }

  revalidateAccounts();
  return {
    ok: true,
    message: `تم إنشاء حساب الخبير. كلمة المرور الافتراضية: ${EXPERT_DEFAULT_PASSWORD}`,
    data: {
      userId: provision.userId,
      defaultPassword: EXPERT_DEFAULT_PASSWORD,
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
