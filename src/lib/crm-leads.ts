import type { SupabaseClient } from '@supabase/supabase-js';

export type CrmLeadRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone_wa: string;
  age: number | null;
  destinations: string[];
  travel_date: string | null;
  travel_days: number;
  travelers_count: number;
  budget: string | null;
  interests: string[];
  travel_style: string | null;
  daily_pace: string | null;
  walking_readiness: string | null;
  day_start_time: string | null;
  food_preferences: string[];
  accommodation_type: string[];
  final_thoughts: string;
  form_type: string;
  status?: string | null;
  referral_code?: string | null;
  created_at: string;
};

export function joinDestinations(destinations: string[] | null | undefined): string {
  if (!destinations?.length) return '—';
  return destinations.filter(Boolean).join(' · ');
}

export function formatTravelDateArabic(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return iso;
  }
}

export function formatRelativeTimeArabic(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';

  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return 'الآن';

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'الآن';
  if (minutes < 60) {
    if (minutes === 1) return 'منذ دقيقة';
    if (minutes === 2) return 'منذ دقيقتين';
    if (minutes <= 10) return `منذ ${minutes} دقائق`;
    return `منذ ${minutes} دقيقة`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    if (hours === 1) return 'منذ ساعة';
    if (hours === 2) return 'منذ ساعتين';
    if (hours <= 10) return `منذ ${hours} ساعات`;
    return `منذ ${hours} ساعة`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) return 'منذ يوم';
  if (days === 2) return 'منذ يومين';
  if (days <= 10) return `منذ ${days} أيام`;
  return `منذ ${days} يوم`;
}

export async function fetchNewCrmLeads(
  supabase: SupabaseClient,
  limit = 12,
): Promise<{ leads: CrmLeadRow[]; warning?: string }> {
  const withStatus = await supabase
    .from('leads')
    .select('*')
    .eq('status', 'new')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!withStatus.error) {
    return { leads: (withStatus.data as CrmLeadRow[]) ?? [] };
  }

  const msg = withStatus.error.message ?? '';
  if (msg.includes('status') || msg.includes('column')) {
    const fallback = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (fallback.error) {
      throw new Error(fallback.error.message || 'تعذر تحميل الطلبات الجديدة.');
    }
    return {
      leads: (fallback.data as CrmLeadRow[]) ?? [],
      warning: 'عمود status غير متوفر — يُعرض أحدث الطلبات. نفّذ supabase/sql/leads.sql المحدّث.',
    };
  }

  throw new Error(msg || 'تعذر تحميل الطلبات الجديدة.');
}
