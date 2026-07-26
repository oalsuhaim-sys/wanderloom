'use server';

import { revalidatePath } from 'next/cache';

import { CLIENT_LIST_SELECT, normalizeVipClient, type VipClientProfile } from '@/lib/clientsTravelDna';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

export type ClientDirectoryFetchResult =
  | {
      ok: true;
      rows: VipClientProfile[];
    }
  | { ok: false; error: string };

export type DeleteClientActionResult =
  | { ok: true; deletedId: string }
  | { ok: false; error: string };

function coerceClientDbId(raw: string | number): string | number {
  const s = String(raw ?? '').trim();
  if (!s) return s;
  const n = Number(s);
  // Prefer numeric id for bigint columns when the string is purely numeric
  if (Number.isFinite(n) && String(n) === s) return n;
  return s;
}

function formatDeleteError(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}): string {
  const msg = (error.message ?? '').toLowerCase();
  if (
    msg.includes('foreign key') ||
    msg.includes('violates') ||
    msg.includes('constraint') ||
    msg.includes('23503') ||
    error.code === '23503'
  ) {
    return 'عذراً، لا يمكن حذف هذا العميل لوجود عروض أسعار أو رحلات مرتبطة به.';
  }
  const parts = [
    error.message?.trim(),
    error.details?.trim(),
    error.hint?.trim(),
    error.code ? `code=${error.code}` : '',
  ].filter(Boolean);
  return parts.join(' | ') || 'تعذر حذف العميل من قاعدة البيانات.';
}

/**
 * Hard-delete a client via service_role (bypasses RLS).
 * Confirms a row was actually deleted before reporting success — no silent no-ops.
 */
export async function deleteClientAction(
  clientId: string | number,
): Promise<DeleteClientActionResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return { ok: false, error: serviceKeyError };
  }

  const raw = String(clientId ?? '').trim();
  if (!raw) {
    return { ok: false, error: 'معرّف العميل غير صالح.' };
  }

  const admin = createSupabaseAdminClient();
  const dbId = coerceClientDbId(raw);

  try {
    let { data, error } = await admin
      .from('clients')
      .delete()
      .eq('id', dbId)
      .select('id');

    // Retry alternate id typing if zero rows (bigint vs text mismatch)
    if (!error && (!data || data.length === 0) && typeof dbId === 'number') {
      const retry = await admin
        .from('clients')
        .delete()
        .eq('id', String(dbId))
        .select('id');
      data = retry.data;
      error = retry.error;
    } else if (!error && (!data || data.length === 0) && typeof dbId === 'string') {
      const asNum = Number(dbId);
      if (Number.isFinite(asNum)) {
        const retry = await admin
          .from('clients')
          .delete()
          .eq('id', asNum)
          .select('id');
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      console.error('[deleteClientAction]', error);
      return { ok: false, error: formatDeleteError(error) };
    }

    if (!data?.length) {
      return {
        ok: false,
        error:
          'لم يُحذف أي صف من قاعدة البيانات — المعرّف غير موجود أو الحذف محجوب.',
      };
    }

    revalidatePath('/crm/clients');
    revalidatePath('/crm');
    revalidatePath('/crm', 'layout');
    return { ok: true, deletedId: String(data[0].id) };
  } catch (err) {
    console.error('[deleteClientAction]', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر حذف العميل من قاعدة البيانات.',
    };
  }
}

/**
 * قاعدة العملاء — Single Source of Truth = `clients` table ONLY.
 * No leads merge, no dedupe Maps, no ghost rows.
 * Radar approval must `ensureLeadClientAction` so new customers land in `clients`.
 */
export async function fetchClientDirectoryAction(): Promise<ClientDirectoryFetchResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return { ok: false, error: serviceKeyError };
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('clients')
      .select(CLIENT_LIST_SELECT)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      return { ok: false, error: error.message || 'تعذر قراءة جدول العملاء.' };
    }

    const rows: VipClientProfile[] = [];
    const seenIds = new Set<string>();
    for (const raw of (data ?? []) as unknown as Record<string, unknown>[]) {
      const mapped = normalizeVipClient(raw);
      if (!mapped) continue;
      const id = String(mapped.id);
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      rows.push(mapped);
    }

    return { ok: true, rows };
  } catch (err) {
    console.error('[fetchClientDirectoryAction]', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر تحميل قاعدة العملاء.',
    };
  }
}
