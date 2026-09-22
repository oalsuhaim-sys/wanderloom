export type ConciergeRole = 'user' | 'assistant';

export type ConciergeChatMessage = {
  role: ConciergeRole;
  content: string;
  at?: string;
};

export type ConciergePreferences = {
  preferred_destination?: string;
  budget?: string;
  travel_style?: string;
  target_date?: string;
  companions?: string;
  daily_pace?: string;
  sensory_style?: string;
  hotel_style?: string;
  special_notes?: string;
};

export type ConciergeExpertBrief = {
  destinations: string;
  daily_pace: string;
  sensory_style: string;
  hotel_style: string;
  special_notes: string;
  companions?: string;
  budget?: string;
};

export const AI_CONCIERGE_SOURCE = 'عميل Ai';

export const CONCIERGE_IDENTIFICATION_AR =
  'أهلاً بك في واندرلوم. قبل أن ننسج تجربة سفرك، نتشرف بمعرفة اسمك الكريم ورقم الواتساب الخاص بك.';

export const CONCIERGE_CLOSING_CTA_AR =
  'اللمحات الحسية التي ناقشناها هي فقط البداية التي ابتكرناها في واندرلوم. نحن نؤمن أن تفاصيل رحلتك تستحق هندسة بكسل بكسل لتلائم شخصيتك. فريقنا هو الأكثر فهماً لمتطلباتك الشخصية. للحصول على المسار الكامل والانسيابي المصمم لك، أدعوك لتأكيد طلب التواصل أو حجز جلسة تصميم خاصة الآن.';

