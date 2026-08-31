import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  coerceClientIdForItinerarySave,
  fetchItineraryMemberClientId,
} from '@/lib/itinerary-client-crm';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ClientId = number | string;

function dumpFormData(formData: FormData): Record<string, string> {
  const dump: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (value instanceof File) {
      dump[key] = `File(name=${value.name}, size=${value.size}, type=${value.type})`;
    } else {
      dump[key] = String(value);
    }
  });
  return dump;
}

function firstNonEmpty(formData: FormData, keys: string[]): string {
  for (const key of keys) {
    const raw = formData.get(key);
    if (raw == null) continue;
    const value = String(raw).trim().replace(/^(client-|vip-)/i, '');
    if (value) return value;
  }
  return '';
}

function parseNumericId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error != null) {
    const e = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    const parts = [e.message, e.details, e.hint, e.code].filter(Boolean);
    if (parts.length > 0) return parts.join(' — ');
    return JSON.stringify(error);
  }
  return String(error);
}

type ResolvedTrip = {
  itineraryId: number | null;
  clientId: ClientId | null;
};

/**
 * Bulletproof resolver: given trip_id (and optional client_id), always try to
 * fill client_id from itineraries.client_id / members. Never reads the URL.
 */
async function resolveTripFromPayload(
  admin: SupabaseClient,
  tripToken: string,
  magicLinkToken: string,
  clientIdFromPayload: ClientId | null,
): Promise<ResolvedTrip> {
  let itineraryId: number | null = null;
  let clientId: ClientId | null = clientIdFromPayload;

  const applyRow = (row: { id?: unknown; client_id?: unknown } | null | undefined) => {
    if (!row) return;
    const id = parseNumericId(String(row.id ?? ''));
    if (id != null) itineraryId = id;
    if (clientId == null) {
      clientId = coerceClientIdForItinerarySave(row.client_id as string | number | null);
    }
  };

  // 1) Numeric trip_id — trust it, then LOOK UP client_id from DB (Step 3)
  const numeric = parseNumericId(tripToken);
  if (numeric != null) {
    itineraryId = numeric;
    const { data, error } = await admin
      .from('itineraries')
      .select('id, client_id')
      .eq('id', numeric)
      .maybeSingle();

    if (error) {
      console.warn('[client-upload] trip lookup by id failed:', error.message);
    } else {
      applyRow(data);
      itineraryId = numeric; // keep trusted payload id even if select is empty
    }

    // Explicit client_id backfill from the same trip row / members
    if (clientId == null) {
      if (data?.client_id != null) {
        clientId = coerceClientIdForItinerarySave(data.client_id as string | number);
      }
      if (clientId == null) {
        try {
          const memberId = await fetchItineraryMemberClientId(admin, numeric);
          clientId = coerceClientIdForItinerarySave(memberId);
        } catch (memberErr) {
          console.warn('[client-upload] member client_id lookup failed:', memberErr);
        }
      }
    }

    console.log('[client-upload] resolved from numeric trip_id:', {
      itineraryId,
      clientId,
      dbClientId: data?.client_id ?? null,
    });
    return { itineraryId, clientId };
  }

  // 2) Non-numeric token: magic_link_id / passcode / raw id string
  const magicToken = magicLinkToken || tripToken;
  if (magicToken) {
    const { data: byMagic } = await admin
      .from('itineraries')
      .select('id, client_id')
      .eq('magic_link_id', magicToken)
      .maybeSingle();
    applyRow(byMagic);

    if (itineraryId == null) {
      const { data: byPass } = await admin
        .from('itineraries')
        .select('id, client_id')
        .eq('passcode', magicToken.toUpperCase())
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      applyRow(byPass);
    }

    if (itineraryId == null) {
      const { data: byId } = await admin
        .from('itineraries')
        .select('id, client_id')
        .eq('id', magicToken)
        .maybeSingle();
      applyRow(byId);
    }

    if (itineraryId != null && clientId == null) {
      try {
        const memberId = await fetchItineraryMemberClientId(admin, itineraryId);
        clientId = coerceClientIdForItinerarySave(memberId);
      } catch {
        /* ignore */
      }
    }

    if (itineraryId != null) {
      return { itineraryId, clientId };
    }
  }

  // 3) client_id alone → latest itinerary for that client
  if (clientId != null && itineraryId == null) {
    const { data: byClient } = await admin
      .from('itineraries')
      .select('id, client_id')
      .eq('client_id', clientId)
      .or('is_template.is.null,is_template.eq.false')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    applyRow(byClient);
  }

  return { itineraryId, clientId };
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'بيانات مفقودة' }, { status: 400 });
  }

  const payloadDump = dumpFormData(formData);
  console.log('[client-upload] FormData payload:', payloadDump);

  const file = formData.get('file');
  const locationName =
    firstNonEmpty(formData, ['locationName', 'location_name']) || 'محطة مختارة';
  const mapUrl = firstNonEmpty(formData, [
    'mapUrl',
    'map_url',
    'google_maps_url',
    'googleMapsUrl',
  ]);

  const tripToken = firstNonEmpty(formData, [
    'trip_id',
    'itinerary_id',
    'itineraryId',
    'tripId',
  ]);
  const magicLinkToken = firstNonEmpty(formData, [
    'magic_link_id',
    'magicLinkId',
    'magic_link',
  ]);
  let clientId: ClientId | null = coerceClientIdForItinerarySave(
    formData.get('clientId') ?? formData.get('client_id'),
  );

  if (!(file instanceof File) || file.size === 0) {
    console.error('[client-upload] missing file', payloadDump);
    return NextResponse.json({ error: 'بيانات مفقودة' }, { status: 400 });
  }

  if (!tripToken && !magicLinkToken && clientId == null) {
    console.error('[client-upload] empty identity FormData:', payloadDump);
    return NextResponse.json(
      {
        error:
          'معرّف الرحلة أو العميل مفقود من الصفحة. أعد فتح رابط المسار ثم حاول مجدداً.',
      },
      { status: 400 },
    );
  }

  let admin: SupabaseClient;
  try {
    admin = createSupabaseAdminClient();
  } catch (configErr) {
    console.error('[client-upload] service role unavailable:', configErr);
    return NextResponse.json({ error: 'server_config' }, { status: 503 });
  }

  try {
    const resolved = await resolveTripFromPayload(
      admin,
      tripToken,
      magicLinkToken,
      clientId,
    );
    const itineraryId = resolved.itineraryId;
    clientId = resolved.clientId ?? clientId;

    // Final Step-3 safety net: if we somehow have trip_id numeric but no client yet
    if (clientId == null && itineraryId != null) {
      const { data: tripRow } = await admin
        .from('itineraries')
        .select('client_id')
        .eq('id', itineraryId)
        .maybeSingle();
      clientId = coerceClientIdForItinerarySave(tripRow?.client_id as string | number | null);
      console.log('[client-upload] final client_id backfill from trip:', {
        itineraryId,
        clientId,
      });
    }

    // Allow upload with trip only OR client only (Admin-compatible).
    // Prefer both when available.
    if (itineraryId == null && clientId == null) {
      console.error('[client-upload] unresolved after all lookups', {
        tripToken,
        magicLinkToken,
        payloadDump,
      });
      return NextResponse.json(
        {
          error:
            'تعذر ربط الصورة بالرحلة أو العميل. تأكد أن المسار مربوط بعميل في لوحة التحكم.',
        },
        { status: 400 },
      );
    }

    console.log('[client-upload] resolved for insert:', { itineraryId, clientId });

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    const filePath =
      clientId != null
        ? `${clientId}/${fileName}`
        : `inbox/${itineraryId}/${fileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from('memories')
      .upload(filePath, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
        metadata: {
          locationName,
          location_name: locationName,
          mapUrl: mapUrl || '',
          map_url: mapUrl || '',
          itinerary_id: itineraryId != null ? String(itineraryId) : '',
          client_id: clientId != null ? String(clientId) : '',
        },
      });

    if (uploadError) {
      console.error('[client-upload] storage upload failed:', uploadError);
      throw uploadError;
    }

    const { data: publicData } = admin.storage.from('memories').getPublicUrl(filePath);
    const publicUrl = publicData.publicUrl;

    // Storage-only on Magic Link — Admin "اعتماد الصورة" inserts into client_memories
    console.log('[client-upload] storage-only success (pending admin approve):', {
      path: filePath,
      itineraryId,
      clientId,
      publicUrl,
    });

    return NextResponse.json({
      success: true,
      pending: true,
      url: publicUrl,
      path: filePath,
      client_id: clientId,
      itinerary_id: itineraryId,
      trip_id: itineraryId,
      message: 'تم رفع الصورة إلى التخزين — بانتظار اعتماد الإدارة',
    });
  } catch (error) {
    console.error('[client-upload] API upload error:', error);
    return NextResponse.json({ error: formatApiError(error) }, { status: 500 });
  }
}
