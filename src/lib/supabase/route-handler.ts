import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import {
  accessFromEmployeeRow,
  FULL_CRM_PERMISSIONS,
  type CrmProfileAccess,
  type EmployeeRbacRow,
} from '@/lib/crm-permissions';
import { isEmergencyCrmOwnerBypass } from '@/lib/crm-roles';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/credentials';

export function createSupabaseRouteClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  return { supabase, getResponse: () => response };
}

async function fetchEmployeeByAuth(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  email: string | null,
) {
  const byUserId = await supabase.from('employees').select('*').eq('user_id', userId).maybeSingle();
  if (!byUserId.error && byUserId.data) return byUserId;

  if (email) {
    const byEmail = await supabase.from('employees').select('*').eq('email', email).maybeSingle();
    if (!byEmail.error && byEmail.data) return byEmail;
  }

  return byUserId.error ? byUserId : { data: null, error: null };
}

export async function getAuthenticatedCrmUser(request: NextRequest) {
  const { supabase, getResponse } = createSupabaseRouteClient(request);

  const authorization = request.headers.get('authorization') ?? '';
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';

  // 1) Prefer Authorization Bearer (CRM SPA pattern) — validate via service role
  if (bearer) {
    try {
      const admin = createSupabaseAdminClient();
      const {
        data: { user },
        error,
      } = await admin.auth.getUser(bearer);
      if (!error && user) {
        const normalizedEmail = user.email?.trim().toLowerCase() ?? null;
        if (isEmergencyCrmOwnerBypass(normalizedEmail)) {
          const access: CrmProfileAccess = {
            is_admin: true,
            is_expert: false,
            is_suspended: false,
            permissions: { ...FULL_CRM_PERMISSIONS },
          };
          return { user, access, supabase, getResponse, employeeRow: null };
        }

        let employeeResult = await admin
          .from('employees')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!employeeResult.data && normalizedEmail) {
          employeeResult = await admin
            .from('employees')
            .select('*')
            .eq('email', normalizedEmail)
            .maybeSingle();
        }
        const employeeRow = (employeeResult.data ?? null) as EmployeeRbacRow | null;
        const access: CrmProfileAccess = accessFromEmployeeRow(employeeRow, user.email);
        return { user, access, supabase, getResponse, employeeRow };
      }
    } catch (err) {
      console.warn('[getAuthenticatedCrmUser] bearer auth failed:', err);
    }
  }

  // 2) Cookie session (SSR)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: 'غير مصرح', status: 401 as const, supabase, getResponse };
  }

  const normalizedEmail = user.email?.trim().toLowerCase() ?? null;

  if (isEmergencyCrmOwnerBypass(normalizedEmail)) {
    const access: CrmProfileAccess = {
      is_admin: true,
      is_expert: false,
      is_suspended: false,
      permissions: { ...FULL_CRM_PERMISSIONS },
    };
    return { user, access, supabase, getResponse, employeeRow: null };
  }

  const employeeResult = await fetchEmployeeByAuth(supabase, user.id, normalizedEmail);
  const employeeRow = (employeeResult.data ?? null) as EmployeeRbacRow | null;
  const access: CrmProfileAccess = accessFromEmployeeRow(employeeRow, user.email);

  return { user, access, supabase, getResponse, employeeRow };
}

export async function requireCrmAdmin(request: NextRequest) {
  const result = await getAuthenticatedCrmUser(request);
  if ('error' in result) return result;
  if (!result.access.is_admin || result.access.is_suspended) {
    return { error: 'صلاحيات مدير مطلوبة', status: 403 as const, ...result };
  }
  return result;
}
