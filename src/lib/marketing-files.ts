import { marketingSupabase } from '@/lib/marketing-supabase-client';

export const MARKETING_FILES_BUCKET = 'marketing_files';

export type MarketingStorageFile = {
  name: string;
  path: string;
  publicUrl: string;
  createdAt: string | null;
  size: number | null;
  /** مجلد فرعي داخل التخزين */
  kind?: 'file' | 'folder';
};

export type MarketingAssetKind = 'image' | 'video' | 'folder' | 'file';

export function marketingFilePublicUrl(path: string): string {
  const { data } = marketingSupabase.storage.from(MARKETING_FILES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function sanitizeMarketingFileName(name: string): string {
  return name.replace(/[^\w.\-()\u0600-\u06FF\s]/g, '_').replace(/\s+/g, '_');
}

export function buildMarketingUploadPath(fileName: string, folder = ''): string {
  const base = `${Date.now()}_${sanitizeMarketingFileName(fileName)}`;
  const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
  return cleanFolder ? `${cleanFolder}/${base}` : base;
}

export function normalizeStoragePrefix(prefix: string): string {
  return String(prefix ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

export function joinStoragePath(...parts: string[]): string {
  return parts
    .map((p) => normalizeStoragePrefix(p))
    .filter(Boolean)
    .join('/');
}

export function detectMarketingAssetKind(name: string, isFolder: boolean): MarketingAssetKind {
  if (isFolder) return 'folder';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov', 'm4v'].includes(ext)) return 'video';
  return 'file';
}

function mapListedItem(
  item: {
    id?: string | null;
    name: string;
    created_at?: string | null;
    metadata?: { size?: number | string | null } | null;
  },
  prefix: string,
): MarketingStorageFile | null {
  if (!item.name || item.name === '.emptyFolderPlaceholder') return null;
  const isFolder = item.id == null;
  const path = joinStoragePath(prefix, item.name);
  return {
    name: item.name,
    path,
    publicUrl: isFolder ? '' : marketingFilePublicUrl(path),
    createdAt: item.created_at ?? null,
    size: item.metadata?.size != null ? Number(item.metadata.size) : null,
    kind: isFolder ? 'folder' : 'file',
  };
}

/** قائمة محتويات مجلد (أو الجذر إن كان prefix فارغاً) */
export async function listMarketingFilesAt(prefix = ''): Promise<{
  ok: boolean;
  files: MarketingStorageFile[];
  prefix: string;
  error?: string;
}> {
  const clean = normalizeStoragePrefix(prefix);
  const { data, error } = await marketingSupabase.storage
    .from(MARKETING_FILES_BUCKET)
    .list(clean, {
      limit: 200,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    });

  if (error) {
    return { ok: false, files: [], prefix: clean, error: error.message };
  }

  const files = (data ?? [])
    .map((item) => mapListedItem(item, clean))
    .filter((f): f is MarketingStorageFile => f != null)
    .sort((a, b) => {
      const af = a.kind === 'folder' ? 0 : 1;
      const bf = b.kind === 'folder' ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.name.localeCompare(b.name, 'ar');
    });

  return { ok: true, files, prefix: clean };
}

/** توافق خلفي — جذر المكتبة */
export async function listMarketingFiles(): Promise<{
  ok: boolean;
  files: MarketingStorageFile[];
  error?: string;
}> {
  const res = await listMarketingFilesAt('');
  return { ok: res.ok, files: res.files, error: res.error };
}

export async function uploadMarketingVideo(
  file: File,
  prefix = 'videos',
): Promise<{
  ok: boolean;
  file?: MarketingStorageFile;
  error?: string;
}> {
  const path = buildMarketingUploadPath(file.name, prefix);
  const { error } = await marketingSupabase.storage.from(MARKETING_FILES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'video/mp4',
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    file: {
      name: file.name,
      path,
      publicUrl: marketingFilePublicUrl(path),
      createdAt: new Date().toISOString(),
      size: file.size,
      kind: 'file',
    },
  };
}

export async function uploadMarketingFile(
  file: File,
  folder = '',
): Promise<{
  ok: boolean;
  file?: MarketingStorageFile;
  error?: string;
}> {
  const path = buildMarketingUploadPath(file.name, folder);
  const { error } = await marketingSupabase.storage.from(MARKETING_FILES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    file: {
      name: file.name,
      path,
      publicUrl: marketingFilePublicUrl(path),
      createdAt: new Date().toISOString(),
      size: file.size,
      kind: 'file',
    },
  };
}

export async function deleteMarketingFile(path: string): Promise<{ ok: boolean; error?: string }> {
  const clean = normalizeStoragePrefix(path);
  if (!clean) return { ok: false, error: 'مسار غير صالح' };
  const { error } = await marketingSupabase.storage.from(MARKETING_FILES_BUCKET).remove([clean]);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** حذف مجلد وكل محتوياته (عمق محدود) */
export async function deleteMarketingFolder(folderPath: string): Promise<{
  ok: boolean;
  deleted: number;
  error?: string;
}> {
  const clean = normalizeStoragePrefix(folderPath);
  if (!clean) return { ok: false, deleted: 0, error: 'مسار المجلد غير صالح' };

  const toRemove: string[] = [];

  async function walk(prefix: string, depth: number) {
    if (depth > 8) return;
    const { data, error } = await marketingSupabase.storage
      .from(MARKETING_FILES_BUCKET)
      .list(prefix, { limit: 200, offset: 0 });
    if (error) throw new Error(error.message);
    for (const item of data ?? []) {
      if (!item.name || item.name === '.emptyFolderPlaceholder') continue;
      const child = joinStoragePath(prefix, item.name);
      if (item.id == null) {
        await walk(child, depth + 1);
      } else {
        toRemove.push(child);
      }
    }
  }

  try {
    await walk(clean, 0);
    if (toRemove.length) {
      const { error } = await marketingSupabase.storage
        .from(MARKETING_FILES_BUCKET)
        .remove(toRemove);
      if (error) return { ok: false, deleted: 0, error: error.message };
    }
    return { ok: true, deleted: toRemove.length };
  } catch (err) {
    return {
      ok: false,
      deleted: 0,
      error: err instanceof Error ? err.message : 'تعذر حذف المجلد',
    };
  }
}

export async function downloadMarketingFile(
  path: string,
  fileName?: string,
): Promise<{ ok: boolean; error?: string }> {
  const clean = normalizeStoragePrefix(path);
  if (!clean) return { ok: false, error: 'مسار غير صالح' };

  const { data, error } = await marketingSupabase.storage
    .from(MARKETING_FILES_BUCKET)
    .download(clean);

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'تعذر تحميل الملف' };
  }

  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || clean.split('/').pop() || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { ok: true };
}
