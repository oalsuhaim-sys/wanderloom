/**
 * Wanderloom content generator — prototype form options + structured Claude output.
 */

export {
  TARGET_AUDIENCES,
  PRODUCTION_FORMATS,
  PLATFORMS,
  DESTINATIONS,
  PHILOSOPHY_PILLARS,
  FUNNEL_STAGES,
  FALLBACK_GENERATOR_OPTIONS,
} from '@/lib/marketing-generator-options';

/** @deprecated Prefer PRODUCTION_FORMATS / TARGET_AUDIENCES from marketing-generator-options */
export const PRODUCTION_FORMAT_OPTIONS = [
  'السرد الصوتي على الأرشيف',
  'المقارنة البصرية Split-Screen',
  'الاستوديو + الكتاب',
  'التفكيك المالي بالجرافيك',
  'POV الحسّي',
  'السلاسل التفاعلية',
] as const;

export const PLATFORM_OPTIONS = [
  'إنستقرام',
  'يوتيوب',
  'تيك توك / شورتس',
  'منصة X',
] as const;

export const DESTINATION_OPTIONS = ['كوريا', 'اليابان', 'روسيا', 'أخرى'] as const;

export const FUNNEL_STAGE_OPTIONS = ['الوعي', 'الاهتمام', 'التحويل'] as const;

export const AUDIENCE_OPTIONS = [
  'مسافرون لأول مرة',
  'المجموعة النسائية',
  'عشاق الهدوء والتأمل',
] as const;

export const PHILOSOPHY_OPTIONS = [
  'تلقائي حسب الصيغة —',
  'بيع الشعور',
  'هندسة الهدوء',
] as const;

export const COLOR_PALETTE = ['#1C2E3A', '#27403A', '#9C7A3C', '#F4EFE6'] as const;

/** Default philosophy when «تلقائي حسب الصيغة» is selected. */
export function resolvePhilosophyForFormat(format: string, philosophy: string): string {
  if (philosophy && philosophy !== 'تلقائي حسب الصيغة —') return philosophy;
  if (format.includes('POV') || format.includes('الحس')) return 'هندسة الهدوء';
  if (format.includes('مالي') || format.includes('Split')) return 'بيع الشعور';
  if (format.includes('استوديو') || format.includes('كتاب')) return 'هندسة الهدوء';
  if (format.includes('مالييك')) return 'بيع الشعور';
  if (format.includes('سلاسل')) return 'بيع الشعور';
  return 'بيع الشعور';
}

export type ScriptBeat = {
  key: 'hook' | 'reveal' | 'feel' | 'soft_link';
  title: string;
  timing: string;
  direction: string;
  line: string;
};

export type DirectionTable = {
  video_sources: string;
  on_camera: string;
  format_note: string;
  voice_tone: string;
  asmr: string;
  music: string;
  color_grade: string;
  assets: string;
  color_palette: string[];
};

export type CtaBlock = {
  stage: string;
  text: string;
  direction_note: string;
  campaign_code: string;
  utm_url: string;
  lead_source: string;
};

export type WanderloomGeneratorResult = {
  id: string;
  idea_name: string;
  format: string;
  platform: string;
  destination: string;
  funnel_stage: string;
  audience: string;
  philosophy: string;
  topic: string;
  script_section: {
    beats: ScriptBeat[];
    alt_hooks: string[];
    full_script_text: string;
  };
  caption_section: {
    body: string;
    hashtags: string[];
  };
  direction_section: DirectionTable;
  cta_section: CtaBlock;
  /** Full markdown for content-table modal compatibility */
  script_markdown: string;
};

