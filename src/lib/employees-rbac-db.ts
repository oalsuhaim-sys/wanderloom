import type { SupabaseClient } from '@supabase/supabase-js';

import {
  EMPLOYEE_MINIMAL_SELECT,
  EMPLOYEE_RBAC_SELECT,
  LEGACY_ACCESS_KEYS,
  ensurePermissionsDbArray,
  type EmployeeRbacRow,
} from '@/lib/crm-permissions';

/** Progressive selects — skip `permissions` / can_access_* when migration not applied */
export const EMPLOYEE_SELECT_ATTEMPTS = [
  EMPLOYEE_RBAC_SELECT,
  'id, user_id, full_name, role, job_title, email, is_admin, is_suspended, can_access_dashboard, can_access_clients, can_access_itineraries, can_access_marketing, can_access_payments, created_at',
  'id, user_id, full_name, role, job_title, email, is_admin, is_suspended, permissions, created_at',
  'id, user_id, full_name, role, job_title, email, is_admin, is_suspended, created_at',
  EMPLOYEE_MINIMAL_SELECT,
  'id, user_id, full_name, email, role, created_at',
  'id, user_id, full_name, email, role',
] as const;

export function isMissingEmployeeColumnError(message: string | undefined): boolean {
  return /permissions|can_access_|is_admin|is_suspended|column|schema cache|does not exist|PGRST204/i.test(
    String(message ?? ''),
  );
}

export function isMissingPermissionsColumnError(message: string | undefined): boolean {
  return /permissions/i.test(String(message ?? '')) &&
    /column|schema cache|does not exist|PGRST204/i.test(String(message ?? ''));
}

/** Force `permissions` to a JSON array before any employees write. */
export function coerceEmployeePermissionsPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (!('permissions' in payload)) return payload;
  return {
    ...payload,
    permissions: ensurePermissionsDbArray(payload.permissions),
  };
}

/** Remove optional RBAC fields that may not exist yet on `employees`. */
export function stripOptionalEmployeeRbacFields(
  payload: Record<string, unknown>,
  opts?: { dropPermissionsOnly?: boolean },
): Record<string, unknown> {
  const next = { ...payload };
  delete next.permissions;
  if (!opts?.dropPermissionsOnly) {
    for (const key of LEGACY_ACCESS_KEYS) {
      delete next[key];
    }
    delete next.is_admin;
    delete next.is_suspended;
  }
  return next;
}

type EmpClient = SupabaseClient;

/**
 * Fetch employees with progressive column fallback when `permissions` (or other RBAC cols) are missing.
 */
export async function selectEmployeesWithFallback(
  client: EmpClient,
  opts?: {
    orderByCreatedAt?: boolean;
    eq?: { column: string; value: string };
    maybeSingle?: boolean;
  },
): Promise<{ data: EmployeeRbacRow[] | EmployeeRbacRow | null; error: string | null }> {
  let lastError = '';

  for (const select of EMPLOYEE_SELECT_ATTEMPTS) {
    let query = client.from('employees').select(select);
    if (opts?.eq) {
      query = query.eq(opts.eq.column, opts.eq.value);
    }
    if (opts?.orderByCreatedAt) {
      query = query.order('created_at', { ascending: false });
    }

    if (opts?.maybeSingle) {
      const result = await query.maybeSingle();
      if (!result.error) {
        return { data: (result.data as EmployeeRbacRow | null) ?? null, error: null };
      }
      lastError = result.error.message || 'select failed';
      if (!isMissingEmployeeColumnError(lastError)) {
        return { data: null, error: lastError };
      }
      continue;
    }

    const result = await query;
    if (!result.error) {
      return { data: (result.data ?? []) as EmployeeRbacRow[], error: null };
    }
    lastError = result.error.message || 'select failed';
    if (!isMissingEmployeeColumnError(lastError)) {
      return { data: null, error: lastError };
    }
  }

  return { data: null, error: lastError || 'تعذر قراءة جدول الموظفين.' };
}

/**
 * Update employees row — if `permissions` (or other RBAC columns) are missing, retry with stripped payload.
 */
export async function updateEmployeeWithRbacFallback(
  client: EmpClient,
  match: { column: string; value: string },
  payload: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const attempts: Record<string, unknown>[] = [
    payload,
    stripOptionalEmployeeRbacFields(payload, { dropPermissionsOnly: true }),
    stripOptionalEmployeeRbacFields(payload),
    {
      full_name: payload.full_name,
      role: payload.role,
      job_title: payload.job_title,
      ...(payload.email != null ? { email: payload.email } : {}),
      ...(payload.phone_wa != null ? { phone_wa: payload.phone_wa } : {}),
    },
  ];

  let lastError = '';
  for (const attempt of attempts) {
    const clean = Object.fromEntries(
      Object.entries(coerceEmployeePermissionsPayload(attempt)).filter(
        ([, v]) => v !== undefined,
      ),
    );
    if (Object.keys(clean).length === 0) continue;

    const { error } = await client.from('employees').update(clean).eq(match.column, match.value);
    if (!error) return { error: null };

    lastError = error.message || 'update failed';
    if (!isMissingEmployeeColumnError(lastError)) {
      return { error: lastError };
    }
  }

  return { error: lastError || 'تعذر تحديث الموظف.' };
}

/**
 * Insert employees row with the same RBAC column fallbacks.
 */
export async function insertEmployeeWithRbacFallback(
  client: EmpClient,
  payload: Record<string, unknown>,
): Promise<{ data: { id: string } | null; error: string | null }> {
  const attempts: Record<string, unknown>[] = [
    payload,
    stripOptionalEmployeeRbacFields(payload, { dropPermissionsOnly: true }),
    stripOptionalEmployeeRbacFields(payload),
    {
      user_id: payload.user_id,
      full_name: payload.full_name,
      email: payload.email,
      role: payload.role,
      job_title: payload.job_title,
      ...(payload.phone_wa != null ? { phone_wa: payload.phone_wa } : {}),
    },
  ];

  let lastError = '';
  for (const attempt of attempts) {
    const clean = Object.fromEntries(
      Object.entries(coerceEmployeePermissionsPayload(attempt)).filter(
        ([, v]) => v !== undefined,
      ),
    );
    const { data, error } = await client.from('employees').insert(clean).select('id').single();
    if (!error && data?.id) {
      return { data: { id: String(data.id) }, error: null };
    }
    lastError = error?.message || 'insert failed';
    if (error && !isMissingEmployeeColumnError(lastError)) {
      return { data: null, error: lastError };
    }
  }

  return { data: null, error: lastError || 'تعذر إدراج الموظف.' };
}
