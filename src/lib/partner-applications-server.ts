import 'server-only';

import type { PartnerApplication, PartnerKind } from '@/lib/partners';
import { provisionExpertAuthAccount } from '@/lib/expert-auth-provision';
import type { createSupabaseAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function parseLanguagesForDb(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,،]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeStatus(raw: unknown): PartnerApplication['status'] {
  const s = String(raw ?? 'pending').trim().toLowerCase();
  if (s === 'approved' || s === 'active') return 'approved';
  if (s === 'rejected' || s === 'inactive') return 'rejected';
  return 'pending';
}

function mapPartnerApplication(row: Record<string, unknown>): PartnerApplication | null {
  const id = row.id;
  const kind = String(row.partner_kind ?? '').trim().toLowerCase();
  const name = pickString(row, ['name']);
  if (id == null || !name) return null;
  if (kind !== 'leader' && kind !== 'expert' && kind !== 'celebrity') return null;

  return {
    id: id as number | string,
    partner_kind: kind as PartnerKind,
    name,
    email: pickString(row, ['email']),
    phone: pickString(row, ['phone']),
    languages: pickString(row, ['languages']) ??
      (Array.isArray(row.languages) ? (row.languages as string[]).join('، ') : null),
    experience_years:
      row.experience_years != null && Number.isFinite(Number(row.experience_years))
        ? Number(row.experience_years)
        : null,
    preferred_destinations: pickString(row, [
      'preferred_destinations',
      'destinations',
      'specialty_regions',
    ]),
    platforms: pickString(row, ['platforms']),
    follower_count:
      row.follower_count != null && Number.isFinite(Number(row.follower_count))
        ? Number(row.follower_count)
        : null,
    bio: pickString(row, ['bio']),
    status: normalizeStatus(row.status),
    review_notes: pickString(row, ['review_notes']),
    reviewed_at: pickString(row, ['reviewed_at']),
    created_at: String(row.created_at ?? ''),
  };
}

function isMissingTableError(message: string): boolean {
  return /partner_applications|leaders|experts|schema cache|relation|does not exist|could not find the table/i.test(
    message,
  );
}

function randomReferralCode(name: string): string {
  const base = name
    .replace(/\s+/g, '')
    .slice(0, 4)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, 'WL');
  return `${base || 'WL'}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/** طلبات معلقة من leaders + experts (+ legacy partner_applications) */
export async function fetchPartnerApplicationsAdmin(
  admin: AdminClient,
): Promise<{ applications: PartnerApplication[]; error: string | null }> {
  const applications: PartnerApplication[] = [];

  const [leadersRes, expertsRes, legacyRes] = await Promise.all([
    admin.from('leaders').select('*').order('created_at', { ascending: false }),
    admin.from('experts').select('*').order('created_at', { ascending: false }),
    admin.from('partner_applications').select('*').order('created_at', { ascending: false }),
  ]);

  if (leadersRes.error && !isMissingTableError(leadersRes.error.message ?? '')) {
    return { applications: [], error: leadersRes.error.message };
  }
  if (expertsRes.error && !isMissingTableError(expertsRes.error.message ?? '')) {
    return { applications: [], error: expertsRes.error.message };
  }

  for (const row of leadersRes.data ?? []) {
    const mapped = mapPartnerApplication({
      ...(row as Record<string, unknown>),
      partner_kind: 'leader',
      preferred_destinations: (row as Record<string, unknown>).destinations,
      languages: Array.isArray((row as Record<string, unknown>).languages)
        ? ((row as Record<string, unknown>).languages as string[]).join('، ')
        : (row as Record<string, unknown>).languages,
    });
    if (mapped) applications.push(mapped);
  }

  for (const row of expertsRes.data ?? []) {
    const mapped = mapPartnerApplication({
      ...(row as Record<string, unknown>),
      partner_kind: 'expert',
      preferred_destinations: (row as Record<string, unknown>).specialty_regions,
    });
    if (mapped) applications.push(mapped);
  }

  if (!legacyRes.error && legacyRes.data) {
    for (const row of legacyRes.data) {
      const mapped = mapPartnerApplication(row as Record<string, unknown>);
      if (mapped) applications.push(mapped);
    }
  }

  applications.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  return { applications, error: null };
}

async function resolveEntityKind(
  admin: AdminClient,
  applicationId: number | string,
): Promise<'leader' | 'expert' | 'application' | null> {
  const id = String(applicationId);

  const leader = await admin.from('leaders').select('id').eq('id', id).maybeSingle();
  if (!leader.error && leader.data) return 'leader';

  const expert = await admin.from('experts').select('id').eq('id', id).maybeSingle();
  if (!expert.error && expert.data) return 'expert';

  const app = await admin.from('partner_applications').select('id').eq('id', id).maybeSingle();
  if (!app.error && app.data) return 'application';

  return null;
}

export async function approvePartnerApplicationAdmin(
  admin: AdminClient,
  applicationId: number | string,
  reviewNotes?: string | null,
): Promise<{ ok: boolean; error: string | null }> {
  const kind = await resolveEntityKind(admin, applicationId);
  if (!kind) return { ok: false, error: 'application_not_found' };

  if (kind === 'leader') {
    const { data, error } = await admin
      .from('leaders')
      .update({ status: 'active' })
      .eq('id', applicationId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'already_reviewed' };
    return { ok: true, error: null };
  }

  if (kind === 'expert') {
    const { data, error } = await admin
      .from('experts')
      .update({ status: 'active' })
      .eq('id', applicationId)
      .eq('status', 'pending')
      .select('id, name, email, phone')
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'already_reviewed' };

    const row = data as { name?: string; email?: string; phone?: string };
    const authProvision = await provisionExpertAuthAccount(admin, {
      email: row.email,
      fullName: row.name,
      phone: row.phone,
    });
    if (!authProvision.ok) {
      console.warn('[approvePartner] expert auth provision:', authProvision.error);
      // Expert row is active — surface auth issue but do not roll back approval
      return {
        ok: true,
        error: `approved_but_auth_failed: ${authProvision.error}`,
      };
    }
    return { ok: true, error: null };
  }

  // Legacy partner_applications → insert into entity then mark approved
  const { data: appRow, error: fetchError } = await admin
    .from('partner_applications')
    .select('*')
    .eq('id', applicationId)
    .maybeSingle();

  if (fetchError) return { ok: false, error: fetchError.message };
  const app = appRow ? mapPartnerApplication(appRow as Record<string, unknown>) : null;
  if (!app) return { ok: false, error: 'application_not_found' };
  if (app.status !== 'pending') return { ok: false, error: 'already_reviewed' };

  if (app.partner_kind === 'leader') {
    const { error } = await admin.from('leaders').insert({
      name: app.name,
      email: app.email,
      phone: app.phone,
      status: 'active',
      languages: parseLanguagesForDb(app.languages),
      experience_years: app.experience_years,
      destinations: app.preferred_destinations,
      referral_code: randomReferralCode(app.name),
    });
    if (error) return { ok: false, error: error.message };
  } else if (app.partner_kind === 'expert') {
    const { error } = await admin.from('experts').insert({
      name: app.name,
      email: app.email,
      phone: app.phone,
      status: 'active',
      specialty_regions: app.preferred_destinations || app.bio,
    });
    if (error) return { ok: false, error: error.message };

    const authProvision = await provisionExpertAuthAccount(admin, {
      email: app.email,
      fullName: app.name,
      phone: app.phone,
    });
    if (!authProvision.ok) {
      console.warn('[approvePartner] legacy expert auth:', authProvision.error);
    }
  } else {
    const { error } = await admin.from('celebrities').insert({
      name: app.name,
      email: app.email,
      phone: app.phone,
      status: 'active',
      platforms: app.platforms,
      content_focus: app.bio,
      profile_url: null,
    });
    if (error) return { ok: false, error: error.message };
  }

  const { error: updateError } = await admin
    .from('partner_applications')
    .update({
      status: 'approved',
      review_notes: reviewNotes?.trim() || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', applicationId);

  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true, error: null };
}

export async function rejectPartnerApplicationAdmin(
  admin: AdminClient,
  applicationId: number | string,
  reviewNotes?: string | null,
): Promise<{ ok: boolean; error: string | null }> {
  const kind = await resolveEntityKind(admin, applicationId);
  if (!kind) return { ok: false, error: 'application_not_found' };

  if (kind === 'leader') {
    const { error } = await admin
      .from('leaders')
      .update({ status: 'rejected' })
      .eq('id', applicationId)
      .eq('status', 'pending');
    if (error) return { ok: false, error: error.message };
    return { ok: true, error: null };
  }

  if (kind === 'expert') {
    const { error } = await admin
      .from('experts')
      .update({ status: 'rejected' })
      .eq('id', applicationId)
      .eq('status', 'pending');
    if (error) return { ok: false, error: error.message };
    return { ok: true, error: null };
  }

  const { error } = await admin
    .from('partner_applications')
    .update({
      status: 'rejected',
      review_notes: reviewNotes?.trim() || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .eq('status', 'pending');

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}