export const WANDERLOOM_GENERATOR_SYSTEM_PROMPT = `You are the lead content creator for Wanderloom (واندرلوم — الهندسة السياحية الفاخرة).

Return ONLY a valid JSON object (no markdown fences) matching this exact schema for ANY topic/platform:

{
  "id": "WL-XXXX",
  "idea_name": "عنوان الفكرة",
  "format": "...",
  "platform": "...",
  "destination": "...",
  "funnel_stage": "...",
  "audience": "...",
  "philosophy": "...",
  "topic": "...",
  "script_section": {
    "beats": [
      {
        "key": "hook",
        "title": "1. الخطّاف",
        "timing": "0 ث ← 3 ث",
        "direction": "وصف إخراجي قصير",
        "line": "النص المنطوق كلمة بكلمة"
      },
      {
        "key": "reveal",
        "title": "2. الكشف",
        "timing": "3 ث ← 10 ث",
        "direction": "...",
        "line": "..."
      },
      {
        "key": "feel",
        "title": "3. الإحساس",
        "timing": "10 ث ← 16 ث",
        "direction": "...",
        "line": "..."
      },
      {
        "key": "soft_link",
        "title": "4. الربط الناعم",
        "timing": "16 ث ← 20 ث",
        "direction": "...",
        "line": "..."
      }
    ],
    "alt_hooks": ["خطّاف بديل 1", "خطّاف بديل 2", "خطّاف بديل 3"],
    "full_script_text": "نص السكريبت كاملاً سطراً بسطر للنسخ"
  },
  "caption_section": {
    "body": "الكابشن الجاهز للنشر (فقرات عربية فاخرة)",
    "hashtags": ["#Wanderloom", "#واندرلوم"]
  },
  "direction_section": {
    "video_sources": "...",
    "on_camera": "...",
    "format_note": "...",
    "voice_tone": "...",
    "asmr": "...",
    "music": "...",
    "color_grade": "...",
    "assets": "...",
    "color_palette": ["#1C2E3A", "#27403A", "#9C7A3C", "#F4EFE6"]
  },
  "cta_section": {
    "stage": "الوعي|الاهتمام|التحويل",
    "text": "نص النداء",
    "direction_note": "ملاحظة إخراج للـ CTA",
    "campaign_code": "WL-XXXX",
    "utm_url": "https://wanderloomsa.com/?utm_source=...&utm_medium=...&utm_campaign=...",
    "lead_source": "content_generator"
  },
  "script_markdown": "# عنوان\\n\\n## ١. السكريبت كلمة بكلمة\\n..."
}

Rules:
- Arabic luxury travel tone — warm, precise, never loud or spammy.
- Fill every field; never leave placeholders.
- color_palette MUST be exactly ["#1C2E3A","#27403A","#9C7A3C","#F4EFE6"] unless a strong creative reason says otherwise (still keep 4 hex codes).
- script_markdown must include the classic 5-section Wanderloom Master Markdown for archival.
- Adapt beats timing slightly to format, but keep the 4 beat keys.`;

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function trimField(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    /* continue */
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* continue */
    }
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      /* continue */
    }
  }
  return {};
}

function defaultBeats(topic: string, destination: string): ScriptBeat[] {
  return [
    {
      key: 'hook',
      title: '1. الخطّاف',
      timing: '0 ث ← 3 ث',
      direction: 'لقطة افتتاحية تخطف الانتباه فوراً.',
      line: `هل تخيلت ${topic} في ${destination}… بهذه الدقّة؟`,
    },
    {
      key: 'reveal',
      title: '2. الكشف',
      timing: '3 ث ← 10 ث',
      direction: 'كشف تدريجي للمكان والإحساس.',
      line: `${destination} ليست مجرد وجهة — إنها هندسة إحساس.`,
    },
    {
      key: 'feel',
      title: '3. الإحساس',
      timing: '10 ث ← 16 ث',
      direction: 'إيقاع أبطأ · تفاصيل حسية.',
      line: 'لحظة مصمّمة لك… بهدوء، ودقّة، وذوق.',
    },
    {
      key: 'soft_link',
      title: '4. الربط الناعم',
      timing: '16 ث ← 20 ث',
      direction: 'انتقال ناعم لهوية Wanderloom.',
      line: 'واندرلوم — نصمّم الرحلة كما تُعاش… لا كما تُعرض.',
    },
  ];
}