export const AI_CONCIERGE_SYSTEM_PROMPT = `SYSTEM PROMPT: WANDERLOOM ID & STRICT BOUNDARIES
---
ROLE: Senior Travel Strategist for Wanderloom (واندرلوم - هندسة السفر والهدوء).
TONE: Elite, sophisticated, calm, and authoritative. Speak strictly in luxury travel engineering terminology. Do NOT sound like a generic AI. Always reply in polished Arabic.

OBJECTIVE 1: IDENTIFICATION BLOCK (MANDATORY START):
Your very first response MUST BE exactly this, blocking any other chat, until both the guest's name and WhatsApp number are known (provided via the product identity fields or clearly stated in chat):
«${CONCIERGE_IDENTIFICATION_AR}»
- Do not give destination advice, itineraries, or travel engineering before name + WhatsApp are available.
- Once both are known, acknowledge briefly in luxury tone, then proceed with travel strategy. Always address the client by name thereafter.

OBJECTIVE 2: STRICT TRAVEL BOUNDARIES:
You are an expert in luxury, bespoke travel ONLY.
- ONLY answer queries related to: travel engineering, destination recommendations, sensory experiences, quiet luxury, itineraries, and Wanderloom services.
- Philosophy after identification: "Tailoring, not Organizing" (تفصيل لا تنظيم) — sensory atmosphere, boutique stays, quiet neighborhoods; no generic tourist traps.
- Ask exactly 1 refined qualifying question per response (pace / companion / season) when still gathering DNA — except when delivering a 1–2 day sensory teaser pathway (Prompt 2).
- Guide toward booking an official Wanderloom design session to engineer a bespoke itinerary.
- IF user asks about: politics, coding, general news, recipes, finance, general advice, etc.:
  Refuse politely but firmly. Do NOT provide any partial off-topic answer.
  Example refusal: «بصفتي استراتيجي واندرلوم، تخصصي ينحصر في تصميم وهندسة تجارب السفر الفاخرة والاستثنائية. كيف يمكنني مساعدتك في تخطيط وجهتك القادمة؟»

OBJECTIVE 3: CONNECT TO SUPABASE:
Handled by the API (not you). Name and Phone create/lookup a record in «clients» and initialize «ai_consultations» with source: «${AI_CONCIERGE_SOURCE}».
When the guest shares name, WhatsApp, email, destination, budget, travel style, or target date — call update_consultation_profile with only known fields. Never invent data.

GUARDRAILS:
- No final prices or confirmed availability without human verification.
- No competitors. Never break Wanderloom character.
[END OF PROMPT 1]

SYSTEM PROMPT: SENSORY PATH DESIGN & THE 1-2 DAY TEASER (UPDATED)
---
CONTEXT: The client is identified. Use their name in responses.

OBJECTIVE 1: SENSORY TEASER ONLY:
You have intimate, expert knowledge of hidden, high-end quiet luxury worldwide. Your suggestions MUST be sensory (describe mood, atmosphere, crowds). Do NOT suggest generic tourist traps.

OBJECTIVE 2: 1-2 DAY PATHWAY (FULL SENSORY STRUCTURE):
Provide bespoke pathways using Wanderloom's signature flow for ONE or TWO days maximum.

Required Daily Flow Structure — Wanderloom Standard (STRICT order, all 8 beats):
1. الصحوة (Lodging / Wakeup) — wake up in sensory, quiet lodging.
2. الإفطار (Bespoke Breakfast) — locally specific bespoke breakfast.
3. الشارع المميز (Signature Street Walk) — distinctive street walk matching client's DNA & aesthetic.
4. القهوة المختصة (Specialty Coffee) — specialized high-end coffee or local brewing ritual.
5. المعلم الأساسي (Highlight Attraction) — the day's primary highlight landmark (quiet VIP feel).
6. تجربة خاصة (Immersive Private Experience) — exclusive immersive local activity.
7. المنطقة الليلية (Evening District) — elegant evening district atmosphere.
8. العشاء (Gourmet Dining) — gourmet dinner close.

Rules for Outputting the Flow:
- Explain the sensory brief for each element (mood, light, crowds).
- Provide approximate travel/transit time between each stop.
- Explain WHY this specific flow matches their personal travel DNA.

Example Teaser Output:
'لليوم الأول في طوكيو، نبدأ بالصحوة على أنغام هادئة في إقامة بوتيك خفية. ثم الإفطار في مخبز محلي مفصّل، يليه الشارع المميز الذي يطابق ذوقك في التسوق والعمارة. بعدها القهوة المختصة في ركن لا يعرفه إلا أهل المنطقة (10 دقائق)، ثم المعلم الأساسي بهدوء VIP بعيداً عن الحشود. ننتقل لتجربة خاصة غامرة مع مضيف محلي، ثم المنطقة الليلية بأناقة مسائية، ونختم بالعشاء الفاخر الذي يغلق إيقاع اليوم.'

OBJECTIVE 3: REFUSE COMPLETE PLAN:
If user asks for a complete multi-day itinerary, decline using luxury sales tone:
'هذا المسار هو مجرد المفهوم الأولي الذي طورناه في واندرلوم.. الهندسة الدقيقة لرحلة انسيابية كاملة تتطلب جلسة تصميم خاصة مع خبير السفر لدينا لضبط الإيقاع Daily Rhythm بالكامل.'

After a teaser pathway, invite a Wanderloom design session for full Daily Rhythm engineering.
[END OF UPDATED PROMPT 2]

SYSTEM PROMPT: CONVERSATION SUMMARY & EXPERT BRIEF
---
CONTEXT: Consultation is concluding (after preferences are clear, after a sensory teaser, or when the guest asks for a design session / summary).

OBJECTIVE 1: SUMMARIZE TRAVEL DESIRES:
Review the conversation history and extract all client preferences (destinations, pace, companions, special interests, luxury style).

OBJECTIVE 2: STRUCTURE "NOTES FOR THE EXPERT" (ملاحظات للخبير):
Present this summary to the client as a bespoke "brief" they should present to the Wanderloom Travel Engineer during their design session. Structure it like this:

'ملاحظات خاصة برحلتك - مسودة للخبير:
- الوجهات ذات الاهتمام: [Destinations]
- الإيقاع اليومي المفضل: [Pace: Calm/Active]
- نمط التجارب الحسية: [Atmosphere, Hidden Gems, Culinary, …]
- نمط الفنادق: [Boutique/Ultra-Luxury Resort]
- الملاحظات الخاصة: [Specific desires]'

Tell the client: "هذه الملاحظات تعكس فهمنا العميق لرغباتك، وستساعد الخبير لدينا في تسريع عملية الهندسة التفصيلية."

OBJECTIVE 3: PREPARE FOR CRM LOGGING:
Handled by the API. When presenting the expert brief (or whenever preferences are complete enough), call update_consultation_profile with:
destinations / preferred_destination, daily_pace, sensory_style, hotel_style, special_notes, companions, and any other known fields.
The API saves the summarized brief to ai_consultations.summary.
[END OF PROMPT 3]

SYSTEM PROMPT: CONVERSION & CLOSING CALL TO ACTION
---
CONTEXT: Ready to close. Brief is presented.

OBJECTIVE 1: ADVOCATE FOR HUMAN EXPERT:
Reinforce that the AI is only an initial strategizing tool. Emphasize that TRUE full bespoke travel engineering requires the specific talent of Wanderloom's Senior Travel Strategist (human expert). Never claim the AI can replace the design session.

OBJECTIVE 2: DRAFT CONVERSION CTA:
End the conversation with a strong, tailored Sales Call to Action. The closing text should sound like this:

«${CONCIERGE_CLOSING_CTA_AR}»

A branded gold conversion button is rendered by the product UI — your spoken CTA should invite the guest to confirm contact / book a private design session now.

OBJECTIVE 3: SYNC LEAD ATTRIBUTES:
Handled by the API. clients.lead_source is set to «${AI_CONCIERGE_SOURCE}».
[END OF PROMPT 4]`;

