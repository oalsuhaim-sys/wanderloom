import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  mapActivityLogRow,
  normalizeActivityType,
  type ClientActivityLog,
  type ClientActivityType,
} from '@/lib/client-activity-types';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const ACTIVITY_LOGS_TABLE = 'activity_logs';

export type { ClientActivityLog, ClientActivityType };
export { mapActivityLogRow, normalizeActivityType } from '@/lib/client-activity-types';

export type LogClientActivityResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function coerceClientId(raw: string | number | null | undefined): string | number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = Number(s);
  if (Number.isFinite(n) && String(n) === s) return n;
  return s;
}

function isMissingColumnError(message: string): boolean {
  return /column|schema cache|does not exist/i.test(message);
}

/**
 * Reusable helper — insert into activity_logs for a real clients.id.
 * Uses only columns present in the live table (no hard dependency on `metadata`).
 * Never throws; safe to fire-and-forget from payment / invoice / booking flows.
 */
export async function logClientActivity(
  clientId: string | number | null | undefined,
  title: string,
  description: string,
  type: ClientActivityType | string = 'note',
  options?: {
    admin?: SupabaseClient;
    /** Optional extras — folded into description when `metadata` column is absent */
    metadata?: Record<string, unknown>;
  },
): Promise<LogClientActivityResult> {
  const cid = coerceClientId(clientId);
  const cleanTitle = String(title ?? '').trim();
  if (!cid) return { ok: false, error: 'معرّف العميل غير صالح.' };
  if (!cleanTitle) return { ok: false, error: 'عنوان النشاط مطلوب.' };

  const baseDescription = String(description ?? '').trim();
  const meta = options?.metadata ?? {};
  const metaKeys = Object.keys(meta);
  const descriptionWithMeta =
    metaKeys.length > 0
      ? [baseDescription, ...metaKeys.map((k) => `${k}: ${String(meta[k] ?? '')}`)]
          .filter(Boolean)
          .join(' · ')
      : baseDescription;

  try {
    const admin = options?.admin ?? createSupabaseAdminClient();

    // Prefer standard columns only — avoid `metadata` (missing on some deployments)
    const attempts: Record<string, unknown>[] = [
      {
        client_id: cid,
        title: cleanTitle,
        description: descriptionWithMeta || null,
        type: normalizeActivityType(type),
        created_at: new Date().toISOString(),
      },
      {
        client_id: cid,
        title: cleanTitle,
        description: descriptionWithMeta || null,
        type: normalizeActivityType(type),
      },
      {
        client_id: cid,
        title: cleanTitle,
        description: descriptionWithMeta || null,
      },
      {
        client_id: cid,
        title: cleanTitle,
      },
      // Last resort: include metadata only if leaner payloads somehow require it (unlikely)
      {
        client_id: cid,
        title: cleanTitle,
        description: baseDescription || null,
        type: normalizeActivityType(type),
        metadata: meta,
      },
    ];

    let lastError = '';
    for (const payload of attempts) {
      const { data, error } = await admin
        .from(ACTIVITY_LOGS_TABLE)
        .insert(payload)
        .select('id')
        .maybeSingle();

      if (!error) {
        return { ok: true, id: data?.id != null ? String(data.id) : '' };
      }

      lastError = error.message;
      console.warn('[logClientActivity] insert attempt:', lastError);

      // Skip missing-column / constraint variants → try leaner payload
      if (isMissingColumnError(lastError) || /check constraint|null value/i.test(lastError)) {
        continue;
      }
      // Non-schema errors: still try next leaner payload once, then stop
      if (!/metadata/i.test(lastError)) {
        // keep trying leaner shapes for unknown schema drift
        continue;
      }
    }

    return { ok: false, error: lastError || 'تعذر تسجيل النشاط.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'تعذر تسجيل النشاط.';
    console.warn('[logClientActivity]', message);
    return { ok: false, error: message };
  }
}

export async function fetchClientActivityLogs(
  clientId: string | number,
  options?: { admin?: SupabaseClient; limit?: number },
): Promise<{ ok: true; rows: ClientActivityLog[] } | { ok: false; error: string }> {
  const cid = coerceClientId(clientId);
  if (!cid) return { ok: false, error: 'معرّف العميل غير صالح.' };

  try {
    const admin = options?.admin ?? createSupabaseAdminClient();
    const limit = Math.min(200, Math.max(1, options?.limit ?? 100));

    const selectAttempts = [
      'id, client_id, title, description, type, created_at',
      'id, client_id, title, description, type, metadata, created_at',
      'id, client_id, title, description, created_at',
      '*',
    ] as const;

    let data: Record<string, unknown>[] | null = null;
    let lastError = '';

    for (const cols of selectAttempts) {
      const res = await admin
        .from(ACTIVITY_LOGS_TABLE)
        .select(cols)
        .eq('client_id', cid)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!res.error) {
        data = (res.data as Record<string, unknown>[]) ?? [];
        lastError = '';
        break;
      }
      lastError = res.error.message;
      if (!isMissingColumnError(lastError)) break;
    }

    if (lastError || data == null) {
      return { ok: false, error: lastError || 'تعذر تحميل سجل النشاط.' };
    }

    const rows: ClientActivityLog[] = [];
    for (const raw of data) {
      const mapped = mapActivityLogRow(raw);
      if (mapped) rows.push(mapped);
    }
    return { ok: true, rows };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر تحميل سجل النشاط.',
    };
  }
}
