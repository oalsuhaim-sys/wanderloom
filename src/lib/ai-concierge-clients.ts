import type { SupabaseClient } from '@supabase/supabase-js';

import {
  AI_CONCIERGE_SOURCE,
  formatExpertBriefArabic,
  type ConciergeChatMessage,
  type ConciergePreferences,
  trimText,
} from '@/lib/ai-concierge';
import {
  canonicalizePhoneWa,
  isUsableClientName,
  isUsableClientPhone,
} from '@/lib/client-intake-pipeline';
import { sanitizePhoneDigits } from '@/lib/phoneUtils';

export type ConciergeLinkedClient = {
  id: number;
  name: string;
  phone_wa: string | null;
  email: string | null;
  created: boolean;
};

function phoneCandidates(phoneRaw: string): string[] {
  const raw = String(phoneRaw ?? '').trim();
  const digits = sanitizePhoneDigits(raw);
  const canonical = canonicalizePhoneWa(raw);
  const last9 = canonical.replace(/\D/g, '').slice(-9);
  return Array.from(
    new Set(
      [raw, digits, canonical, digits ? `+${digits}` : '', last9.length === 9 ? `0${last9}` : '', last9]
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  );
}

async function findClientByPhone(
  admin: SupabaseClient,
  phoneRaw: string,
): Promise<ConciergeLinkedClient | null> {
  if (!isUsableClientPhone(phoneRaw)) return null;

  for (const value of phoneCandidates(phoneRaw)) {
    const { data, error } = await admin
      .from('clients')
      .select('id, name, phone_wa, email')
      .eq('phone_wa', value)
      .maybeSingle();

    if (!error && data?.id != null) {
      return {
        id: Number(data.id),
        name: String(data.name ?? '').trim() || 'ضيف واندرلوم',
        phone_wa: (data.phone_wa as string | null) ?? null,
        email: (data.email as string | null) ?? null,
        created: false,
      };
    }

    // Schema without email column
    if (error && /column|schema cache|does not exist|could not find/i.test(error.message ?? '')) {
      const lean = await admin
        .from('clients')
        .select('id, name, phone_wa')
        .eq('phone_wa', value)
        .maybeSingle();
      if (!lean.error && lean.data?.id != null) {
        return {
          id: Number(lean.data.id),
          name: String(lean.data.name ?? '').trim() || 'ضيف واندرلوم',
          phone_wa: (lean.data.phone_wa as string | null) ?? null,
          email: null,
          created: false,
        };
      }
    }
  }

  const last9 = canonicalizePhoneWa(phoneRaw).replace(/\D/g, '').slice(-9);
  if (last9.length === 9) {
    const fuzzy = await admin
      .from('clients')
      .select('id, name, phone_wa, email')
      .ilike('phone_wa', `%${last9}`)
      .limit(5);

    const rows = fuzzy.error
      ? (
          await admin
            .from('clients')
            .select('id, name, phone_wa')
            .ilike('phone_wa', `%${last9}`)
            .limit(5)
        ).data
      : fuzzy.data;

    const match = rows?.find((row) => {
      const a = canonicalizePhoneWa(String(row.phone_wa ?? '')).slice(-9);
      return a === last9;
    });
    if (match?.id != null) {
      return {
        id: Number(match.id),
        name: String(match.name ?? '').trim() || 'ضيف واندرلوم',
        phone_wa: (match.phone_wa as string | null) ?? null,
        email: 'email' in match ? ((match as { email?: string | null }).email ?? null) : null,
        created: false,
      };
    }
  }

  return null;
}

async function findClientByEmail(
  admin: SupabaseClient,
  emailRaw: string,
): Promise<ConciergeLinkedClient | null> {
  const email = trimText(emailRaw, 120).toLowerCase();
  if (!email || !email.includes('@')) return null;

  const { data, error } = await admin
    .from('clients')
    .select('id, name, phone_wa, email')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) return null;
  return {
    id: Number(data.id),
    name: String(data.name ?? '').trim() || 'ضيف واندرلوم',
    phone_wa: (data.phone_wa as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    created: false,
  };
}

/**
 * Always stamp clients.lead_source as «عميل Ai» for concierge-linked profiles.
 */
export async function syncClientLeadSource(
  admin: SupabaseClient,
  clientId: number,
): Promise<void> {
  if (!clientId) return;
  const { error } = await admin
    .from('clients')
    .update({ lead_source: AI_CONCIERGE_SOURCE })
    .eq('id', clientId);
  if (error && !/column|schema cache|does not exist/i.test(error.message ?? '')) {
    console.error('[ai-concierge] lead_source sync failed:', error.message);
  }
}

/**
 * Find existing CRM client by phone/email, or insert a new clients row when phone is usable.
 */
export async function findOrCreateConciergeClient(
  admin: SupabaseClient,
  input: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  },
): Promise<ConciergeLinkedClient | null> {
  const phone = trimText(input.phone, 40);
  const email = trimText(input.email, 120);
  const name =
    (isUsableClientName(input.name ?? '') ? trimText(input.name, 120) : '') ||
    'ضيف واندرلوم — Concierge';

  if (phone && isUsableClientPhone(phone)) {
    const existing = await findClientByPhone(admin, phone);
    if (existing) {
      // Soft-fill missing name/email when provided + always sync lead_source
      const patch: Record<string, string> = {
        lead_source: AI_CONCIERGE_SOURCE,
      };
      if (isUsableClientName(input.name ?? '') && (!existing.name || existing.name.startsWith('ضيف'))) {
        patch.name = name;
      }
      if (email && !existing.email) patch.email = email;
      await admin.from('clients').update(patch).eq('id', existing.id);
      return {
        ...existing,
        name: patch.name || existing.name,
        email: patch.email || existing.email,
      };
    }

    const canonical = canonicalizePhoneWa(phone);

    // Prefer SECURITY DEFINER RPC when available
    try {
      const { data: rpcId, error: rpcError } = await admin.rpc('get_or_create_client_id', {
        p_name: name,
        p_phone: canonical,
      });
      if (!rpcError && rpcId != null) {
        const id = Number(rpcId);
        const rpcPatch: Record<string, string> = { lead_source: AI_CONCIERGE_SOURCE };
        if (email) rpcPatch.email = email;
        await admin.from('clients').update(rpcPatch).eq('id', id);
        return {
          id,
          name,
          phone_wa: canonical,
          email: email || null,
          created: true,
        };
      }
    } catch {
      /* fall through to insert */
    }

    const insertPayload: Record<string, unknown> = {
      name,
      phone_wa: canonical,
      client_type: 'عميل',
      lead_source: AI_CONCIERGE_SOURCE,
      sales_stage: 'جديد',
    };
    if (email) insertPayload.email = email;

    const { data: created, error: insertError } = await admin
      .from('clients')
      .insert(insertPayload)
      .select('id, name, phone_wa, email')
      .single();

    if (!insertError && created?.id != null) {
      return {
        id: Number(created.id),
        name: String(created.name ?? name),
        phone_wa: (created.phone_wa as string | null) ?? canonical,
        email: ((created.email as string | null) ?? email) || null,
        created: true,
      };
    }

    // Unique race → reclaim
    if (insertError && /duplicate|unique|23505/i.test(insertError.message ?? '')) {
      const raced = await findClientByPhone(admin, phone);
      if (raced) return raced;
    }

    // Lean insert without optional columns
    if (insertError && /column|schema cache|does not exist/i.test(insertError.message ?? '')) {
      const lean = await admin
        .from('clients')
        .insert({ name, phone_wa: canonical, client_type: 'عميل' })
        .select('id, name, phone_wa')
        .single();
      if (!lean.error && lean.data?.id != null) {
        return {
          id: Number(lean.data.id),
          name: String(lean.data.name ?? name),
          phone_wa: (lean.data.phone_wa as string | null) ?? canonical,
          email: email || null,
          created: true,
        };
      }
    }

    console.error('[ai-concierge] client insert failed:', insertError);
  }

  if (email) {
    const byEmail = await findClientByEmail(admin, email);
    if (byEmail) {
      await syncClientLeadSource(admin, byEmail.id);
      return byEmail;
    }
  }

  return null;
}

export function buildConversationSummary(
  history: ConciergeChatMessage[],
  preferences: ConciergePreferences,
  clientName?: string | null,
): string {
  if (
    preferences.preferred_destination ||
    preferences.daily_pace ||
    preferences.sensory_style ||
    preferences.hotel_style ||
    preferences.special_notes
  ) {
    return formatExpertBriefArabic(preferences, clientName);
  }

  const parts: string[] = [];
  if (clientName) parts.push(`الضيف: ${clientName}`);
  if (preferences.preferred_destination) {
    parts.push(`الوجهة: ${preferences.preferred_destination}`);
  }
  if (preferences.travel_style) parts.push(`الأسلوب: ${preferences.travel_style}`);
  if (preferences.budget) parts.push(`الميزانية: ${preferences.budget}`);
  if (preferences.target_date) parts.push(`التوقيت: ${preferences.target_date}`);

  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  if (lastUser) parts.push(`آخر رسالة: ${trimText(lastUser.content, 160)}`);

  return parts.join(' · ') || 'استشارة Concierge جديدة';
}
