/**
 * Marketing prompts/captions must pass through unchanged — never truncate for UI.
 */
export function marketingFullText(value: unknown): string {
  if (value == null) return '';
  return typeof value === 'string' ? value : String(value);
}

const PROMPT_KEY_SKIP =
  /^(id|created_at|updated_at|category|content_category|media_type|status|sort_order|campaign|campaign_name|hashtags|video_url)$/i;

const CAPTION_KEY_SKIP =
  /^(id|created_at|updated_at|category|content_category|media_type|status|sort_order|campaign|campaign_name|hashtags|video_url|visual_prompt|prompt|prompt_text)$/i;

function looksLikeTruncatedPreview(text: string): boolean {
  const t = text.trim();
  return t.endsWith('...') || t.endsWith('…');
}

/** Longest non-empty field from explicit keys — no slicing. */
export function marketingLongestField(
  row: Record<string, unknown>,
  keys: readonly string[],
): string {
  let best = '';
  for (const key of keys) {
    const text = marketingFullText(row[key]);
    if (text.length > best.length) best = text;
  }
  return best;
}

/**
 * Longest prompt-like string on a Supabase row.
 * Scans known columns first, then any *prompt* / visual* keys,
 * then — if the best still looks like a preview ending in "..." —
 * picks the longest remaining string column (full copy often stored elsewhere).
 */
export function marketingLongestPromptFromRow(row: Record<string, unknown>): string {
  let best = marketingLongestField(row, MARKETING_PROMPT_ROW_KEYS);

  for (const [key, value] of Object.entries(row)) {
    if ((MARKETING_PROMPT_ROW_KEYS as readonly string[]).includes(key)) continue;
    if (!/prompt|برومبت|visual/i.test(key)) continue;
    const text = marketingFullText(value);
    if (text.length > best.length) best = text;
  }

  if (!looksLikeTruncatedPreview(best)) return best;

  for (const [key, value] of Object.entries(row)) {
    if (PROMPT_KEY_SKIP.test(key)) continue;
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const text = marketingFullText(value);
    if (text.length > best.length) best = text;
  }

  return best;
}

/** Longest caption-like string on a Supabase row. */
export function marketingLongestCaptionFromRow(row: Record<string, unknown>): string {
  let best = marketingLongestField(row, MARKETING_CAPTION_ROW_KEYS);

  for (const [key, value] of Object.entries(row)) {
    if ((MARKETING_CAPTION_ROW_KEYS as readonly string[]).includes(key)) continue;
    if (!/caption|كابشن|copy/i.test(key)) continue;
    const text = marketingFullText(value);
    if (text.length > best.length) best = text;
  }

  if (!looksLikeTruncatedPreview(best)) return best;

  for (const [key, value] of Object.entries(row)) {
    if (CAPTION_KEY_SKIP.test(key)) continue;
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const text = marketingFullText(value);
    if (text.length > best.length) best = text;
  }

  return best;
}

export const MARKETING_PROMPT_ROW_KEYS = [
  'prompt',
  'prompt_text',
  'visual_prompt',
  'visualPrompt',
] as const;

export const MARKETING_CAPTION_ROW_KEYS = ['caption', 'caption_text'] as const;
