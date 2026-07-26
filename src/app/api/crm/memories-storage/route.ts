import { NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Extract bucket-relative path from a storage path or public URL.
 * Example URL:
 *   https://xxx.supabase.co/storage/v1/object/public/memories/42/a.jpg
 * → 42/a.jpg
 */
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
    /* keep raw */
  }
  path = path.replace(/^\/+/, '');

  if (!path || path.includes('://') || path.includes('..')) return null;
  return path;
}

async function removeStoragePaths(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  relativePaths: string[],
): Promise<{ ok: boolean; removed: unknown[]; error?: string; softMissing?: boolean }> {
  if (relativePaths.length === 0) {
    return { ok: true, removed: [], softMissing: true };
  }

  const { data, error } = await admin.storage.from('memories').remove(relativePaths);
  if (error) {
    return { ok: false, removed: [], error: error.message };
  }

  const removed = Array.isArray(data) ? data : [];
  // Empty remove is often "already gone" — treat as soft success for approved dual-delete
  if (removed.length === 0) {
    return { ok: true, removed: [], softMissing: true };
  }
  return { ok: true, removed };
}

export async function DELETE(request: Request) {
  let body: {
    memoryId?: string | number | null;
    path?: string;
    paths?: string[];
    url?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const memoryIdRaw = body.memoryId;
  const hasMemoryId =
    memoryIdRaw != null && String(memoryIdRaw).trim() !== '';

  // ── Approved image: dual-delete DB row + storage (service role) ──────────
  if (hasMemoryId) {
    const memoryId = /^\d+$/.test(String(memoryIdRaw).trim())
      ? Number(String(memoryIdRaw).trim())
      : String(memoryIdRaw).trim();

    const { data: row, error: lookupError } = await admin
      .from('client_memories')
      .select('id, image_url, client_id, itinerary_id')
      .eq('id', memoryId)
      .maybeSingle();

    if (lookupError) {
      console.error('[memories-storage] memory lookup failed:', lookupError.message);
      return NextResponse.json(
        { ok: false, error: lookupError.message },
        { status: 500 },
      );
    }

    if (!row) {
      // Already gone from DB — still try storage cleanup from payload URL
      const fallbackPaths = [
        toBucketRelativePath(body.path),
        toBucketRelativePath(body.url),
      ].filter((p): p is string => Boolean(p));

      if (fallbackPaths.length > 0) {
        await removeStoragePaths(admin, fallbackPaths);
      }

      return NextResponse.json({
        ok: true,
        dbDeleted: false,
        alreadyGone: true,
        message: 'سجل قاعدة البيانات غير موجود (ربما حُذف مسبقاً)',
      });
    }

    const imageUrl = String(row.image_url ?? '');
    const relativePaths = [
      ...new Set(
        [
          toBucketRelativePath(body.path),
          toBucketRelativePath(body.url),
          toBucketRelativePath(imageUrl),
        ].filter((p): p is string => Boolean(p)),
      ),
    ];

    // Step A — delete DB row and verify with .select()
    const { data: deletedRows, error: dbError } = await admin
      .from('client_memories')
      .delete()
      .eq('id', memoryId)
      .select('id');

    if (dbError) {
      console.error('[memories-storage] DB delete failed:', dbError.message);
      return NextResponse.json(
        { ok: false, error: `فشل حذف سجل قاعدة البيانات: ${dbError.message}` },
        { status: 500 },
      );
    }

    const dbDeleted = Array.isArray(deletedRows) && deletedRows.length > 0;
    if (!dbDeleted) {
      console.error('[memories-storage] DB delete returned 0 rows for id:', memoryId);
      return NextResponse.json(
        {
          ok: false,
          error: 'لم يُحذف سجل قاعدة البيانات — تحقق من الصلاحيات أو المعرّف',
        },
        { status: 500 },
      );
    }

    // Step B — delete storage file (soft-ok if already missing)
    const storageResult = await removeStoragePaths(admin, relativePaths);
    if (!storageResult.ok) {
      console.error('[memories-storage] storage remove after DB delete:', storageResult.error);
      // DB is already gone — report partial success so UI count still syncs
      return NextResponse.json({
        ok: true,
        dbDeleted: true,
        storageDeleted: false,
        warning: storageResult.error || 'تعذر حذف ملف التخزين بعد حذف السجل',
        paths: relativePaths,
        memoryId,
      });
    }

    console.log('[memories-storage] dual-delete ok:', {
      memoryId,
      paths: relativePaths,
      softMissing: storageResult.softMissing ?? false,
    });

    return NextResponse.json({
      ok: true,
      dbDeleted: true,
      storageDeleted: !storageResult.softMissing,
      storageAlreadyMissing: storageResult.softMissing === true,
      paths: relativePaths,
      memoryId,
      client_id: row.client_id ?? null,
      itinerary_id: row.itinerary_id ?? null,
    });
  }

  // ── Pending-only: storage path delete ────────────────────────────────────
  const candidates = [
    ...(Array.isArray(body.paths) ? body.paths : []),
    body.path,
    body.url,
  ];

  const relativePaths = [
    ...new Set(
      candidates
        .map((c) => toBucketRelativePath(c))
        .filter((p): p is string => Boolean(p)),
    ),
  ];

  if (relativePaths.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'missing_or_invalid_path' },
      { status: 400 },
    );
  }

  console.log('[memories-storage] remove paths (pending):', relativePaths);

  const storageResult = await removeStoragePaths(admin, relativePaths);
  if (!storageResult.ok) {
    console.error('[memories-storage] remove failed:', storageResult.error, relativePaths);
    return NextResponse.json(
      { ok: false, error: storageResult.error, paths: relativePaths },
      { status: 500 },
    );
  }

  if (storageResult.softMissing) {
    return NextResponse.json(
      {
        ok: false,
        error: `لم يُحذف أي ملف — تحقق من المسار: ${relativePaths.join(', ')}`,
        paths: relativePaths,
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    paths: relativePaths,
    removed: storageResult.removed,
  });
}
