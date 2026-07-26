import type { SupabaseClient } from '@supabase/supabase-js';

export type MarketingPublishUrgency = 'today' | 'tomorrow' | 'later';

export type MarketingPublishRadarItem = {
  id: string;
  campaign_name: string;
  content_category: string;
  scheduledAt: Date;
  urgency: MarketingPublishUrgency;
  statusLabel: string;
  media_type?: string;
};

export type MarketingPublishRadarResult = {
  items: MarketingPublishRadarItem[];
  error?: string;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(base: Date, days: number): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + days);
  return x;
}

export function classifyPublishUrgency(scheduledAt: Date, now = new Date()): MarketingPublishUrgency {
  const today = startOfDay(now).getTime();
  const tomorrow = startOfDay(addDays(now, 1)).getTime();
  const dayAfter = startOfDay(addDays(now, 2)).getTime();
  const t = scheduledAt.getTime();

  if (t >= today && t < tomorrow) return 'today';
  if (t >= tomorrow && t < dayAfter) return 'tomorrow';
  return 'later';
}

export function urgencyMeta(urgency: MarketingPublishUrgency): {
  emoji: string;
  label: string;
  badge: string;
  cardClass: string;
  dotClass: string;
} {
  if (urgency === 'today') {
    return {
      emoji: '🔴',
      label: 'ينشر اليوم',
      badge: 'عاجل (اليوم)',
      cardClass:
        'border-red-300/70 bg-gradient-to-br from-red-50/90 via-[#FEFDF9] to-white shadow-[0_0_20px_rgba(239,68,68,0.12)] ring-1 ring-red-200/60',
      dotClass: 'bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.65)]',
    };
  }
  if (urgency === 'tomorrow') {
    return {
      emoji: '🟡',
      label: 'مجدول لغد',
      badge: 'قريباً (غداً)',
      cardClass:
        'border-[#D4AF37]/45 bg-gradient-to-br from-[#FFFBF0] via-[#FEFDF9] to-white shadow-[0_0_16px_rgba(212,175,55,0.14)] ring-1 ring-[#D4AF37]/25',
      dotClass: 'bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.5)]',
    };
  }
  return {
    emoji: '⚪',
    label: 'لاحقاً',
    badge: 'لاحقاً',
    cardClass: 'border-[#1E2720]/10 bg-[#F6F4F0]/80 ring-1 ring-[#1E2720]/8',
    dotClass: 'bg-slate-300',
  };
}

export function formatPublishScheduleTime(date: Date): string {
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleString('ar-SA');
  }
}

function normalizeTimePart(raw: string): string {
  const s = raw.trim();
  if (!s) return '12:00:00';
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  return '12:00:00';
}

function parsePublishRow(raw: Record<string, unknown>, now: Date): MarketingPublishRadarItem | null {
  const id = raw.id != null ? String(raw.id) : '';
  if (!id) return null;

  const campaign_name = String(raw.campaign_name ?? '').trim() || 'حملة بدون اسم';
  const content_category = String(raw.content_category ?? 'أخرى').trim();

  const dateRaw = String(raw.publish_date ?? '').trim();
  if (!dateRaw) return null;

  const timeRaw = normalizeTimePart(String(raw.publish_time ?? '12:00'));
  const scheduledAt = new Date(`${dateRaw}T${timeRaw}`);
  if (Number.isNaN(scheduledAt.getTime())) return null;

  const urgency = classifyPublishUrgency(scheduledAt, now);

  return {
    id,
    campaign_name,
    content_category,
    scheduledAt,
    urgency,
    statusLabel: urgencyMeta(urgency).label,
    media_type: String(raw.media_type ?? '').trim() || undefined,
  };
}

export async function fetchMarketingPublishingRadar(
  supabase: SupabaseClient,
): Promise<MarketingPublishRadarResult> {
  const now = new Date();

  const { data, error } = await supabase
    .from('marketing_ai_prompts')
    .select('id, campaign_name, content_category, media_type, publish_date')
    .not('publish_date', 'is', null)
    .order('publish_date', { ascending: true })
    .limit(50);

  if (error) {
    return { items: [], error: error.message };
  }

  const items = ((data ?? []) as Record<string, unknown>[])
    .map((row) => parsePublishRow(row, now))
    .filter((item): item is MarketingPublishRadarItem => item != null)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  return { items };
}