export function buildFallbackGeneratorResult(input: {
  id?: string;
  format: string;
  platform: string;
  destination: string;
  funnel_stage: string;
  audience: string;
  philosophy: string;
  topic: string;
  idea_name?: string;
}): WanderloomGeneratorResult {
  const id = input.id?.trim() || `WL-${Date.now().toString().slice(-6)}`;
  const idea =
    input.idea_name?.trim() ||
    `${input.topic.trim().slice(0, 42) || 'فكرة Wanderloom'} — ${input.destination}`;
  const philosophy = resolvePhilosophyForFormat(input.format, input.philosophy);
  const beats = defaultBeats(input.topic || idea, input.destination);
  const full_script_text = beats.map((b) => `${b.title} (${b.timing})\n${b.line}`).join('\n\n');
  const hashtags = ['#Wanderloom', '#واندرلوم', `#${input.destination}`, '#سفر_فاخر'];
  const captionBody = `${idea}.

في Wanderloom نصمّم التجربة لا الجدول فقط — من أول إحساس حتى آخر تفصيلة.

${input.destination} بانتظارك… بأسلوب يليق بك.`;

  const campaign = id.replace(/\s+/g, '');
  const utm = `https://wanderloomsa.com/?utm_source=${encodeURIComponent(input.platform)}&utm_medium=social&utm_campaign=${encodeURIComponent(campaign)}&utm_content=${encodeURIComponent(input.funnel_stage)}`;

  const script_markdown = `# ${idea}

\`${id}\` · ${input.format} · ${input.platform} · ${input.destination} · ${input.funnel_stage}

---

## ١. السكريبت كلمة بكلمة
${beats
  .map(
    (b) => `### ${b.title} — \`${b.timing}\`
**الإخراج:** ${b.direction}
> ${b.line}`,
  )
  .join('\n\n')}

## ٢. الكابشن الجاهز للنشر
${captionBody}

## ٣. الهاشتاقات المقترحة
${hashtags.join(' ')}

## ٤. ملاحظات الإخراج والتصوير
- مصادر أرشيف فاخرة متناسقة مع ${input.format}
- نغمة صوت هادئة تناسب ${philosophy}

## ٥. دعوة الإجراء (CTA)
اكتب «مهتم» في التعليقات أو الرسائل — كود الحملة ${campaign}`;

  return {
    id,
    idea_name: idea,
    format: input.format,
    platform: input.platform,
    destination: input.destination,
    funnel_stage: input.funnel_stage,
    audience: input.audience,
    philosophy,
    topic: input.topic,
    script_section: {
      beats,
      alt_hooks: [
        'توقف. انظر. هذا الشعور… لك.',
        `${input.destination} تُعاش… لا تُروى فقط.`,
        'هل جاهز لرحلة بهندسة مختلفة؟',
      ],
      full_script_text,
    },
    caption_section: {
      body: captionBody,
      hashtags,
    },
    direction_section: {
      video_sources: 'أرشيف فاخر + لقطات حسية بطيئة',
      on_camera: input.format.includes('استوديو') ? 'ظهور مقدّم هادئ' : 'بدون ظهور / صوت فقط',
      format_note: input.format,
      voice_tone: 'دافئ · هامس · فاخر',
      asmr: 'تفاصيل قريبة: خطوات، مطر، فنجان، قماش',
      music: 'بيانو خفيف أو Pads سينمائية منخفضة',
      color_grade: 'تباين ناعم · ذهب زيتوني',
      assets: 'شعار Wanderloom · خطوط عربية أنيقة',
      color_palette: [...COLOR_PALETTE],
    },
    cta_section: {
      stage: input.funnel_stage,
      text:
        input.funnel_stage === 'التحويل'
          ? 'احجزي استشارة تصميم رحلتك الآن'
          : input.funnel_stage === 'الاهتمام'
            ? 'اكتشفي كيف نصمّم الإحساس قبل الجدول'
            : 'تابعي لتعرفي سر الهندسة السياحية الفاخرة',
      direction_note: 'أظهر CTA في آخر ثانيتين بدون صراخ بصري',
      campaign_code: campaign,
      utm_url: utm,
      lead_source: 'content_generator',
    },
    script_markdown,
  };
}

function parseBeat(raw: unknown, fallback: ScriptBeat): ScriptBeat {
  const row = asRecord(raw);
  return {
    key: (trimField(row.key, fallback.key) as ScriptBeat['key']) || fallback.key,
    title: trimField(row.title, fallback.title),
    timing: trimField(row.timing, fallback.timing),
    direction: trimField(row.direction, fallback.direction),
    line: trimField(row.line, fallback.line),
  };
}