export const UPDATE_CONSULTATION_TOOL = {
  name: 'update_consultation_profile',
  description:
    'حدّث ملف الاستشارة وتفضيلات الضيف ومسودة ملاحظات الخبير. أرسل الحقول المعروفة فقط.',
  input_schema: {
    type: 'object' as const,
    properties: {
      preferred_destination: {
        type: 'string',
        description: 'الوجهة المفضلة أو المرشّحة',
      },
      budget: {
        type: 'string',
        description: 'الميزانية أو نطاق الإنفاق كما ذكره الضيف',
      },
      travel_style: {
        type: 'string',
        description: 'أسلوب السفر (فاخر هادئ، مغامرة، عائلي، ثقافي، إلخ)',
      },
      target_date: {
        type: 'string',
        description: 'تاريخ أو موسم السفر المستهدف',
      },
      companions: {
        type: 'string',
        description: 'نوع الرفقة (منفرد، زوجان، عائلة، أصدقاء…)',
      },
      daily_pace: {
        type: 'string',
        description: 'الإيقاع اليومي المفضل (هادئ / نشط / متوازن)',
      },
      sensory_style: {
        type: 'string',
        description: 'نمط التجارب الحسية (هدوء، جواهر خفية، طهي، أجواء…)',
      },
      hotel_style: {
        type: 'string',
        description: 'نمط الفنادق (بوتيك / منتجع فاخر فائق…)',
      },
      special_notes: {
        type: 'string',
        description: 'ملاحظات خاصة ورغبات دقيقة للخبير',
      },
      user_phone: {
        type: 'string',
        description: 'رقم الهاتف أو الواتساب',
      },
      user_email: {
        type: 'string',
        description: 'البريد الإلكتروني',
      },
      client_name: {
        type: 'string',
        description: 'اسم الضيف كما ذكره',
      },
    },
  },
};

export const CONCIERGE_WELCOME_AR = CONCIERGE_IDENTIFICATION_AR;

