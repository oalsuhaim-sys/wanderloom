import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

import {
  buildConversationSummary,
  findOrCreateConciergeClient,
  syncClientLeadSource,
} from '@/lib/ai-concierge-clients';
import {
  AI_CONCIERGE_SOURCE,
  AI_CONCIERGE_SYSTEM_PROMPT,
  CONCIERGE_CLOSING_CTA_AR,
  CONCIERGE_IDENTIFICATION_AR,
  CONCIERGE_WELCOME_AR,
  buildExpertBrief,
  formatExpertBriefArabic,
  mergePreferences,
  normalizeHistory,
  parsePreferencesJson,
  toAnthropicMessages,
  trimText,
  UPDATE_CONSULTATION_TOOL,
  type ConciergeChatMessage,
  type ConciergePreferences,
} from '@/lib/ai-concierge';
import { isUsableClientName, isUsableClientPhone } from '@/lib/client-intake-pipeline';
import { verifyConciergeVerificationToken } from '@/lib/ai-concierge-otp';
import { sanitizePhoneDigits } from '@/lib/phoneUtils';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

type ConciergeBody = {
  consultationId?: string;
  message?: string;
  userPhone?: string;
  userEmail?: string;
  clientName?: string;
  verificationToken?: string;
};

type ConsultationRow = {
  id: string;
  client_id: number | null;
  client_name: string | null;
  client_phone: string | null;
  user_phone: string | null;
  user_email: string | null;
  conversation_history: unknown;
  messages: unknown;
  extracted_preferences: unknown;
  destination_interest: string | null;
  summary: string | null;
};

function extractToolPatch(content: Anthropic.ContentBlock[]): {
  reply: string;
  preferences: ConciergePreferences;
  userPhone?: string;
  userEmail?: string;
  clientName?: string;
} {
  const textParts: string[] = [];
  let preferences: ConciergePreferences = {};
  let userPhone: string | undefined;
  let userEmail: string | undefined;
  let clientName: string | undefined;

  for (const block of content) {
    if (block.type === 'text') {
      const t = trimText(block.text, 8000);
      if (t) textParts.push(t);
      continue;
    }
    if (block.type !== 'tool_use' || block.name !== UPDATE_CONSULTATION_TOOL.name) {
      continue;
    }
    const input = (block.input ?? {}) as Record<string, unknown>;
    preferences = mergePreferences(preferences, {
      preferred_destination: trimText(input.preferred_destination, 200) || undefined,
      budget: trimText(input.budget, 200) || undefined,
      travel_style: trimText(input.travel_style, 200) || undefined,
      target_date: trimText(input.target_date, 200) || undefined,
      companions: trimText(input.companions, 200) || undefined,
      daily_pace: trimText(input.daily_pace, 200) || undefined,
      sensory_style: trimText(input.sensory_style, 200) || undefined,
      hotel_style: trimText(input.hotel_style, 200) || undefined,
      special_notes: trimText(input.special_notes, 800) || undefined,
    });
    const phone = trimText(input.user_phone, 40);
    const email = trimText(input.user_email, 120);
    const name = trimText(input.client_name, 120);
    if (phone) userPhone = phone;
    if (email) userEmail = email;
    if (name) clientName = name;
  }

  return {
    reply: textParts.join('\n\n').trim(),
    preferences,
    userPhone,
    userEmail,
    clientName,
  };
}

function readHistory(row: ConsultationRow): ConciergeChatMessage[] {
  const fromMessages = normalizeHistory(row.messages);
  if (fromMessages.length) return fromMessages;
  return normalizeHistory(row.conversation_history);
}