export function parseGeneratorResult(
  rawText: string,
  fallbackInput: {
    id?: string;
    format: string;
    platform: string;
    destination: string;
    funnel_stage: string;
    audience: string;
    philosophy: string;
    topic: string;
    idea_name?: string;
  },
): WanderloomGeneratorResult {
  const fallback = buildFallbackGeneratorResult(fallbackInput);
  const parsed = asRecord(extractJsonObject(rawText));
  if (!Object.keys(parsed).length) return fallback;

  const scriptSection = asRecord(parsed.script_section);
  const captionSection = asRecord(parsed.caption_section);
  const directionSection = asRecord(parsed.direction_section);
  const ctaSection = asRecord(parsed.cta_section);

  const rawBeats = Array.isArray(scriptSection.beats) ? scriptSection.beats : [];
  const beats = fallback.script_section.beats.map((fb, i) =>
    parseBeat(rawBeats[i] ?? rawBeats.find((b) => asRecord(b).key === fb.key), fb),
  );

  const altHooks = Array.isArray(scriptSection.alt_hooks)
    ? scriptSection.alt_hooks.map((h) => String(h).trim()).filter(Boolean)
    : fallback.script_section.alt_hooks;

  const hashtags = Array.isArray(captionSection.hashtags)
    ? captionSection.hashtags.map((h) => {
        const t = String(h).trim();
        return t.startsWith('#') ? t : `#${t}`;
      })
    : fallback.caption_section.hashtags;

  const paletteRaw = Array.isArray(directionSection.color_palette)
    ? directionSection.color_palette.map((c) => String(c).trim()).filter(Boolean)
    : [];

  const full_script_text =
    trimField(scriptSection.full_script_text) ||
    beats.map((b) => `${b.title} (${b.timing})\n${b.line}`).join('\n\n');

  return {
    id: trimField(parsed.id, fallback.id),
    idea_name: trimField(parsed.idea_name, fallback.idea_name),
    format: trimField(parsed.format, fallback.format),
    platform: trimField(parsed.platform, fallback.platform),
    destination: trimField(parsed.destination, fallback.destination),
    funnel_stage: trimField(parsed.funnel_stage, fallback.funnel_stage),
    audience: trimField(parsed.audience, fallback.audience),
    philosophy: trimField(parsed.philosophy, fallback.philosophy),
    topic: trimField(parsed.topic, fallback.topic),
    script_section: {
      beats,
      alt_hooks: altHooks.length ? altHooks : fallback.script_section.alt_hooks,
      full_script_text,
    },
    caption_section: {
      body: trimField(captionSection.body, fallback.caption_section.body),
      hashtags: hashtags.length ? hashtags : fallback.caption_section.hashtags,
    },
    direction_section: {
      video_sources: trimField(
        directionSection.video_sources,
        fallback.direction_section.video_sources,
      ),
      on_camera: trimField(directionSection.on_camera, fallback.direction_section.on_camera),
      format_note: trimField(directionSection.format_note, fallback.direction_section.format_note),
      voice_tone: trimField(directionSection.voice_tone, fallback.direction_section.voice_tone),
      asmr: trimField(directionSection.asmr, fallback.direction_section.asmr),
      music: trimField(directionSection.music, fallback.direction_section.music),
      color_grade: trimField(directionSection.color_grade, fallback.direction_section.color_grade),
      assets: trimField(directionSection.assets, fallback.direction_section.assets),
      color_palette: paletteRaw.length >= 4 ? paletteRaw.slice(0, 4) : [...COLOR_PALETTE],
    },
    cta_section: {
      stage: trimField(ctaSection.stage, fallback.cta_section.stage),
      text: trimField(ctaSection.text, fallback.cta_section.text),
      direction_note: trimField(ctaSection.direction_note, fallback.cta_section.direction_note),
      campaign_code: trimField(ctaSection.campaign_code, fallback.cta_section.campaign_code),
      utm_url: trimField(ctaSection.utm_url, fallback.cta_section.utm_url),
      lead_source: trimField(ctaSection.lead_source, 'content_generator'),
    },
    script_markdown: trimField(parsed.script_markdown, fallback.script_markdown),
  };
}
