'use server';

import { revalidatePath } from 'next/cache';

import {
  fetchClientActivityLogs,
  logClientActivity,
  type ClientActivityLog,
  type ClientActivityType,
} from '@/lib/client-activity-logs';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

export type FetchClientActivityResult =
  | { ok: true; rows: ClientActivityLog[] }
  | { ok: false; error: string };

export type AddClientActivityNoteResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function fetchClientActivityAction(
  clientId: string,
): Promise<FetchClientActivityResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const id = String(clientId ?? '').trim();
  if (!id) return { ok: false, error: 'معرّف العميل غير صالح.' };

  return fetchClientActivityLogs(id);
}

export async function addClientActivityNoteAction(
  clientId: string,
  noteText: string,
): Promise<AddClientActivityNoteResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const id = String(clientId ?? '').trim();
  const description = String(noteText ?? '').trim();
  if (!id) return { ok: false, error: 'معرّف العميل غير صالح.' };
  if (!description) return { ok: false, error: 'اكتب الملاحظة أولاً.' };

  const result = await logClientActivity(id, 'ملاحظة يدويّة', description, 'note');
  if (!result.ok) return result;

  revalidatePath(`/crm/clients/${id}`);
  revalidatePath('/crm/clients');
  return result;
}

/** Thin server wrapper around logClientActivity for other actions */
export async function logClientActivityAction(
  clientId: string | number,
  title: string,
  description: string,
  type: ClientActivityType | string = 'note',
): Promise<AddClientActivityNoteResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const result = await logClientActivity(clientId, title, description, type);
  if (result.ok) {
    const id = String(clientId).trim();
    if (id) {
      revalidatePath(`/crm/clients/${id}`);
      revalidatePath('/crm/clients');
    }
  }
  return result;
}