async function loadOrCreateConsultation(input: {
  consultationId?: string;
  userPhone?: string;
  userEmail?: string;
  clientName?: string;
}): Promise<{ row: ConsultationRow | null; error?: string }> {
  const admin = createSupabaseAdminClient();

  if (input.consultationId) {
    const { data, error } = await admin
      .from('ai_consultations')
      .select(
        'id, client_id, client_name, client_phone, user_phone, user_email, conversation_history, messages, extracted_preferences, destination_interest, summary',
      )
      .eq('id', input.consultationId)
      .maybeSingle();

    if (error) {
      // Older schema without new columns
      if (/column|schema cache|does not exist|could not find/i.test(error.message ?? '')) {
        const legacy = await admin
          .from('ai_consultations')
          .select('id, user_phone, user_email, conversation_history, extracted_preferences')
          .eq('id', input.consultationId)
          .maybeSingle();
        if (legacy.error) return { row: null, error: legacy.error.message };
        if (legacy.data) {
          return {
            row: {
              ...(legacy.data as ConsultationRow),
              client_id: null,
              client_name: null,
              client_phone: null,
              messages: [],
              destination_interest: null,
              summary: null,
            },
          };
        }
      } else {
        return { row: null, error: error.message };
      }
    }
    if (data) return { row: data as ConsultationRow };
  }

  const insertPayload: Record<string, unknown> = {
    user_phone: input.userPhone || null,
    user_email: input.userEmail || null,
    client_name: input.clientName || null,
    client_phone: input.userPhone || null,
    source: AI_CONCIERGE_SOURCE,
    conversation_history: [],
    messages: [],
    extracted_preferences: {},
  };

  const { data, error } = await admin
    .from('ai_consultations')
    .insert(insertPayload)
    .select(
      'id, client_id, client_name, client_phone, user_phone, user_email, conversation_history, messages, extracted_preferences, destination_interest, summary',
    )
    .single();

  if (error || !data) {
    if (error && /column|schema cache|does not exist|could not find/i.test(error.message ?? '')) {
      const legacy = await admin
        .from('ai_consultations')
        .insert({
          user_phone: input.userPhone || null,
          user_email: input.userEmail || null,
          conversation_history: [],
          extracted_preferences: {},
        })
        .select('id, user_phone, user_email, conversation_history, extracted_preferences')
        .single();
      if (legacy.error || !legacy.data) {
        return {
          row: null,
          error:
            legacy.error?.message ??
            'جدول ai_consultations غير جاهز. نفّذ supabase/sql/ai_consultations.sql',
        };
      }
      return {
        row: {
          ...(legacy.data as ConsultationRow),
          client_id: null,
          client_name: input.clientName || null,
          client_phone: input.userPhone || null,
          messages: [],
          destination_interest: null,
          summary: null,
        },
      };
    }

    return {
      row: null,
      error: error?.message ?? 'تعذّر إنشاء جلسة الاستشارة',
    };
  }

  return { row: data as ConsultationRow };
}

