/**
 * Claude AI — WanderLoom marketing campaign generator (brand, private, group).
 */

import { extractJsonObject } from '@/lib/ai-generate-itinerary';
import type { MarketingActiveGroupTrip } from '@/lib/marketing-active-group-trips';

export type MarketingCampaignMode = 'brand' | 'private' | 'group';

export type MarketingSocialPost = {
  platform: string;
  body: string;
  hashtags: string[];
  scheduledHint: string;
};

export type MarketingVideoScript = {
  title: string;
  platform: string;
  visualHook: string;
  voiceover: string;
  onScreenCta: string;
  durationHint: string;
};

export type MarketingCaption = {
  label: string;
  text: string;
  bookingUrl: string;
};

export type MarketingCampaignResult = {
  tripId: string;
  tripTitle: string;
  campaignTitle: string;
  summary: string;
  socialPosts: MarketingSocialPost[];
  videoScripts: MarketingVideoScript[];
  captions: MarketingCaption[];
  mode?: MarketingCampaignMode;
};

const JSON_SCHEMA_HINT = `Schema:
{
  "campaign_title": "",
  "summary": "",
  "social_posts": [
    { "platform": "instagram|twitter|x", "body": "", "hashtags": [], "scheduled_hint": "" }
  ],
  "video_scripts": [
    {
      "title": "",
      "platform": "reel|tiktok",
      "visual_hook": "",
      "voiceover": "",
      "on_screen_cta": "",
      "duration_hint": "15s|30s"
    }
  ],
  "captions": [
    { "label": "", "text": "", "booking_url": "" }
  ]
}`;

export const WANDERLOOM_MARKETING_CAMPAIGN_SYSTEM = `You are WanderLoom's Senior Marketing Creative Director for Saudi/Gulf travelers.

Brand Voice — WanderLoom:
- Inspiring, premium travel experience
- Friendly yet professional Modern Standard Arabic (with light Gulf warmth)
- Never cheap, never spammy; VIP curiosity and wanderlust
- Short, scroll-stopping hooks; concrete sensory details
- Always reflect WanderLoom's DNA travel methodology when relevant (personalized Travel DNA, curated paths, human concierge)

CRITICAL OUTPUT RULE:
Respond ONLY with valid, raw JSON (no markdown fences, no explanatory text).
${JSON_SCHEMA_HINT}

Rules:
- Exactly 3 social_posts (mix Instagram + Twitter/X), with emojis and tailored Arabic/English hashtags.
- Exactly 2 video_scripts (reel/TikTok): Visual hook + Voiceover + On-screen CTA.
- captions: ready-to-copy schedule captions; include booking/site link when provided.
- All primary copy in Arabic; hashtags may mix AR/EN.
- Adapt tone to the campaign MODE in the user message.
- Keep JSON compact and complete.`;

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function normalizeMarketingCampaignMode(raw: unknown): MarketingCampaignMode {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (v === 'brand' || v === 'dna' || v === 'brand_dna') return 'brand';
  if (v === 'private' || v === 'custom' || v === 'individual') return 'private';
  return 'group';
}

function siteBookingFallback(url?: string): string {
  const trimmed = String(url ?? '').trim();
  if (trimmed) return trimmed;
  return 'https://wanderloom.com';
}

