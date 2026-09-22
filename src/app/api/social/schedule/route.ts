import { NextRequest, NextResponse } from 'next/server';

import { resolveSocialSchedulerCredentials } from '@/lib/social-scheduler-credentials.server';
import {
  toPublicSocialStatus,
  type SocialSchedulerCredentials,
} from '@/lib/social-scheduler-settings';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type SocialSchedulePostInput = {
  text: string;
  platforms?: string[];
  scheduledAt?: string | null;
  mediaUrls?: string[];
  title?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

async function scheduleViaBuffer(
  posts: SocialSchedulePostInput[],
  creds: SocialSchedulerCredentials,
) {
  const token = creds.apiKey.trim();
  const profileIds = String(creds.extra ?? '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!token) {
    return {
      ok: false as const,
      error: 'missing_buffer_token',
      message: 'أضف BUFFER Access Token في إعدادات الربط.',
    };
  }
  if (!profileIds.length) {
    return {
      ok: false as const,
      error: 'missing_buffer_profiles',
      message: 'أضف BUFFER Profile IDs في إعدادات الربط.',
    };
  }

  const results: Array<{ text: string; ok: boolean; id?: string; error?: string }> = [];

  for (const post of posts) {
    const text = String(post.text ?? '').trim();
    if (!text) continue;

    const form = new URLSearchParams();
    form.set('text', text);
    for (const id of profileIds) form.append('profile_ids[]', id);
    if (post.scheduledAt) {
      form.set('scheduled_at', post.scheduledAt);
    } else {
      form.set('now', 'true');
    }

    try {
      const res = await fetch('https://api.bufferapp.com/1/updates/create.json', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        results.push({
          text: text.slice(0, 80),
          ok: false,
          error: String(data.error ?? data.message ?? res.statusText),
        });
        continue;
      }
      const update = asRecord(data.update ?? data);
      results.push({
        text: text.slice(0, 80),
        ok: true,
        id: String(update.id ?? data.id ?? '').trim() || undefined,
      });
    } catch (err) {
      results.push({
        text: text.slice(0, 80),
        ok: false,
        error: err instanceof Error ? err.message : 'buffer_request_failed',
      });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  return {
    ok: okCount > 0,
    provider: 'buffer' as const,
    queued: okCount,
    total: results.length,
    results,
    message:
      okCount > 0
        ? `تمت جدولة ${okCount} منشور عبر Buffer.`
        : 'تعذر جدولة المنشورات عبر Buffer.',
  };
}

async function scheduleViaMetricool(
  posts: SocialSchedulePostInput[],
  creds: SocialSchedulerCredentials,
) {
  const apiKey = creds.apiKey.trim();
  const blogId = creds.extra.trim() || (process.env.METRICOOL_BLOG_ID ?? '').trim();
  const userId = (process.env.METRICOOL_USER_ID ?? '').trim();
  const base =
    (process.env.METRICOOL_API_BASE ?? '').trim() || 'https://app.metricool.com/api';

  if (!apiKey) {
    return {
      ok: false as const,
      error: 'missing_metricool_key',
      message: 'أضف METRICOOL API Key في إعدادات الربط.',
    };
  }

  const results: Array<{ text: string; ok: boolean; id?: string; error?: string }> = [];

  for (const post of posts) {
    const text = String(post.text ?? '').trim();
    if (!text) continue;

    const scheduledAt =
      post.scheduledAt || new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const payload: Record<string, unknown> = {
      text,
      providers: post.platforms?.length ? post.platforms : ['instagram', 'twitter'],
      publicationDate: scheduledAt,
      autoPublish: true,
    };
    if (blogId) payload.blogId = blogId;
    if (userId) payload.userId = userId;

    try {
      const url = new URL(`${base.replace(/\/$/, '')}/v2/scheduler/posts`);
      url.searchParams.set('access_token', apiKey);
      if (blogId) url.searchParams.set('blogId', blogId);

      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(apiKey ? { 'X-Mc-Auth': apiKey } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        results.push({
          text: text.slice(0, 80),
          ok: false,
          error: String(data.error ?? data.message ?? res.statusText),
        });
        continue;
      }
      results.push({
        text: text.slice(0, 80),
        ok: true,
        id: String(data.id ?? asRecord(data.data).id ?? '').trim() || undefined,
      });
    } catch (err) {
      results.push({
        text: text.slice(0, 80),
        ok: false,
        error: err instanceof Error ? err.message : 'metricool_request_failed',
      });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  return {
    ok: okCount > 0,
    provider: 'metricool' as const,
    queued: okCount,
    total: results.length,
    results,
    message:
      okCount > 0
        ? `تمت جدولة ${okCount} منشور عبر Metricool.`
        : 'تعذر جدولة المنشورات عبر Metricool — تحقق من المفتاح و blogId.',
  };
}

/**
 * POST /api/social/schedule
 * Push approved posts to Buffer or Metricool (DB settings or env).
 */
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = asRecord(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const rawPosts = Array.isArray(body.posts) ? body.posts : body.text ? [body] : [];
  const posts: SocialSchedulePostInput[] = [];
  for (const item of rawPosts) {
    const row = asRecord(item);
    const text = String(row.text ?? row.body ?? row.caption ?? '').trim();
    if (!text) continue;
    const platforms = Array.isArray(row.platforms)
      ? row.platforms.map((p) => String(p).trim()).filter(Boolean)
      : undefined;
    posts.push({
      text,
      platforms,
      scheduledAt: row.scheduledAt != null ? String(row.scheduledAt).trim() : null,
      title: row.title != null ? String(row.title).trim() : undefined,
      mediaUrls: Array.isArray(row.mediaUrls)
        ? row.mediaUrls.map((u) => String(u).trim()).filter(Boolean)
        : undefined,
    });
  }

  if (!posts.length) {
    return NextResponse.json(
      {
        ok: false,
        error: 'posts_required',
        message: 'أضف منشورات (posts[].text) للجدولة.',
      },
      { status: 400 },
    );
  }

  const creds = await resolveSocialSchedulerCredentials();
  if (creds.provider === 'none' || !creds.apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: 'scheduler_not_configured',
        message:
          'لم يُضبط مجدول اجتماعي. افتح «ضبط إعدادات الربط» وأدخل مفتاح Metricool أو Buffer.',
        setup: {
          buffer: ['Access Token', 'Profile IDs'],
          metricool: ['API Key', 'Blog ID (اختياري)'],
        },
      },
      { status: 503 },
    );
  }

  const result =
    creds.provider === 'buffer'
      ? await scheduleViaBuffer(posts, creds)
      : await scheduleViaMetricool(posts, creds);

  if (!result.ok) {
    const { ok: _ok, ...rest } = result;
    return NextResponse.json({ ok: false, ...rest }, { status: 502 });
  }

  const { ok: _okTrue, ...successRest } = result;
  return NextResponse.json({ ok: true, ...successRest });
}

/** GET — provider status for the marketing UI */
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const creds = await resolveSocialSchedulerCredentials();
  const status = toPublicSocialStatus(creds);
  return NextResponse.json({
    ok: true,
    ...status,
  });
}
