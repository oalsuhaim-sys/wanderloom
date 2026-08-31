'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@supabase/ssr';

import { accessFromEmployeeRow } from '@/lib/crm-permissions';
import { isEmergencyCrmOwnerBypass } from '@/lib/crm-roles';
import { duplicateItineraryDeep } from '@/lib/itinerary-duplicate';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/credentials';
import {
  assertServiceRoleKeyConfigured,
  requireAdminServerAction,
} from '@/lib/supabase/server-action-auth';

export type DuplicateItineraryActionResult =
  | { ok: true; newId: string | number; title: string }
  | { ok: false; error: string };

async function requireCrmStaff(accessToken?: string | null) {
  const adminAuth = await requireAdminServerAction(accessToken);
  if (adminAuth.ok) {
    return { ok: true as const, userId: adminAuth.userId, email: adminAuth.email };
  }

  const token = String(accessToken ?? '').trim();
  let userId: string | null = null;
  let email: string | null = null;

  if (token) {
    try {
      const admin = createSupabaseAdminClient();
      const { data } = await admin.auth.getUser(token);
      userId = data.user?.id ?? null;
      email = data.user?.email?.trim().toLowerCase() ?? null;
    } catch {
      /* cookies fallback */
    }
  }

  if (!userId) {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          /* read-only */
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
    email = user?.email?.trim().toLowerCase() ?? null;
  }

  if (!userId) {
    return { ok: false as const, error: adminAuth.error || 'غير مصرح — يرجى تسجيل الدخول.' };
  }

  if (isEmergencyCrmOwnerBypass(email)) {
    return { ok: true as const, userId, email };
  }

  const admin = createSupabaseAdminClient();
  let emp = await admin.from('employees').select('*').eq('user_id', userId).maybeSingle();
  if (!emp.data && email) {
    emp = await admin.from('employees').select('*').eq('email', email).maybeSingle();
  }
  const access = accessFromEmployeeRow(emp.data, email);
  if (!emp.data || access.is_suspended) {
    return { ok: false as const, error: 'صلاحية الموظفين مطلوبة لاستنساخ المسار.' };
  }

  return { ok: true as const, userId, email };
}

/** استنساخ عميق للمسار (أيام + أماكن عبر days_data والجداول العلائقية إن وُجدت) */
export async function duplicateItineraryAction(
  originalId: string | number,
  accessToken?: string | null,
): Promise<DuplicateItineraryActionResult> {
  const auth = await requireCrmStaff(accessToken);
  if (!auth.ok) return { ok: false, error: auth.error };

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const admin = createSupabaseAdminClient();
  const result = await duplicateItineraryDeep(admin, originalId);

  if (result.ok) {
    revalidatePath('/crm/itineraries');
    revalidatePath(`/crm/itineraries/${result.newId}/edit`);
  }

  return result;
}
