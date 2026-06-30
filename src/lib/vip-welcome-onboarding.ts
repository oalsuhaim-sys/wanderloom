import { supabase } from '@/lib/supabase';

export type WelcomeTravelStyle = {
  relaxation_vs_adventure: number;
  nature_vs_city: number;
  culinary_preferences: string;
  dietary_restrictions: string;
};

export type WelcomeWardrobePrefs = {
  shirt_size: string;
  shoe_size: string;
  favorite_brands: string;
};

export type WelcomeCompanion = {
  id: string;
  name: string;
  age: string;
  relation: string;
};

export type WelcomePassportDoc = {
  id: string;
  name: string;
  url: string;
  uploaded_at: string;
  mime_type?: string;
};

export type WelcomePreferences = {
  travel_style: WelcomeTravelStyle;
  wardrobe: WelcomeWardrobePrefs;
};

export type WelcomeOnboardingPayload = {
  preferences: WelcomePreferences;
  family_members: WelcomeCompanion[];
  passport_docs: WelcomePassportDoc[];
};

export type WelcomeProfileRow = {
  client_id: number;
  display_name: string;
  onboarding_completed: boolean;
  preferences: WelcomePreferences;
  family_members: WelcomeCompanion[];
  passport_docs: WelcomePassportDoc[];
};