export function buildMarketingCampaignUserPrompt(
  mode: MarketingCampaignMode,
  trip?: MarketingActiveGroupTrip | null,
  opts?: { siteUrl?: string },
): string {
  const siteUrl = siteBookingFallback(opts?.siteUrl || trip?.bookingUrl);

  if (mode === 'brand') {
    return [
      'MODE: brand — تسويق البراند والروح (Brand & DNA Concept)',
      'Goal: Introduce WanderLoom’s unique DNA travel methodology — not a single trip.',
      'Themes: Travel DNA personality matching, curated private paths, Gulf travelers discovering themselves through journeys, human + AI concierge.',
      'Tone: Storytelling, brand manifesto energy, inspirational — avoid hard sell urgency.',
      `Primary link for captions: ${siteUrl}`,
      'Audience: سعوديون وخليجيون يكتشفون أسلوب سفر يناسب شخصيتهم.',
      '',
      'Generate a full WanderLoom BRAND / DNA marketing campaign JSON now.',
      'Respond ONLY with valid, raw JSON (no markdown fences).',
    ].join('\n');
  }

  if (mode === 'private') {
    return [
      'MODE: private — رحلات الأفراد والمسارات الخاصة (Custom & Private Trips)',
      'Goal: Market customized itineraries — couples, family luxury, smart-economy private packages.',
      'Themes: Tailor-made days, privacy, flexibility, DNA-matched routes, no group schedule pressure.',
      'Tone: Intimate, premium, solution-oriented (“رحلتك على مقاسك”). Soft CTA to request a private quote.',
      `Primary link for captions: ${siteUrl}`,
      'Audience: عائلات وأزواج وعملاء VIP يريدون مساراً خاصاً.',
      '',
      'Generate a full WanderLoom CUSTOM / PRIVATE trip marketing campaign JSON now.',
      'Respond ONLY with valid, raw JSON (no markdown fences).',
    ].join('\n');
  }

  // group
  if (!trip) {
    return [
      'MODE: group — رحلات الجروبات المتاحة',
      'No specific trip row was provided. Write a generic urgent group-trip booking campaign for WanderLoom open seats.',
      `Primary link: ${siteUrl}`,
      'Respond ONLY with valid, raw JSON (no markdown fences).',
    ].join('\n');
  }

  const seats =
    trip.openSeats != null
      ? `${trip.openSeats} مقعد متاح من ${trip.maxSeats}`
      : trip.maxSeats > 0
        ? `سعة ${trip.maxSeats}`
        : 'مقاعد محدودة';

  return [
    'MODE: group — رحلات الجروبات المتاحة (urgent booking / open seats)',
    `Trip id: ${trip.id}`,
    `Trip name (AR): ${trip.title}`,
    `Trip name (EN): ${trip.titleEn || 'n/a'}`,
    `Destination / theme: ${trip.destination}`,
    `Dates: ${trip.datesLabel || 'قريباً'}`,
    `Start: ${trip.startDate || '?'} · End: ${trip.endDate || '?'}`,
    `Price: ${trip.price || 'حسب الباقة'}`,
    `Seats: ${seats}`,
    `Badge: ${trip.badge || 'n/a'}`,
    `Highlights: ${trip.highlights.join(' · ') || 'n/a'}`,
    `Description: ${trip.description || 'n/a'}`,
    'Tone: Urgent but premium — remaining seats, dates, FOMO without spam.',
    `Target audience: سعوديون وخليجيون يبحثون عن رحلات جماعية فاخرة/ملهمة`,
    `Booking link (MUST appear in captions): ${trip.bookingUrl}`,
    '',
    'Generate a full WanderLoom GROUP trip marketing campaign JSON for this trip now.',
    'Respond ONLY with valid, raw JSON (no markdown fences).',
  ].join('\n');
}

function parseHashtags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((h) => String(h ?? '').trim()).filter(Boolean).slice(0, 12);
  }
  const text = String(raw ?? '').trim();
  if (!text) return [];
  return text
    .split(/[\s,،]+/)
    .map((h) => (h.startsWith('#') ? h : `#${h}`))
    .filter((h) => h.length > 1)
    .slice(0, 12);
}

