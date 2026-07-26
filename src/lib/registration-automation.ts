import 'server-only';

import {
  runWebsiteLeadIntakeAutomation,
  type ClientIntakeAutomationResult,
} from '@/lib/client-intake-pipeline';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { notifyCrmTeamChat } from '@/lib/web-push-server';

export type RegistrationAutomationInput = {
  leadId: string;
  fullName: string;
  phoneWa: string;
  email?: string | null;
  referralCode?: string | null;
  origin?: string;
  source?: string;
};

export type RegistrationAutomationResult = {
  intake: ClientIntakeAutomationResult | null;
  /** Always false — WhatsApp is manual-only (no auto-send). */
  whatsappSent: boolean;
  whatsappSimulated: boolean;
  notificationsCreated: number;
  errors: string[];
};

async function insertTeamNotifications(input: {
  clientId: number | null;
  leadId: string;
  clientName: string;
}): Promise<number> {
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return 0;
  }

  const name = input.clientName.trim() || 'عميل جديد';
  const link =
    input.clientId != null
      ? `/crm/clients/${input.clientId}`
      : `/crm/radar`;

  const rows = [
    {
      role: 'expert',
      title: 'عميل جديد!',
      message: `تم تسجيل العميل ${name} — رابط DNA جاهز للإرسال اليدوي.`,
      link,
      client_id: input.clientId,
      lead_id: input.leadId,
    },
    {
      role: 'leader',
      title: 'تسجيل جديد',
      message: `العميل ${name} بانتظار متابعة الخبير.`,
      link,
      client_id: input.clientId,
      lead_id: input.leadId,
    },
  ];

  const { error } = await admin.from('crm_team_notifications').insert(rows as never);
  if (error) {
    if (/does not exist|schema cache|relation/i.test(error.message)) {
      console.warn(
        '[registration-automation] نفّذ supabase/sql/crm_team_notifications.sql لإشعارات الفريق',
      );
    } else {
      console.warn('[registration-automation] notifications insert:', error.message);
    }
    return 0;
  }
  return rows.length;
}

/**
 * بعد تسجيل عميل/جلسة بنجاح:
 * 1) إنشاء/ربط ملف عميل + رابط DNA
 * 2) إشعار الخبير والليدر (+ web push للفريق)
 *
 * WhatsApp is NEVER sent here — staff send DNA links only via explicit UI buttons.
 */
export async function runRegistrationAutomationPipeline(
  input: RegistrationAutomationInput,
): Promise<RegistrationAutomationResult> {
  const errors: string[] = [];
  let intake: ClientIntakeAutomationResult | null = null;
  const whatsappSent = false;
  const whatsappSimulated = false;
  let notificationsCreated = 0;

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'admin unavailable');
    return { intake: null, whatsappSent, whatsappSimulated, notificationsCreated, errors };
  }

  try {
    intake = await runWebsiteLeadIntakeAutomation(
      admin,
      {
        id: input.leadId,
        full_name: input.fullName,
        phone_wa: input.phoneWa,
        email: input.email ?? null,
        referral_code: input.referralCode ?? null,
      },
      { origin: input.origin },
    );
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'intake failed');
    return { intake: null, whatsappSent, whatsappSimulated, notificationsCreated, errors };
  }

  try {
    notificationsCreated = await insertTeamNotifications({
      clientId: intake.clientId,
      leadId: input.leadId,
      clientName: input.fullName,
    });
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'notifications failed');
  }

  void notifyCrmTeamChat({
    authorName: 'Wanderloom Automations',
    body: `عميل جديد: ${input.fullName} — تم تجهيز رابط DNA (إرسال واتساب يدوي فقط).`,
    recordType: 'lead',
    recordId: input.leadId,
  });

  return {
    intake,
    whatsappSent,
    whatsappSimulated,
    notificationsCreated,
    errors,
  };
}
