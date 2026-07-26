import { NextResponse, type NextRequest } from 'next/server';

import { deleteApprovedClientMemory } from '@/app/actions/clientMemoryActions';
import { normalizeProfilePinInput } from '@/lib/client-profile-unlock';
import { coerceQuotationIdForDb } from '@/lib/crm-quotations';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

async function resolveClientByProfileCode(code: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('clients')
    .select('id, profile_code')
    .eq('profile_code', code)
    .maybeSingle();

  if (error) return { error: error.message, client: null, admin };
  if (!data?.id) return { error: 'not_found', client: null, admin };
  return { error: null, client: data as { id: string | number; profile_code?: string }, admin };
}

async function assertMemoryOwnsClient(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  memoryId: string,
  clientId: string | number,
) {
  const { data, error } = await admin
    .from('client_memories')
    .select('id, client_id, image_url, itinerary_id, location_name, map_url')
    .eq('id', /^\d+$/.test(memoryId) ? Number(memoryId) : memoryId)
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message };
  if (!data) return { ok: false as const, error: 'memory_not_found' };

  const owner = data.client_id != null ? String(data.client_id) : '';
  const keys = new Set([
    String(clientId),
    String(coerceQuotationIdForDb(clientId)),
  ]);
  if (!owner || !keys.has(owner)) {
    return { ok: false as const, error: 'forbidden' };
  }

  return { ok: true as const, row: data as Record<string, unknown> };
}

/** DELETE /api/portal/memories?code=&id= */
export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const code = normalizeProfilePinInput(url.searchParams.get('code') ?? '');
  const memoryId = String(url.searchParams.get('id') ?? '').trim();

  if (!code || !memoryId) {
    return NextResponse.json(
      { ok: false, error: 'missing_params' },
      { status: 400, headers: NO_STORE },
    );
  }

  let resolved;
  try {
    resolved = await resolveClientByProfileCode(code);
  } catch {
    return NextResponse.json(
      { ok: false, error: 'server_config' },
      { status: 503, headers: NO_STORE },
    );
  }

  if (resolved.error || !resolved.client) {
    return NextResponse.json(
      { ok: false, error: resolved.error || 'not_found' },
      { status: resolved.error === 'not_found' ? 404 : 500, headers: NO_STORE },
    );
  }

  const ownership = await assertMemoryOwnsClient(
    resolved.admin,
    memoryId,
    resolved.client.id,
  );
  if (!ownership.ok) {
    return NextResponse.json(
      { ok: false, error: ownership.error },
      {
        status: ownership.error === 'forbidden' ? 403 : 404,
        headers: NO_STORE,
      },
    );
  }

  const result = await deleteApprovedClientMemory({
    memoryId,
    url: String(ownership.row.image_url ?? ''),
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 500, headers: NO_STORE },
    );
  }

  return NextResponse.json(
    { ok: true, warning: result.warning ?? null },
    { headers: NO_STORE },
  );
}

/** POST /api/portal/memories — replace image (multipart: code, id, file) */
export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_body' },
      { status: 400, headers: NO_STORE },
    );
  }

  const code = normalizeProfilePinInput(String(formData.get('code') ?? ''));
  const memoryId = String(formData.get('id') ?? '').trim();
  const file = formData.get('file');

  if (!code || !memoryId || !(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { ok: false, error: 'missing_params' },
      { status: 400, headers: NO_STORE },
    );
  }

  let resolved;
  try {
    resolved = await resolveClientByProfileCode(code);
  } catch {
    return NextResponse.json(
      { ok: false, error: 'server_config' },
      { status: 503, headers: NO_STORE },
    );
  }

  if (resolved.error || !resolved.client) {
    return NextResponse.json(
      { ok: false, error: resolved.error || 'not_found' },
      { status: resolved.error === 'not_found' ? 404 : 500, headers: NO_STORE },
    );
  }

  const ownership = await assertMemoryOwnsClient(
    resolved.admin,
    memoryId,
    resolved.client.id,
  );
  if (!ownership.ok) {
    return NextResponse.json(
      { ok: false, error: ownership.error },
      {
        status: ownership.error === 'forbidden' ? 403 : 404,
        headers: NO_STORE,
      },
    );
  }

  const admin = resolved.admin;
  const clientKey = coerceQuotationIdForDb(resolved.client.id);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = `${clientKey}/${fileName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage.from('memories').upload(filePath, buffer, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });

  if (uploadError) {
    return NextResponse.json(
      { ok: false, error: uploadError.message },
      { status: 500, headers: NO_STORE },
    );
  }

  const { data: publicData } = admin.storage.from('memories').getPublicUrl(filePath);
  const newUrl = publicData.publicUrl;

  const { error: updateError } = await admin
    .from('client_memories')
    .update({ image_url: newUrl })
    .eq('id', /^\d+$/.test(memoryId) ? Number(memoryId) : memoryId);

  if (updateError) {
    return NextResponse.json(
      { ok: false, error: updateError.message },
      { status: 500, headers: NO_STORE },
    );
  }

  // Best-effort: remove old storage object
  const oldUrl = String(ownership.row.image_url ?? '');
  try {
    const marker = '/object/public/memories/';
    const idx = oldUrl.indexOf(marker);
    if (idx >= 0) {
      const relative = decodeURIComponent(oldUrl.slice(idx + marker.length).split('?')[0] ?? '');
      if (relative && !relative.includes('..')) {
        await admin.storage.from('memories').remove([relative]);
      }
    }
  } catch {
    /* ignore */
  }

  return NextResponse.json(
    { ok: true, imageUrl: newUrl },
    { headers: NO_STORE },
  );
}