export function buildWelcomePublicUrl(token: string, origin?: string): string {
  const base = (origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(
    /\/$/,
    '',
  );
  return `${base}/welcome/${encodeURIComponent(String(token).trim())}`;
}

export function createEmptyWelcomePayload(): WelcomeOnboardingPayload {
  return {
    preferences: {
      travel_style: {
        relaxation_vs_adventure: 50,
        nature_vs_city: 50,
        culinary_preferences: '',
        dietary_restrictions: '',
      },
      wardrobe: {
        shirt_size: '',
        shoe_size: '',
        favorite_brands: '',
      },
    },
    family_members: [],
    passport_docs: [],
  };
}

export function createEmptyCompanion(): WelcomeCompanion {
  return {
    id: `comp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: '',
    age: '',
    relation: '',
  };
}

function parseTravelStyle(raw: unknown): WelcomeTravelStyle {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const num = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fallback;
  };
  return {
    relaxation_vs_adventure: num(row.relaxation_vs_adventure, 50),
    nature_vs_city: num(row.nature_vs_city, 50),
    culinary_preferences: String(row.culinary_preferences ?? '').trim(),
    dietary_restrictions: String(row.dietary_restrictions ?? '').trim(),
  };
}

function parseWardrobe(raw: unknown): WelcomeWardrobePrefs {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    shirt_size: String(row.shirt_size ?? '').trim(),
    shoe_size: String(row.shoe_size ?? '').trim(),
    favorite_brands: String(row.favorite_brands ?? '').trim(),
  };
}

function parsePreferences(raw: unknown): WelcomePreferences {
  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    travel_style: parseTravelStyle(root.travel_style),
    wardrobe: parseWardrobe(root.wardrobe),
  };
}

function parseCompanions(raw: unknown): WelcomeCompanion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const name = String(row.name ?? '').trim();
      if (!name) return null;
      return {
        id: String(row.id ?? `comp-${index}`),
        name,
        age: String(row.age ?? '').trim(),
        relation: String(row.relation ?? '').trim(),
      } satisfies WelcomeCompanion;
    })
    .filter((c): c is WelcomeCompanion => c != null);
}

function parsePassportDocs(raw: unknown): WelcomePassportDoc[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const url = String(row.url ?? '').trim();
      if (!url) return null;
      return {
        id: String(row.id ?? `passport-${index}`),
        name: String(row.name ?? 'وثيقة').trim() || 'وثيقة',
        url,
        uploaded_at: String(row.uploaded_at ?? row.uploadedAt ?? '').trim(),
        mime_type: String(row.mime_type ?? row.mimeType ?? '').trim() || undefined,
      } satisfies WelcomePassportDoc;
    })
    .filter((d): d is WelcomePassportDoc => d != null);
}

function mapWelcomeRow(raw: Record<string, unknown>): WelcomeProfileRow {
  return {
    client_id: Number(raw.client_id),
    display_name: String(raw.display_name ?? 'ضيفنا الكريم').trim() || 'ضيفنا الكريم',
    onboarding_completed: raw.onboarding_completed === true,
    preferences: parsePreferences(raw.preferences),
    family_members: parseCompanions(raw.family_members),
    passport_docs: parsePassportDocs(raw.passport_docs),
  };
}

export async function fetchWelcomeProfileByToken(
  token: string,
): Promise<WelcomeProfileRow | null> {
  if (!supabase) return null;
  const trimmed = String(token ?? '').trim();
  if (!trimmed) return null;

  const rpc = await supabase.rpc('get_client_welcome_by_token', { p_token: trimmed });
  if (!rpc.error && rpc.data) {
    return mapWelcomeRow(rpc.data as Record<string, unknown>);
  }

  if (rpc.error && !/function|schema cache|does not exist|column/i.test(rpc.error.message ?? '')) {
    throw rpc.error;
  }

  const { data, error } = await supabase
    .from('clients')
    .select('id, name, onboarding_completed, preferences, family_members, passport_docs')
    .eq('onboarding_token', trimmed)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapWelcomeRow({
    client_id: data.id,
    display_name: String(data.name ?? 'ضيفنا الكريم'),
    onboarding_completed: data.onboarding_completed === true,
    preferences: data.preferences,
    family_members: data.family_members,
    passport_docs: data.passport_docs,
  });
}

/** @deprecated استخدم fetchWelcomeProfileByToken */
export async function fetchWelcomeProfileByClientId(
  clientId: string | number,
): Promise<WelcomeProfileRow | null> {
  if (!supabase) return null;
  const idNum = Number(clientId);
  if (!Number.isFinite(idNum) || idNum <= 0) return null;

  const rpc = await supabase.rpc('get_client_welcome_by_id', { p_client_id: idNum });
  if (!rpc.error && rpc.data) {
    return mapWelcomeRow(rpc.data as Record<string, unknown>);
  }

  if (rpc.error && !/function|schema cache|does not exist|column/i.test(rpc.error.message ?? '')) {
    throw rpc.error;
  }

  const { data, error } = await supabase
    .from('clients')
    .select('id, name, onboarding_completed, preferences, family_members, passport_docs')
    .eq('id', idNum)
    .maybeSingle();

  if (error || !data) return null;

  return mapWelcomeRow({
    client_id: data.id,
    display_name: String(data.name ?? 'ضيفنا الكريم'),
    onboarding_completed: data.onboarding_completed === true,
    preferences: data.preferences,
    family_members: data.family_members,
    passport_docs: data.passport_docs,
  });
}

export async function submitWelcomeOnboardingByToken(
  token: string,
  payload: WelcomeOnboardingPayload,
): Promise<boolean> {
  if (!supabase) return false;
  const trimmed = String(token ?? '').trim();
  if (!trimmed) return false;

  const preferences = {
    travel_style: payload.preferences.travel_style,
    wardrobe: payload.preferences.wardrobe,
  };

  const family_members = payload.family_members
    .filter((c) => c.name.trim())
    .map((c) => ({
      id: c.id,
      name: c.name.trim(),
      age: c.age.trim() || null,
      relation: c.relation.trim() || null,
    }));

  const rpc = await supabase.rpc('submit_client_welcome_by_token', {
    p_token: trimmed,
    p_preferences: preferences,
    p_family_members: family_members,
    p_passport_docs: [],
  });

  if (!rpc.error && rpc.data === true) return true;

  if (rpc.error && !/function|schema cache|does not exist|column/i.test(rpc.error.message ?? '')) {
    throw rpc.error;
  }

  const { data: row, error: fetchErr } = await supabase
    .from('clients')
    .select('id')
    .eq('onboarding_token', trimmed)
    .maybeSingle();

  if (fetchErr || !row) return false;

  const { error } = await supabase
    .from('clients')
    .update({
      preferences,
      family_members,
      onboarding_completed: true,
    })
    .eq('id', row.id);

  if (error) throw error;
  return true;
}

export function welcomePayloadFromProfile(row: WelcomeProfileRow | null): WelcomeOnboardingPayload {
  if (!row) return createEmptyWelcomePayload();
  return {
    preferences: row.preferences,
    family_members: row.family_members.length ? row.family_members : [],
    passport_docs: [],
  };
}

export const WELCOME_STEP_LABELS = [
  'أسلوب السفر',
  'أزياء السفر',
  'المرافقون',
] as const;
