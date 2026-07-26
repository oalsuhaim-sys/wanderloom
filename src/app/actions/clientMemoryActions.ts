'use server';

import { revalidatePath } from 'next/cache';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function toBucketRelativePath(raw: unknown): string | null {
  if (raw == null) return null;
  let path = String(raw).trim();
  if (!path) return null;

  const markers = [
    '/object/public/memories/',
    '/object/sign/memories/',
    '/storage/v1/object/public/memories/',
  ];
  for (const marker of markers) {
    const idx = path.indexOf(marker);
    if (idx >= 0) {
      path = path.slice(idx + marker.length);
      break;
    }
  }

  path = path.split('?')[0]?.split('#')[0] ?? path;
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep */
  }
  path = path.replace(/^\/+/, '');
  if (!path || path.includes('://') || path.includes('..')) return null;
  return path;
}

function coerceId(raw: string | number): string | number {
  const s = String(raw).trim();
  return /^\d+$/.test(s) ? Number(s) : s;
}

/** Live exact approved counts — head count only, never a cached list length. */
export async function getExactApprovedMemoryCounts(): Promise<{
  ok: boolean;
  countsByClient: Record<string, number>;
  totalCount: number;
  error?: string;
}> {
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { ok: false, countsByClient: {}, totalCount: 0, error: 'server_config' };
  }

  const { data, error, count } = await admin
    .from('client_memories')
    .select('client_id', { count: 'exact' });

  if (error) {
    return { ok: false, countsByClient: {}, totalCount: 0, error: error.message };
  }

  const countsByClient: Record<string, number> = {};
  for (const row of data ?? []) {
    const key =
      row.client_id != null && String(row.client_id).trim() !== ''
        ? String(row.client_id)
        : '__unassigned__';
    countsByClient[key] = (countsByClient[key] ?? 0) + 1;
  }

  return {
    ok: true,
    countsByClient,
    totalCount: count ?? (data ?? []).length,
  };
}

export async function getExactApprovedCountForClient(
  clientId: string | number,
): Promise<{ ok: boolean; count: number; error?: string }> {
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { ok: false, count: 0, error: 'server_config' };
  }

  const key = coerceId(clientId);
  const { count, error } = await admin
    .from('client_memories')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', key);

  if (error) {
    return { ok: false, count: 0, error: error.message };
  }

  return { ok: true, count: count ?? 0 };
}

/**
 * Dual-delete approved memory (DB + Storage) + violently clear Next.js cache.
 */
export async function deleteApprovedClientMemory(input: {
  memoryId: string | number;
  path?: string | null;
  url?: string | null;
}): Promise<{
  ok: boolean;
  error?: string;
  warning?: string;
  clientId?: string | null;
  exactCount?: number;
}> {
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { ok: false, error: 'server_config' };
  }

  const memoryId = coerceId(input.memoryId);

  const { data: row, error: lookupError } = await admin
    .from('client_memories')
    .select('id, image_url, client_id')
    .eq('id', memoryId)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, error: lookupError.message };
  }

  const clientId =
    row?.client_id != null ? String(row.client_id) : null;
  const imageUrl = String(row?.image_url ?? input.url ?? '');

  if (row) {
    const { data: deletedRows, error: dbError } = await admin
      .from('client_memories')
      .delete()
      .eq('id', memoryId)
      .select('id');

    if (dbError) {
      return { ok: false, error: `فشل حذف سجل قاعدة البيانات: ${dbError.message}` };
    }
    if (!deletedRows?.length) {
      return {
        ok: false,
        error: 'لم يُحذف سجل قاعدة البيانات — تحقق من المعرّف',
      };
    }
  }

  const relativePaths = [
    ...new Set(
      [toBucketRelativePath(input.path), toBucketRelativePath(input.url), toBucketRelativePath(imageUrl)].filter(
        (p): p is string => Boolean(p),
      ),
    ),
  ];

  let warning: string | undefined;
  if (relativePaths.length > 0) {
    const { error: storageError } = await admin.storage
      .from('memories')
      .remove(relativePaths);
    if (storageError) {
      warning = storageError.message;
    }
  }

  let exactCount = 0;
  if (clientId) {
    const { count } = await admin
      .from('client_memories')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', coerceId(clientId));
    exactCount = count ?? 0;
  }

  // Nuke Next.js caches for the memories library
  revalidatePath('/crm/memories', 'page');
  revalidatePath('/crm/memories', 'layout');
  revalidatePath('/crm', 'layout');
  revalidatePath('/', 'layout');

  return {
    ok: true,
    warning,
    clientId,
    exactCount,
  };
}
