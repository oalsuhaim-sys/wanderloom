import 'server-only';

import webpush from 'web-push';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type StoredPushSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function vapidPublicKey(): string {
  return (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ||
    process.env.VAPID_PUBLIC_KEY?.trim() ||
    ''
  );
}

function vapidPrivateKey(): string {
  return process.env.VAPID_PRIVATE_KEY?.trim() || '';
}

function vapidSubject(): string {
  return (
    process.env.VAPID_SUBJECT?.trim() ||
    process.env.WEB_PUSH_CONTACT?.trim() ||
    'mailto:ops@wanderloom.app'
  );
}

export function isWebPushConfigured(): boolean {
  return Boolean(vapidPublicKey() && vapidPrivateKey());
}

export function getVapidPublicKey(): string | null {
  const key = vapidPublicKey();
  return key || null;
}

function configureWebPush(): boolean {
  if (!isWebPushConfigured()) return false;
  webpush.setVapidDetails(vapidSubject(), vapidPublicKey(), vapidPrivateKey());
  return true;
}

export async function upsertCrmPushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userId?: string | null;
  employeeId?: string | null;
  userAgent?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const endpoint = input.endpoint.trim();
  const p256dh = input.p256dh.trim();
  const auth = input.auth.trim();
  if (!endpoint || !p256dh || !auth) {
    return { ok: false, error: 'اشتراك غير مكتمل' };
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { ok: false, error: 'server_config' };
  }

  const now = new Date().toISOString();
  const { error } = await admin.from('crm_push_subscriptions').upsert(
    {
      endpoint,
      p256dh,
      auth,
      user_id: input.userId ?? null,
      employee_id: input.employeeId ?? null,
      user_agent: input.userAgent ?? null,
      updated_at: now,
    },
    { onConflict: 'endpoint' },
  );

  if (error) {
    if (/crm_push_subscriptions|schema cache|does not exist/i.test(error.message)) {
      return {
        ok: false,
        error:
          'جدول الاشتراكات غير موجود — نفّذ supabase/sql/crm_push_subscriptions.sql في Supabase.',
      };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

async function loadAllSubscriptions(): Promise<StoredPushSubscription[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('crm_push_subscriptions')
    .select('id, endpoint, p256dh, auth');

  if (error || !data) {
    if (error) {
      console.warn('[web-push] load subscriptions:', error.message);
    }
    return [];
  }

  return (data as Array<Record<string, unknown>>)
    .map((row) => ({
      id: String(row.id ?? ''),
      endpoint: String(row.endpoint ?? '').trim(),
      p256dh: String(row.p256dh ?? '').trim(),
      auth: String(row.auth ?? '').trim(),
    }))
    .filter((row) => row.id && row.endpoint && row.p256dh && row.auth);
}

async function deleteSubscriptionByEndpoint(endpoint: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from('crm_push_subscriptions').delete().eq('endpoint', endpoint);
  } catch (err) {
    console.warn('[web-push] delete stale subscription failed:', err);
  }
}

export async function sendWebPushToSubscription(
  sub: StoredPushSubscription,
  payload: PushPayload,
): Promise<'ok' | 'gone' | 'error'> {
  if (!configureWebPush()) return 'error';

  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || '/crm',
        tag: payload.tag || 'wanderloom-team-chat',
      }),
      {
        TTL: 60 * 60,
        urgency: 'high',
      },
    );
    return 'ok';
  } catch (err) {
    const statusCode =
      err && typeof err === 'object' && 'statusCode' in err
        ? Number((err as { statusCode?: unknown }).statusCode)
        : 0;
    if (statusCode === 404 || statusCode === 410) {
      await deleteSubscriptionByEndpoint(sub.endpoint);
      return 'gone';
    }
    console.warn('[web-push] send failed:', err);
    return 'error';
  }
}

/**
 * Broadcast a team-chat notification to all CRM push subscribers.
 * Fire-and-forget safe — never throws to callers.
 */
export async function notifyCrmTeamChat(input: {
  authorName: string;
  body: string;
  recordType: string;
  recordId: string;
  excludeUserId?: string | null;
}): Promise<void> {
  try {
    if (!isWebPushConfigured()) return;

    const admin = createSupabaseAdminClient();
    let query = admin
      .from('crm_push_subscriptions')
      .select('id, endpoint, p256dh, auth, user_id');

    if (input.excludeUserId) {
      query = query.or(`user_id.is.null,user_id.neq.${input.excludeUserId}`);
    }

    const { data, error } = await query;
    if (error || !data?.length) {
      if (error && !/does not exist|schema cache/i.test(error.message)) {
        console.warn('[web-push] notify query:', error.message);
      }
      return;
    }

    const snippet = input.body.trim().slice(0, 120);
    const payload: PushPayload = {
      title: `نقاش الفريق · ${input.authorName}`,
      body: snippet || 'رسالة جديدة من الفريق',
      url: '/crm',
      tag: `crm-chat:${input.recordType}:${input.recordId}`,
    };

    await Promise.all(
      (data as Array<Record<string, unknown>>).map(async (row) => {
        const sub: StoredPushSubscription = {
          id: String(row.id ?? ''),
          endpoint: String(row.endpoint ?? '').trim(),
          p256dh: String(row.p256dh ?? '').trim(),
          auth: String(row.auth ?? '').trim(),
        };
        if (!sub.endpoint || !sub.p256dh || !sub.auth) return;
        await sendWebPushToSubscription(sub, payload);
      }),
    );
  } catch (err) {
    console.warn('[web-push] notifyCrmTeamChat failed:', err);
  }
}

export async function broadcastTestPush(payload?: Partial<PushPayload>): Promise<number> {
  if (!configureWebPush()) return 0;
  const subs = await loadAllSubscriptions();
  let sent = 0;
  for (const sub of subs) {
    const result = await sendWebPushToSubscription(sub, {
      title: payload?.title || 'Wanderloom CRM',
      body: payload?.body || 'اختبار إشعار النظام',
      url: payload?.url || '/crm',
      tag: payload?.tag || 'wanderloom-test',
    });
    if (result === 'ok') sent += 1;
  }
  return sent;
}
