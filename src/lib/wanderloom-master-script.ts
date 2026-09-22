/**
 * Wanderloom Master Script Format — single source for AI prompts + seed scripts.
 * All marketing scripts (hardcoded + Claude-generated) must follow this 5-section Markdown.
 */

export const WANDERLOOM_MASTER_SCRIPT_SYSTEM_PROMPT = `You are the lead content creator for Wanderloom (واندرلوم - الهندسة السياحية الفاخرة).
Whenever generating a script, you MUST output the response using this EXACT Markdown structure with all 5 sections:

# [عنوان الفكرة]

\`[ID]\` · [الصيغة] · [المنصّة] · [الوجهة] · [المرحلة]

---

## ١. السكريبت كلمة بكلمة
### 1. الخطّاف — \`0 ث ← 3 ث\`
**الإخراج:** ...
> [النص الرئيسي]
<sub>بدائل: ...</sub>

### 2. الكشف — \`3 ث ← 10 ث\`
**الإخراج:** ...
> [النص الرئيسي]
<sub>بدائل: ...</sub>

### 3. الإحساس — \`10 ث ← 16 ث\`
**الإخراج:** ...
> [النص الرئيسي]
<sub>بدائل: ...</sub>

### 4. الربط الناعم — \`16 ث ← 20 ث\`
**الإخراج:** ...
> [النص الرئيسي]
<sub>بدائل: ...</sub>

## ٢. الكابشن الجاهز للنشر
[كابشن عربي جاهز للنسخ — فقرات قصيرة، فاخر، دافئ، بدون مبالغة]

## ٣. الهاشتاقات المقترحة
#وسم1 #وسم2 #وسم3 ...

## ٤. ملاحظات الإخراج والتصوير
- زاوية / إضاءة / حركة كاميرا
- تفاصيل بصرية تدعم العمود الفلسفي

## ٥. دعوة الإجراء (CTA)
[سطر CTA واضح + أي رابط/خطوة تالية للمسافر]

Rules:
- Write in polished Arabic suitable for luxury travel social content.
- Fill EVERY section — never leave placeholders like "..." or "[النص الرئيسي]" in the final answer.
- Adapt timing beats and tone to the requested format + platform, but KEEP the same 5-section headings.
- Destination may be inferred from the topic when not explicit.
- Do not wrap the whole document in a markdown code fence.`;

export type WanderloomMasterScriptInput = {
  id: string;
  idea: string;
  format: string;
  platform: string;
  stage?: string;
  destination?: string;
  audience?: string;
  theme?: string;
  topic?: string;
  /** Optional beat / caption overrides for curated seed rows */
  beats?: {
    hook?: { direction: string; line: string; alts?: string };
    reveal?: { direction: string; line: string; alts?: string };
    feel?: { direction: string; line: string; alts?: string };
    softLink?: { direction: string; line: string; alts?: string };
  };
  caption?: string;
  hashtags?: string[];
  visualNotes?: string[];
  cta?: string;
};

function beatBlock(
  title: string,
  timing: string,
  direction: string,
  line: string,
  alts: string,
): string {
  return `### ${title} — \`${timing}\`
**الإخراج:** ${direction}
> ${line}
<sub>بدائل: ${alts}</sub>`;
}

/**
 * Build a complete 5-section Wanderloom Master Script (Markdown).
 */
