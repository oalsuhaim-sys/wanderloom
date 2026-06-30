import { marketingSupabase } from '@/lib/marketing-supabase-client';

export const MARKETING_FILES_BUCKET = 'marketing_files';

export type MarketingStorageFile = {
  name: string;
  path: string;
  publicUrl: string;
  createdAt: string | null;
  size: number | null;
};

export function marketingFilePublicUrl(path: string): string {
  const { data } = marketingSupabase.storage.from(MARKETING_FILES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function sanitizeMarketingFileName(name: string): string {
  return name.replace(/[^\w.\-()\u0600-\u06FF\s]/g, '_').replace(/\s+/g, '_');
}

export function buildMarketingUploadPath(fileName: string, folder = ''): string {
  const base = `${Date.now()}_${sanitizeMarketingFileName(fileName)}`;
  return folder ? `${folder}/${base}` : base;
}

export async function listMarketingFiles(): Promise<{
  ok: boolean;
  files: MarketingStorageFile[];
  error?: string;
}> {
  const { data, error } = await marketingSupabase.storage
    .from(MARKETING_FILES_BUCKET)
    .list('', {
      limit: 200,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    });

  if (error) {
    return { ok: false, files: [], error: error.message };
  }

  const files = (data ?? [])
    .filter((item) => item.name && item.name !== '.emptyFolderPlaceholder')
    .map((item) => ({
      name: item.name,
      path: item.name,
      publicUrl: marketingFilePublicUrl(item.name),
      createdAt: item.created_at ?? null,
      size: item.metadata?.size != null ? Number(item.metadata.size) : null,
    }));

  return { ok: true, files };
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
    },
  };
}

export async function uploadMarketingFile(file: File): Promise<{
  ok: boolean;
  file?: MarketingStorageFile;
  error?: string;
}> {
  const path = buildMarketingUploadPath(file.name);
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
    },
  };
}

export async function deleteMarketingFile(path: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await marketingSupabase.storage.from(MARKETING_FILES_BUCKET).remove([path]);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
