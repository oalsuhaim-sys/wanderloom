import 'server-only';

import Anthropic from '@anthropic-ai/sdk';

import {
  buildGenerateProposalUserPrompt,
  extractClaudeProposalFromText,
  type ClaudeProposalPayload,
  type GenerateProposalAiRequest,
  WANDERLOOM_PROPOSAL_ENGINEER_SYSTEM,
} from '@/lib/ai-generate-proposal';

export type ClaudeProposalGenerationResult =
  | {
      ok: true;
      model: string;
      payload: ClaudeProposalPayload;
      rawPreview?: string;
    }
  | {
      ok: false;
      error: string;
      message: string;
      rawPreview?: string;
    };

/**
 * Call the project's Anthropic Claude integration for a full proposal JSON draft.
 */
export async function generateProposalWithClaude(
  input: GenerateProposalAiRequest,
): Promise<ClaudeProposalGenerationResult> {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim();
  if (!apiKey) {
    return {
      ok: false,
      error: 'missing_api_key',
      message: 'مفتاح Anthropic غير متوفر. أضف ANTHROPIC_API_KEY في .env.local / Vercel.',
    };
  }

  const model =
    (process.env.ANTHROPIC_PROPOSAL_MODEL ?? '').trim() ||
    (process.env.ANTHROPIC_ITINERARY_MODEL ?? '').trim() ||
    (process.env.ANTHROPIC_MODEL ?? '').trim() ||
    'claude-sonnet-4-5';

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model,
      max_tokens: 16384,
      temperature: 0.4,
      system: WANDERLOOM_PROPOSAL_ENGINEER_SYSTEM,
      messages: [
        {
          role: 'user',
          content: buildGenerateProposalUserPrompt(input),
        },
      ],
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    // Strip markdown fences before parsing (```json … ```)
    const rawText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const payload = extractClaudeProposalFromText(rawText, {
      startDate: input.travelDate,
    });

    if (!payload.itinerary.length && !payload.recommendedHotels.length) {
      console.error(
        '[generateProposalWithClaude] empty payload. stop_reason=',
        message.stop_reason,
        'raw slice:',
        text.slice(0, 500),
      );
      return {
        ok: false,
        error: 'empty_generation',
        message:
          message.stop_reason === 'max_tokens'
            ? 'انقطع رد Claude قبل اكتمال الـ JSON — أعد المحاولة أو قلّل عدد الأيام.'
            : 'تعذر تفسير رد Claude — لم يُرجع مساراً أو فنادق صالحة.',
        rawPreview: text.slice(0, 280),
      };
    }

    return {
      ok: true,
      model,
      payload,
      rawPreview: text.slice(0, 120),
    };
  } catch (error) {
    console.error('[generateProposalWithClaude]', error);
    const detail = error instanceof Error ? error.message : 'claude_request_failed';
    return {
      ok: false,
      error: 'claude_failed',
      message: `فشل توليد العرض عبر Claude: ${detail}`,
    };
  }
}