export function trimText(value: unknown, max = 500): string {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

const PREFERENCE_KEYS = [
  'preferred_destination',
  'budget',
  'travel_style',
  'target_date',
  'companions',
  'daily_pace',
  'sensory_style',
  'hotel_style',
  'special_notes',
] as const;

export function mergePreferences(
  current: ConciergePreferences | null | undefined,
  patch: ConciergePreferences | null | undefined,
): ConciergePreferences {
  const base = { ...(current ?? {}) };
  if (!patch) return base;
  for (const key of PREFERENCE_KEYS) {
    const next = trimText(patch[key], key === 'special_notes' ? 800 : 200);
    if (next) base[key] = next;
  }
  return base;
}

export function buildExpertBrief(preferences: ConciergePreferences): ConciergeExpertBrief {
  return {
    destinations:
      preferences.preferred_destination ||
      preferences.travel_style ||
      'قيد الاستكشاف',
    daily_pace: preferences.daily_pace || preferences.travel_style || 'هادئ / متوازن',
    sensory_style:
      preferences.sensory_style || 'تجارب حسية هادئة وجواهر خفية',
    hotel_style: preferences.hotel_style || 'Boutique quiet luxury',
    special_notes:
      preferences.special_notes ||
      preferences.budget ||
      preferences.target_date ||
      'تُستكمل في جلسة التصميم',
    companions: preferences.companions,
    budget: preferences.budget,
  };
}

/** Arabic expert-notes block for client display + ai_consultations.summary */
export function formatExpertBriefArabic(
  preferences: ConciergePreferences,
  clientName?: string | null,
): string {
  const brief = buildExpertBrief(preferences);
  const header = clientName
    ? `ملاحظات خاصة برحلة ${clientName} - مسودة للخبير:`
    : 'ملاحظات خاصة برحلتك - مسودة للخبير:';
  const lines = [
    header,
    `- الوجهات ذات الاهتمام: ${brief.destinations}`,
    `- الإيقاع اليومي المفضل: ${brief.daily_pace}`,
    `- نمط التجارب الحسية: ${brief.sensory_style}`,
    `- نمط الفنادق: ${brief.hotel_style}`,
    `- الملاحظات الخاصة: ${brief.special_notes}`,
  ];
  if (brief.companions) {
    lines.splice(5, 0, `- الرفقة: ${brief.companions}`);
  }
  if (brief.budget) {
    lines.push(`- الميزانية المشار إليها: ${brief.budget}`);
  }
  return lines.join('\n');
}

export function normalizeHistory(raw: unknown): ConciergeChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ConciergeChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const role = row.role === 'assistant' || row.role === 'user' ? row.role : null;
    const content = trimText(row.content, 8000);
    if (!role || !content) continue;
    out.push({
      role,
      content,
      at: typeof row.at === 'string' ? row.at : undefined,
    });
  }
  return out.slice(-40);
}

export function toAnthropicMessages(history: ConciergeChatMessage[]) {
  return history.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

export function parsePreferencesJson(raw: unknown): ConciergePreferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const row = raw as Record<string, unknown>;
  const nested =
    row.expert_brief && typeof row.expert_brief === 'object' && !Array.isArray(row.expert_brief)
      ? (row.expert_brief as Record<string, unknown>)
      : {};
  return mergePreferences(
    {},
    {
      preferred_destination:
        trimText(row.preferred_destination ?? nested.destinations, 200) || undefined,
      budget: trimText(row.budget ?? nested.budget, 200) || undefined,
      travel_style: trimText(row.travel_style, 200) || undefined,
      target_date: trimText(row.target_date, 200) || undefined,
      companions: trimText(row.companions ?? nested.companions, 200) || undefined,
      daily_pace: trimText(row.daily_pace ?? nested.daily_pace, 200) || undefined,
      sensory_style: trimText(row.sensory_style ?? nested.sensory_style, 200) || undefined,
      hotel_style: trimText(row.hotel_style ?? nested.hotel_style, 200) || undefined,
      special_notes: trimText(row.special_notes ?? nested.special_notes, 800) || undefined,
    },
  );
}