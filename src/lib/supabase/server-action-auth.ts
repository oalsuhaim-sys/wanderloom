import { cookies } from 'next/headers';

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

import {
  accessFromEmployeeRow,
  FULL_CRM_PERMISSIONS,
  type CrmProfileAccess,
} from '@/lib/crm-permissions';
import { selectEmployeesWithFallback } from '@/lib/employees-rbac-db';
import { isEmergencyCrmOwnerBypass } from '@/lib/crm-roles';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/credentials';
import { resolveSupabaseServiceRoleKey } from '@/lib/supabase/env';

export type AdminServerAuthResult =
  | { ok: true; userId: string; email: string | null; access: CrmProfileAccess }
  | { ok: false; error: string };

async function resolveUserFromAccessToken(accessToken: string | null | undefined) {
  const token = String(accessToken ?? '').trim();
  if (!token) return null;

  const serviceKey = resolveSupabaseServiceRoleKey();
  if (serviceKey) {
    try {
      const admin = createSupabaseAdminClient();
      const {
        data: { user },
        error,
      } = await admin.auth.getUser(token);
      if (!error && user) return user;
    } catch (err) {
      console.error('[requireAdmin] service role JWT validation failed:', err);
    }
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);

  if (error || !user) return null;
  return user;
}

async function resolveUserFromCookies() {
  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* read-only outside Server Action */
        }
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) return session.user;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

async function resolveEmployeeAccess(email: string | null, userId: string) {
  try {
    const admin = createSupabaseAdminClient();
    let employeeResult = await selectEmployeesWithFallback(admin, {
      eq: { column: 'user_id', value: userId },
      maybeSingle: true,
    });

    if ((!employeeResult.data || Array.isArray(employeeResult.data)) && email) {
      employeeResult = await selectEmployeesWithFallback(admin, {
        eq: { column: 'email', value: email },
        maybeSingle: true,
      });
    }

    const row =
      employeeResult.data && !Array.isArray(employeeResult.data) ? employeeResult.data : null;
    return accessFromEmployeeRow(row, email);
  } catch (err) {
    console.error('[requireAdmin] employees lookup failed:', err);
    return accessFromEmployeeRow(null, email);
  }
}

export async function requireAdminServerAction(
  accessToken?: string | null,
): Promise<AdminServerAuthResult> {
  const user =
    (await resolveUserFromAccessToken(accessToken)) ?? (await resolveUserFromCookies());

  if (!user) {
    return {
      ok: false,
      error: 'غير مصرح — يرجى تسجيل الدخول. (أعد تحميل الصفحة ثم حاول مرة أخرى)',
    };
  }

  const email = user.email?.trim().toLowerCase() ?? null;

  if (isEmergencyCrmOwnerBypass(email)) {
    return {
      ok: true,
      userId: user.id,
      email,
      access: {
        is_admin: true,
        is_expert: false,
        is_suspended: false,
        permissions: { ...FULL_CRM_PERMISSIONS },
      },
    };
  }

  const access = await resolveEmployeeAccess(email, user.id);
  if (!access.is_admin || access.is_suspended) {
    return { ok: false, error: 'صلاحيات مدير مطلوبة.' };
  }

  return { ok: true, userId: user.id, email, access };
}

/** أي موظف CRM مسجّل (غير معلّق) — لتصفية البيانات حسب الصلاحيات */
export async function requireCrmServerAction(
  accessToken?: string | null,
): Promise<AdminServerAuthResult> {
  const user =
    (await resolveUserFromAccessToken(accessToken)) ?? (await resolveUserFromCookies());

  if (!user) {
    return {
      ok: false,
      error: 'غير مصرح — يرجى تسجيل الدخول. (أعد تحميل الصفحة ثم حاول مرة أخرى)',
    };
  }

  const email = user.email?.trim().toLowerCase() ?? null;

  if (isEmergencyCrmOwnerBypass(email)) {
    return {
      ok: true,
      userId: user.id,
      email,
      access: {
        is_admin: true,
        is_expert: false,
        is_suspended: false,
        permissions: { ...FULL_CRM_PERMISSIONS },
      },
    };
  }

  const access = await resolveEmployeeAccess(email, user.id);
  if (access.is_suspended) {
    return { ok: false, error: 'الحساب معلّق.' };
  }

  return { ok: true, userId: user.id, email, access };
}

export function assertServiceRoleKeyConfigured(): string | null {
  const key = resolveSupabaseServiceRoleKey();
  if (!key) {
    return 'مفتاح SUPABASE_SERVICE_ROLE_KEY (أو SUPABASE_SERVICE_KEY) غير مضبوط على الخادم — أضفه في Vercel ثم أعد النشر.';
  }
  return null;
}
