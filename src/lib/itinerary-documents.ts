export type ItineraryDocument = {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  mimeType?: string;
};

export function parseItineraryDocuments(raw: unknown): ItineraryDocument[] {
  if (raw == null) return [];

  let data: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      data = JSON.parse(trimmed) as unknown;
    } catch {
      return [];
    }
  }

  if (!Array.isArray(data)) return [];

  const docs: ItineraryDocument[] = [];
  data.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const row = item as Record<string, unknown>;
    const url = String(row.url ?? '').trim();
    if (!url) return;
    docs.push({
      id: String(row.id ?? `doc-${index}`),
      name: String(row.name ?? 'مستند').trim() || 'مستند',
      url,
      uploadedAt: String(row.uploaded_at ?? row.uploadedAt ?? '').trim(),
      mimeType: String(row.mime_type ?? row.mimeType ?? '').trim() || undefined,
    });
  });
  return docs;
}

export function serializeItineraryDocuments(docs: ItineraryDocument[]): Record<string, unknown>[] {
  return docs.map((d) => ({
    id: d.id,
    name: d.name.trim(),
    url: d.url.trim(),
    uploaded_at: d.uploadedAt || new Date().toISOString(),
    ...(d.mimeType ? { mime_type: d.mimeType } : {}),
  }));
}

/** الاسم الأساسي في Storage — نفّذ supabase/sql/documents_bucket.sql */
export const ITINERARY_DOCUMENTS_BUCKET = 'documents';
export const ITINERARY_DOCUMENTS_BUCKET_LEGACY = 'itinerary-documents';

/** محفظة المستندات في منشئ المسار — bucket «attachments» */
export const ITINERARY_WALLET_BUCKET = 'attachments';

const WALLET_MAX_BYTES = 10 * 1024 * 1024;

export function isItineraryWalletFileAllowed(file: File): boolean {
  if (file.size > WALLET_MAX_BYTES) return false;
  return file.type === 'application/pdf' || /^image\//i.test(file.type);
}

export async function uploadItineraryWalletDocument(
  supabase: {
    storage: {
      from: (bucket: string) => {
        upload: (
          path: string,
          file: File,
          opts?: { contentType?: string; upsert?: boolean },
        ) => Promise<{ error: { message?: string } | null }>;
        getPublicUrl: (path: string) => { data: { publicUrl: string } };
      };
    };
  },
  file: File,
): Promise<{ publicUrl: string; storagePath: string }> {
  if (!isItineraryWalletFileAllowed(file)) {
    throw new Error('يُقبل فقط PDF أو صور — بحد أقصى 10 ميجابايت');
  }

  const rawExt = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const fileName = `doc_${Date.now()}.${rawExt}`;

  const { error } = await supabase.storage.from(ITINERARY_WALLET_BUCKET).upload(fileName, file, {
    contentType: file.type || undefined,
    upsert: false,
  });

  if (error) {
    if (/bucket|not found|does not exist/i.test(error.message ?? '')) {
      throw new Error(
        'تعذّر الرفع — نفّذ supabase/sql/attachments_bucket.sql في Supabase Storage.',
      );
    }
    throw new Error(error.message || 'تعذر رفع الملف.');
  }

  const { data: urlData } = supabase.storage.from(ITINERARY_WALLET_BUCKET).getPublicUrl(fileName);

  return { publicUrl: urlData.publicUrl, storagePath: fileName };
}

export async function uploadItineraryPdf(
  supabase: {
    storage: {
      from: (bucket: string) => {
        upload: (
          path: string,
          file: File,
          opts?: { contentType?: string; upsert?: boolean },
        ) => Promise<{ error: { message?: string } | null }>;
        getPublicUrl: (path: string) => { data: { publicUrl: string } };
      };
    };
  },
  file: File,
  itineraryId?: string | number,
): Promise<{ publicUrl: string; bucket: string; path: string }> {
  const safeBase = file.name.replace(/[^\w.\-أ-ي\s]/g, '_').slice(0, 120);
  const uniqueName = `${Date.now()}_${safeBase}`;
  const filePath = itineraryId != null && String(itineraryId).trim()
    ? `${itineraryId}/${uniqueName}`
    : uniqueName;

  const opts = { contentType: 'application/pdf', upsert: false as const };

  const { error } = await supabase.storage.from(ITINERARY_DOCUMENTS_BUCKET).upload(filePath, file, opts);
  if (error) {
    if (/bucket|not found|does not exist/i.test(error.message ?? '')) {
      const legacy = await supabase.storage
        .from(ITINERARY_DOCUMENTS_BUCKET_LEGACY)
        .upload(filePath, file, opts);
      if (legacy.error) {
        throw new Error(
          legacy.error.message ||
            'تعذر رفع الملف — نفّذ supabase/sql/documents_bucket.sql وصلاحيات Storage.',
        );
      }
      const { data } = supabase.storage.from(ITINERARY_DOCUMENTS_BUCKET_LEGACY).getPublicUrl(filePath);
      return { publicUrl: data.publicUrl, bucket: ITINERARY_DOCUMENTS_BUCKET_LEGACY, path: filePath };
    }
    if (/policy|permission|RLS|403|42501/i.test(error.message ?? '')) {
      throw new Error(
        `${error.message ?? 'رفض الصلاحيات'} — تحقق من سياسات bucket «documents» في Supabase Storage.`,
      );
    }
    throw new Error(error.message || 'تعذر رفع الملف.');
  }

  const { data } = supabase.storage.from(ITINERARY_DOCUMENTS_BUCKET).getPublicUrl(filePath);
  return { publicUrl: data.publicUrl, bucket: ITINERARY_DOCUMENTS_BUCKET, path: filePath };
}
