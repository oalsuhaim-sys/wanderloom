import 'server-only';

import Anthropic from '@anthropic-ai/sdk';

import type { MarketingActiveGroupTrip } from '@/lib/marketing-active-group-trips';
import {
  buildMarketingCampaignUserPrompt,
  extractMarketingCampaignFromText,
  type MarketingCampaignMode,
  type MarketingCampaignResult,
  WANDERLOOM_MARKETING_CAMPAIGN_SYSTEM,
} from '@/lib/marketing-trip-campaigns';

export type GenerateMarketingCampaignResult =
  | { ok: true; model: string; campaign: MarketingCampaignResult }
  | { ok: false; error: string; message: string; rawPreview?: string };

export async function generateMarketingCampaignWithClaude(opts: {
  mode: MarketingCampaignMode;
  trip?: MarketingActiveGroupTrip | null;
  siteUrl?: string;
}): Promise<GenerateMarketingCampaignResult> {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim();
  if (!apiKey) {
    return {
      ok: false,
      error: 'missing_api_key',
      message: 'مفتاح Anthropic غير متوفر. أضف ANTHROPIC_API_KEY في البيئة.',
    };
  }

  const model =
    (process.env.ANTHROPIC_MARKETING_MODEL ?? '').trim() ||
    (process.env.ANTHROPIC_CONTENT_MODEL ?? '').trim() ||
    (process.env.ANTHROPIC_MODEL ?? '').trim() ||
    'claude-sonnet-4-5';

  const mode = opts.mode;
  const trip = opts.trip ?? null;
  const siteUrl = opts.siteUrl;

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model,
      max_tokens: 8192,
      temperature: 0.65,
      system: WANDERLOOM_MARKETING_CAMPAIGN_SYSTEM,
      messages: [
        {
          role: 'user',
          content: buildMarketingCampaignUserPrompt(mode, trip, { siteUrl }),
        },
      ],
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    const rawText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const campaign = extractMarketingCampaignFromText(rawText, {
      mode,
      tripId: trip?.id || mode,
      tripTitle:
        trip?.title ||
        (mode === 'brand'
          ? 'WanderLoom DNA'
          : mode === 'private'
            ? 'رحلات خاصة'
            : 'رحلات جماعية'),
      bookingUrl: trip?.bookingUrl || siteUrl || 'https://wanderloom.com',
    });

    if (!campaign.socialPosts.length && !campaign.videoScripts.length && !campaign.captions.length) {
      return {
        ok: false,
        error: 'empty_generation',
        message: 'تعذر تفسير رد Claude — لم تُرجع منشورات أو سكربتات صالحة.',
        rawPreview: text.slice(0, 280),
      };
    }

    return { ok: true, model, campaign };
  } catch (error) {
    console.error('[generateMarketingCampaignWithClaude]', error);
    const detail = error instanceof Error ? error.message : 'claude_request_failed';
    return {
      ok: false,
      error: 'claude_failed',
      message: `فشل توليد الحملة: ${detail}`,
    };
  }
}