export function buildWanderloomMasterScript(input: WanderloomMasterScriptInput): string {
  const idea = input.idea.trim() || 'فكرة محتوى Wanderloom';
  const id = input.id.trim() || 'WL-NEW';
  const format = input.format.trim() || 'ريلز';
  const platform = input.platform.trim() || 'Instagram';
  const destination = (input.destination ?? 'وجهة Wanderloom').trim();
  const stage = (input.stage ?? 'سكريبت').trim();
  const theme = (input.theme ?? '').trim();
  const audience = (input.audience ?? '').trim();
  const topic = (input.topic ?? idea).trim();

  const hook = input.beats?.hook ?? {
    direction: 'لقطة افتتاحية سينمائية تخطف الانتباه خلال أول 3 ثوانٍ.',
    line: `هل جربت ${topic} بالطريقة التي تليق بك؟`,
    alts: 'توقف. انظر. هذا الشعور… لك.',
  };
  const reveal = input.beats?.reveal ?? {
    direction: 'كشف تدريجي للمكان/التجربة مع تفاصيل فاخرة وهادئة.',
    line: `${destination} ليست مجرد وجهة — إنها هندسة إحساس.`,
    alts: 'هنا تبدأ الهندسة السياحية الفاخرة.',
  };
  const feel = input.beats?.feel ?? {
    direction: 'لقطة شعورية بطيئة: ضوء، صوت، إيقاع تنقّل راقٍ.',
    line:
      theme || audience
        ? `لحظة مصمّمة لـ${audience || 'المسافر'} ضمن عمود «${theme || 'بيع الشعور'}».`
        : 'لحظة مصمّمة لك… بهدوء، ودقّة، وذوق.',
    alts: 'هذا ليس محتوى… هذا تذكير بما تستحقه رحلتك.',
  };
  const softLink = input.beats?.softLink ?? {
    direction: 'انتقال ناعم إلى هوية Wanderloom دون صراخ بيعي.',
    line: 'واندرلوم — نصمّم الرحلة كما تُعاش… لا كما تُعرض.',
    alts: 'اترك التخطيط لنا… وعِش اللحظة.',
  };

  const caption =
    input.caption?.trim() ||
    `${idea}.

في Wanderloom نصمّم التجربة لا الجدول فقط — من أول إحساس حتى آخر تفصيلة.

${destination} بانتظارك… بأسلوب يليق بك.`;

  const hashtags =
    input.hashtags?.length
      ? input.hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ')
      : '#Wanderloom #واندرلوم #سفر_فاخر #هندسة_سياحية #LuxuryTravel';

  const visualNotes = (input.visualNotes?.length
    ? input.visualNotes
    : [
        'إضاءة ذهبية ناعمة — تجنّب الإفراط في الفلاتر.',
        'حركة كاميرا بطيئة ومستقرة (gimbal).',
        'تفاصيل قريبة: فنجان، انعكاس مطر، خطوة على حجر مبلل.',
        `أظهر الصيغة (${format}) بما يناسب ${platform}.`,
      ]
  )
    .map((n) => `- ${n}`)
    .join('\n');

  const cta =
    input.cta?.trim() ||
    'احجز استشارة تصميم رحلتك مع Wanderloom — واكتب «مهتم» في التعليقات أو الرسائل.';

  return `# ${idea}

\`${id}\` · ${format} · ${platform} · ${destination} · ${stage}

---

## ١. السكريبت كلمة بكلمة
${beatBlock('1. الخطّاف', '0 ث ← 3 ث', hook.direction, hook.line, hook.alts ?? '—')}

${beatBlock('2. الكشف', '3 ث ← 10 ث', reveal.direction, reveal.line, reveal.alts ?? '—')}

${beatBlock('3. الإحساس', '10 ث ← 16 ث', feel.direction, feel.line, feel.alts ?? '—')}

${beatBlock('4. الربط الناعم', '16 ث ← 20 ث', softLink.direction, softLink.line, softLink.alts ?? '—')}

## ٢. الكابشن الجاهز للنشر
${caption}

## ٣. الهاشتاقات المقترحة
${hashtags}

## ٤. ملاحظات الإخراج والتصوير
${visualNotes}

## ٥. دعوة الإجراء (CTA)
${cta}`;
}

/** Extract the H1 idea title from a master script markdown body. */
export function extractMasterScriptIdea(script: string): string {
  const match = script.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || '';
}

/** Extract section ٢ caption block when present. */
export function extractMasterScriptCaption(script: string): string {
  const match = script.match(
    /##\s*٢\.\s*الكابشن الجاهز للنشر\s*([\s\S]*?)(?=\n##\s*٣\.|$)/,
  );
  return match?.[1]?.trim() || '';
}

/** Extract section ٥ CTA when present. */
export function extractMasterScriptCta(script: string): string {
  const match = script.match(/##\s*٥\.\s*دعوة الإجراء[^\n]*\s*([\s\S]*?)(?=\n##\s*|$)/);
  return match?.[1]?.trim() || '';
}

/** Extract hashtags from section ٣. */
export function extractMasterScriptHashtags(script: string): string[] {
  const match = script.match(
    /##\s*٣\.\s*الهاشتاقات المقترحة\s*([\s\S]*?)(?=\n##\s*٤\.|$)/,
  );
  const block = match?.[1] ?? '';
  return block
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => t.startsWith('#'));
}