export function parseMarketingCampaignPayload(
  payload: unknown,
  context: {
    mode: MarketingCampaignMode;
    tripId: string;
    tripTitle: string;
    bookingUrl: string;
  },
): MarketingCampaignResult {
  const root = asRecord(payload);
  const bookingUrl = context.bookingUrl || siteBookingFallback();

  const socialRaw = Array.isArray(root.social_posts)
    ? root.social_posts
    : Array.isArray(root.socialPosts)
      ? root.socialPosts
      : [];
  const socialPosts: MarketingSocialPost[] = socialRaw
    .map((item) => {
      const row = asRecord(item);
      const body = String(row.body ?? row.text ?? row.caption ?? '').trim();
      if (!body) return null;
      return {
        platform: String(row.platform ?? 'instagram').trim() || 'instagram',
        body,
        hashtags: parseHashtags(row.hashtags ?? row.tags),
        scheduledHint: String(row.scheduled_hint ?? row.scheduledHint ?? '').trim(),
      };
    })
    .filter((x): x is MarketingSocialPost => x != null)
    .slice(0, 6);

  const scriptsRaw = Array.isArray(root.video_scripts)
    ? root.video_scripts
    : Array.isArray(root.videoScripts)
      ? root.videoScripts
      : [];
  const videoScripts: MarketingVideoScript[] = scriptsRaw
    .map((item) => {
      const row = asRecord(item);
      const voiceover = String(row.voiceover ?? row.voice_over ?? row.script ?? '').trim();
      const visualHook = String(row.visual_hook ?? row.visualHook ?? row.hook ?? '').trim();
      if (!voiceover && !visualHook) return null;
      return {
        title: String(row.title ?? 'ريل').trim() || 'ريل',
        platform: String(row.platform ?? 'reel').trim() || 'reel',
        visualHook,
        voiceover,
        onScreenCta: String(row.on_screen_cta ?? row.onScreenCta ?? row.cta ?? '').trim(),
        durationHint: String(row.duration_hint ?? row.durationHint ?? '30s').trim() || '30s',
      };
    })
    .filter((x): x is MarketingVideoScript => x != null)
    .slice(0, 4);

  const captionsRaw = Array.isArray(root.captions) ? root.captions : [];
  let captions: MarketingCaption[] = captionsRaw
    .map((item, idx) => {
      const row = asRecord(item);
      const text = String(row.text ?? row.body ?? row.caption ?? '').trim();
      if (!text) return null;
      const url = String(row.booking_url ?? row.bookingUrl ?? bookingUrl).trim();
      return {
        label: String(row.label ?? `تعليق ${idx + 1}`).trim() || `تعليق ${idx + 1}`,
        text: text.includes(url) ? text : `${text}\n\n🔗 ${url}`,
        bookingUrl: url || bookingUrl,
      };
    })
    .filter((x): x is MarketingCaption => x != null)
    .slice(0, 6);

  if (!captions.length && socialPosts.length) {
    captions = socialPosts.slice(0, 3).map((p, idx) => ({
      label: `جاهز للجدولة ${idx + 1}`,
      text: [p.body, p.hashtags.join(' '), `🔗 ${bookingUrl}`].filter(Boolean).join('\n\n'),
      bookingUrl,
    }));
  }

  const defaultTitle =
    context.mode === 'brand'
      ? 'حملة البراند والـ DNA'
      : context.mode === 'private'
        ? 'حملة الرحلات الخاصة'
        : `حملة ${context.tripTitle}`;

  return {
    tripId: context.tripId,
    tripTitle: context.tripTitle,
    campaignTitle:
      String(root.campaign_title ?? root.campaignTitle ?? root.title ?? '').trim() || defaultTitle,
    summary: String(root.summary ?? '').trim(),
    socialPosts,
    videoScripts,
    captions,
    mode: context.mode,
  };
}

export function extractMarketingCampaignFromText(
  text: string,
  context: {
    mode: MarketingCampaignMode;
    tripId: string;
    tripTitle: string;
    bookingUrl: string;
  },
): MarketingCampaignResult {
  const cleaned = String(text ?? '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const parsed = extractJsonObject(cleaned);
  return parseMarketingCampaignPayload(parsed, context);
}
