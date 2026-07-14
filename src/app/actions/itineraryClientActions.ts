'use server';

import {
  coerceClientIdForItinerarySave,
  fetchItineraryMemberClientId,
  normalizeCrmClientIdString,
  persistItineraryClientId,
} from '@/lib/itinerary-client-crm';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

function resolveItineraryQueryId(itineraryId: string | number): string | number {
  return /^\d+$/.test(String(itineraryId)) ? Number(itineraryId) : itineraryId;
}

export type ItineraryClientIdFetchResult =
  | {
      ok: true;
      client_id: string | null;
      source: 'itineraries.client_id' | 'itinerary_client_members' | 'none';
    }
  | { ok: false; error: string; columnMissing?: boolean };

/** جلب client_id المرتبط بالمسار عبر service_role (يتجاوز RLS). */
export async function fetchItineraryClientIdAction(
  itineraryId: string | number,
): Promise<ItineraryClientIdFetchResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return { ok: false, error: serviceKeyError };
  }

  const queryId = resolveItineraryQueryId(itineraryId);

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('itineraries')
      .select('id, client_id')
      .eq('id', queryId)
      .maybeSingle();

    if (error) {
      const columnMissing = /column|schema cache|does not exist/i.test(error.message ?? '');
      return {
        ok: false,
        error: columnMissing
          ? 'عمود itineraries.client_id غير موجود — نفّذ supabase/sql/clients_profile_code.sql في Supabase SQL Editor.'
          : error.message || 'تعذر قراءة client_id',
        columnMissing,
      };
    }

    const direct = normalizeCrmClientIdString(
      data?.client_id as string | number | null | undefined,
    );
    if (direct) {
      return { ok: true, client_id: direct, source: 'itineraries.client_id' };
    }

    const member = await fetchItineraryMemberClientId(admin, queryId);
    if (member) {
      return { ok: true, client_id: member, source: 'itinerary_client_members' };
    }

    return { ok: true, client_id: null, source: 'none' };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر قراءة ربط العميل.',
    };
  }
}

export type ItineraryClientLinkSaveResult =
  | { ok: true; client_id: number | string | null }
  | { ok: false; error: string; columnMissing?: boolean };

/** حفظ itineraries.client_id عبر service_role — لا يُتخطى بصمت بسبب RLS. */
export async function saveItineraryClientLinkAction(
  itineraryId: string | number,
  clientIdRaw: string | number | null | undefined,
): Promise<ItineraryClientLinkSaveResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return { ok: false, error: serviceKeyError };
  }

  const queryId = resolveItineraryQueryId(itineraryId);
  const clientId = coerceClientIdForItinerarySave(clientIdRaw);

  try {
    const admin = createSupabaseAdminClient();
    const result = await persistItineraryClientId(admin, queryId, clientId);
    if (!result.ok) {
      const columnMissing = /column|schema cache|does not exist|clients_profile_code/i.test(
        result.error,
      );
      return { ok: false, error: result.error, columnMissing };
    }
    return result;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر حفظ ربط العميل.',
    };
  }
}