export async function POST(req: NextRequest) {
  let body: ConciergeBody;
  try {
    body = (await req.json()) as ConciergeBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'طلب غير صالح' }, { status: 400 });
  }

  const message = trimText(body.message, 2000);
  if (!message) {
    return NextResponse.json({ ok: false, error: 'الرسالة مطلوبة' }, { status: 400 });
  }

  const userPhone = trimText(body.userPhone, 40) || undefined;
  const userEmail = trimText(body.userEmail, 120) || undefined;
  const clientName = trimText(body.clientName, 120) || undefined;
  const consultationId = trimText(body.consultationId, 64) || undefined;
  const verificationToken = trimText(body.verificationToken, 2000) || undefined;

  const tokenCheck = verifyConciergeVerificationToken(verificationToken);
  if (!tokenCheck.ok) {
    return NextResponse.json(
      {
        ok: false,
        needsVerification: true,
        error: tokenCheck.error,
        reply: CONCIERGE_IDENTIFICATION_AR,
      },
      { status: 401 },
    );
  }

  const verifiedPhone = tokenCheck.payload.phone;
  const verifiedName = tokenCheck.payload.name;
  const resolvedPhone = userPhone || verifiedPhone;
  const resolvedName = clientName || verifiedName;

  if (
    sanitizePhoneDigits(resolvedPhone || '') !== sanitizePhoneDigits(verifiedPhone)
  ) {
    return NextResponse.json(
      {
        ok: false,
        needsVerification: true,
        error: 'رقم الجوال لا يطابق جلسة التحقق',
      },
      { status: 401 },
    );
  }

  const identityReady =
    Boolean(resolvedName && isUsableClientName(resolvedName)) &&
    Boolean(resolvedPhone && isUsableClientPhone(resolvedPhone));

  // OBJECTIVE 1 — block travel chat until name + WhatsApp are captured (API-enforced).
  if (!identityReady) {
    return NextResponse.json({
      ok: true,
      needsIdentity: true,
      consultationId: consultationId || null,
      reply: CONCIERGE_IDENTIFICATION_AR,
      conversation: [
        {
          role: 'assistant' as const,
          content: CONCIERGE_IDENTIFICATION_AR,
          at: new Date().toISOString(),
        },
      ],
      messages: [
        {
          role: 'assistant' as const,
          content: CONCIERGE_IDENTIFICATION_AR,
          at: new Date().toISOString(),
        },
      ],
      preferences: {},
      clientName: resolvedName || null,
      userPhone: resolvedPhone || null,
      userEmail: userEmail || null,
    });
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: 'مفتاح Anthropic غير متوفر. أضف ANTHROPIC_API_KEY في .env.local / Vercel.',
      },
      { status: 500 },
    );
  }

  let loaded;
  try {
    loaded = await loadOrCreateConsultation({
      consultationId,
      userPhone: resolvedPhone,
      userEmail,
      clientName: resolvedName,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'تعذّر الاتصال بقاعدة البيانات';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  if (loaded.error || !loaded.row?.id) {
    return NextResponse.json(
      {
        ok: false,
        error:
          loaded.error ??
          'جدول ai_consultations غير جاهز. نفّذ supabase/sql/ai_consultations.sql في Supabase.',
      },
      { status: 500 },
    );
  }

  const row = loaded.row;
  const history = readHistory(row);
  const nowIso = new Date().toISOString();
  const nextHistory: ConciergeChatMessage[] = [
    ...history,
    { role: 'user', content: message, at: nowIso },
  ];

  const model =
    (process.env.ANTHROPIC_CONCIERGE_MODEL ?? '').trim() ||
    (process.env.ANTHROPIC_MODEL ?? '').trim() ||
    'claude-sonnet-4-5';

  const knownName = resolvedName || row.client_name || '';
  const knownPrefs = parsePreferencesJson(row.extracted_preferences);
  const systemPrompt = `${AI_CONCIERGE_SYSTEM_PROMPT}

CLIENT SESSION CONTEXT (identified — apply Prompt 2):
- Client name: ${knownName}
- WhatsApp on file: ${resolvedPhone || row.client_phone || row.user_phone || 'known'}
- Known travel DNA so far: destination=${knownPrefs.preferred_destination || 'unknown'}; style=${knownPrefs.travel_style || 'unknown'}; budget=${knownPrefs.budget || 'unknown'}; target_date=${knownPrefs.target_date || 'unknown'}
- Address the client by name. Deliver sensory 1–2 day pathway teasers with the required daily flow when recommending. Refuse full multi-day plans with the Prompt 2 sales line.
- When concluding (or when preferences are rich enough), present Prompt 3 «ملاحظات للخبير» and call update_consultation_profile with destinations, daily_pace, sensory_style, hotel_style, special_notes, companions.
- Close with Prompt 4 advocacy for the human Senior Travel Strategist and the conversion CTA inviting a design session.`;

  let reply = '';
  let preferencePatch: ConciergePreferences = {};
  let phoneFromTool: string | undefined;
  let emailFromTool: string | undefined;
  let nameFromTool: string | undefined;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model,
      max_tokens: 2000,
      temperature: 0.55,
      system: systemPrompt,
      tools: [UPDATE_CONSULTATION_TOOL],
      messages: toAnthropicMessages(nextHistory),
    });

    const extracted = extractToolPatch(response.content);
    reply = extracted.reply;
    preferencePatch = extracted.preferences;
    phoneFromTool = extracted.userPhone;
    emailFromTool = extracted.userEmail;
    nameFromTool = extracted.clientName;

    if (!reply) {
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      if (toolUses.length > 0) {
        const followUp = await anthropic.messages.create({
          model,
          max_tokens: 1600,
          temperature: 0.55,
          system: systemPrompt,
          messages: [
            ...toAnthropicMessages(nextHistory),
            { role: 'assistant', content: response.content },
            {
              role: 'user',
              content: toolUses.map((b) => ({
                type: 'tool_result' as const,
                tool_use_id: b.id,
                content: 'تم حفظ التفضيلات وربط ملف العميل.',
              })),
            },
          ],
        });
        reply = followUp.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n\n')
          .trim();
      }
    }
  } catch (err) {
    console.error('[ai-concierge] Anthropic error:', err);
    const msg = err instanceof Error ? err.message : 'فشل الاتصال بنموذج الذكاء الاصطناعي';
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }

  if (!reply) {
    reply =
      'شكرًا لمشاركتك. دعنا نرتّب رحلتك بهدوء — أخبرني بالوجهة أو الأسلوب الذي يلامس ذوقك.';
  }

  const assistantAt = new Date().toISOString();
  const savedHistory: ConciergeChatMessage[] = [
    ...nextHistory,
    { role: 'assistant', content: reply, at: assistantAt },
  ];

  const mergedPreferences = mergePreferences(
    parsePreferencesJson(row.extracted_preferences),
    preferencePatch,
  );

  const finalPhone =
    resolvedPhone || phoneFromTool || row.client_phone || row.user_phone || null;
  const finalEmail = emailFromTool || userEmail || row.user_email || null;
  const finalName =
    resolvedName || nameFromTool || row.client_name || null;
  const destinationInterest =
    mergedPreferences.preferred_destination || row.destination_interest || null;

  const expertBrief = buildExpertBrief(mergedPreferences);
  const hasRichBrief = Boolean(
    mergedPreferences.preferred_destination ||
      mergedPreferences.daily_pace ||
      mergedPreferences.sensory_style ||
      mergedPreferences.hotel_style ||
      mergedPreferences.special_notes ||
      mergedPreferences.companions,
  );
  const summary = hasRichBrief
    ? formatExpertBriefArabic(mergedPreferences, finalName)
    : buildConversationSummary(savedHistory, mergedPreferences, finalName);

  const preferencesPayload = {
    ...mergedPreferences,
    expert_brief: expertBrief,
  };

  let clientId: number | null = row.client_id ? Number(row.client_id) : null;
  let linkedCreated = false;

  try {
    const admin = createSupabaseAdminClient();

    if (finalPhone || finalEmail) {
      const linked = await findOrCreateConciergeClient(admin, {
        name: finalName,
        phone: finalPhone,
        email: finalEmail,
      });
      if (linked?.id) {
        clientId = linked.id;
        linkedCreated = linked.created;
        await syncClientLeadSource(admin, linked.id);
      }
    } else if (clientId) {
      await syncClientLeadSource(admin, clientId);
    }

    const upsertPayload: Record<string, unknown> = {
      id: row.id,
      client_id: clientId,
      client_name: finalName,
      client_phone: finalPhone,
      user_phone: finalPhone,
      user_email: finalEmail,
      source: AI_CONCIERGE_SOURCE,
      destination_interest: destinationInterest,
      summary,
      messages: savedHistory,
      conversation_history: savedHistory,
      extracted_preferences: preferencesPayload,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await admin.from('ai_consultations').upsert([upsertPayload], {
      onConflict: 'id',
    });

    if (upsertError) {
      // Fallback update without newer columns
      if (/column|schema cache|does not exist|could not find/i.test(upsertError.message ?? '')) {
        const { error: updateError } = await admin
          .from('ai_consultations')
          .update({
            user_phone: finalPhone,
            user_email: finalEmail,
            conversation_history: savedHistory,
            extracted_preferences: preferencesPayload,
          })
          .eq('id', row.id);
        if (updateError) {
          console.error('[ai-concierge] save error:', updateError);
          return NextResponse.json(
            {
              ok: false,
              error: `${updateError.message} — نفّذ supabase/sql/ai_consultations.sql`,
              consultationId: row.id,
              reply,
            },
            { status: 500 },
          );
        }
      } else {
        console.error('[ai-concierge] upsert error:', upsertError);
        return NextResponse.json(
          {
            ok: false,
            error: upsertError.message,
            consultationId: row.id,
            reply,
          },
          { status: 500 },
        );
      }
    }
  } catch (err) {
    console.error('[ai-concierge] persist exception:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'تعذّر حفظ المحادثة',
        consultationId: row.id,
        reply,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    consultationId: row.id,
    clientId,
    clientLinked: Boolean(clientId),
    clientCreated: linkedCreated,
    reply,
    conversation: savedHistory,
    messages: savedHistory,
    preferences: mergedPreferences,
    expertBrief,
    showClosingCta: hasRichBrief,
    closingCta: hasRichBrief ? CONCIERGE_CLOSING_CTA_AR : null,
    destinationInterest,
    summary,
    leadSource: AI_CONCIERGE_SOURCE,
    clientName: finalName,
    userPhone: finalPhone,
    userEmail: finalEmail,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    welcome: CONCIERGE_WELCOME_AR,
  });
}
