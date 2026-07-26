import { NextResponse, type NextRequest } from 'next/server';

import {
  extractMentionTokens,
  mapCrmCommentRow,
  type CrmCommentEmployeeOption,
  type CrmCommentMention,
  type CrmRecordComment,
} from '@/lib/crm-comments';
import { notifyCrmTeamChat } from '@/lib/web-push-server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

function bearerToken(request: NextRequest): string {
  const authorization = request.headers.get('authorization') ?? '';
  return authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';
}

async function resolveAuth(request: NextRequest) {
  const admin = createSupabaseAdminClient();
  const token = bearerToken(request);

  if (token) {
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);
    if (error || !user) {
      return { ok: false as const, status: 401, error: 'غير مصرح', admin };
    }
    return { ok: true as const, user, admin, employeeRow: null as Record<string, unknown> | null };
  }

  const cookieAuth = await getAuthenticatedCrmUser(request);
  if ('error' in cookieAuth) {
    return {
      ok: false as const,
      status: cookieAuth.status ?? 401,
      error: String(cookieAuth.error ?? 'غير مصرح'),
      admin,
    };
  }

  return {
    ok: true as const,
    user: cookieAuth.user,
    admin,
    employeeRow: (cookieAuth.employeeRow ?? null) as Record<string, unknown> | null,
  };
}

async function resolveEmployee(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  email: string | null,
  cached: Record<string, unknown> | null,
): Promise<{ id: string | null; fullName: string }> {
  if (cached?.id != null) {
    return {
      id: String(cached.id),
      fullName: String(cached.full_name ?? 'موظف').trim() || 'موظف',
    };
  }

  const byUser = await admin
    .from('employees')
    .select('id, full_name, email')
    .eq('user_id', userId)
    .maybeSingle();

  if (!byUser.error && byUser.data) {
    return {
      id: String((byUser.data as { id: unknown }).id),
      fullName:
        String((byUser.data as { full_name?: unknown }).full_name ?? 'موظف').trim() ||
        'موظف',
    };
  }

  if (email) {
    const byEmail = await admin
      .from('employees')
      .select('id, full_name')
      .eq('email', email)
      .maybeSingle();
    if (!byEmail.error && byEmail.data) {
      return {
        id: String((byEmail.data as { id: unknown }).id),
        fullName:
          String((byEmail.data as { full_name?: unknown }).full_name ?? 'موظف').trim() ||
          'موظف',
      };
    }
  }

  return {
    id: null,
    fullName: email?.split('@')[0] || 'موظف',
  };
}

function isMissingTable(message: string): boolean {
  return /crm_record_comments|schema cache|relation|does not exist|could not find the table/i.test(
    message,
  );
}

export async function GET(request: NextRequest) {
  let auth;
  try {
    auth = await resolveAuth(request);
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status, headers: NO_STORE },
    );
  }

  const { searchParams } = new URL(request.url);
  const recordType = String(searchParams.get('recordType') ?? '').trim();
  const recordId = String(searchParams.get('recordId') ?? '').trim();
  const withEmployees = searchParams.get('employees') === '1';

  if (!recordType || !recordId) {
    return NextResponse.json(
      { ok: false, error: 'recordType و recordId مطلوبان' },
      { status: 400, headers: NO_STORE },
    );
  }

  const { admin } = auth;

  const commentsRes = await admin
    .from('crm_record_comments')
    .select('*')
    .eq('record_type', recordType)
    .eq('record_id', recordId)
    .order('created_at', { ascending: true });

  if (commentsRes.error) {
    if (isMissingTable(commentsRes.error.message ?? '')) {
      return NextResponse.json(
        {
          ok: true,
          comments: [] as CrmRecordComment[],
          employees: [] as CrmCommentEmployeeOption[],
          setupRequired: true,
          message:
            'نفّذ supabase/sql/crm_record_comments.sql في Supabase لتفعيل نقاشات الفريق.',
        },
        { headers: NO_STORE },
      );
    }
    return NextResponse.json(
      { ok: false, error: commentsRes.error.message },
      { status: 500, headers: NO_STORE },
    );
  }

  const comments = ((commentsRes.data ?? []) as Record<string, unknown>[])
    .map(mapCrmCommentRow)
    .filter((c): c is CrmRecordComment => c != null);

  let employees: CrmCommentEmployeeOption[] = [];
  if (withEmployees) {
    const empRes = await admin
      .from('employees')
      .select('id, full_name, role')
      .order('full_name', { ascending: true })
      .limit(100);
    if (!empRes.error && empRes.data) {
      employees = (empRes.data as Record<string, unknown>[])
        .map((row) => {
          const id = String(row.id ?? '').trim();
          const fullName = String(row.full_name ?? '').trim();
          if (!id || !fullName) return null;
          return {
            id,
            fullName,
            role: row.role != null ? String(row.role) : null,
          };
        })
        .filter((e): e is CrmCommentEmployeeOption => e != null);
    }
  }

  return NextResponse.json(
    { ok: true, comments, employees, setupRequired: false },
    { headers: NO_STORE },
  );
}

export async function POST(request: NextRequest) {
  let auth;
  try {
    auth = await resolveAuth(request);
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status, headers: NO_STORE },
    );
  }

  let body: {
    recordType?: string;
    recordId?: string;
    body?: string;
    mentions?: CrmCommentMention[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const recordType = String(body.recordType ?? '').trim();
  const recordId = String(body.recordId ?? '').trim();
  const text = String(body.body ?? '').trim();

  if (!recordType || !recordId || !text) {
    return NextResponse.json(
      { ok: false, error: 'recordType و recordId والنص مطلوبة' },
      { status: 400, headers: NO_STORE },
    );
  }

  if (text.length > 4000) {
    return NextResponse.json(
      { ok: false, error: 'التعليق طويل جداً' },
      { status: 400, headers: NO_STORE },
    );
  }

  const { admin, user } = auth;
  const email = user.email?.trim().toLowerCase() ?? null;
  const employee = await resolveEmployee(admin, user.id, email, auth.employeeRow);

  let mentions: CrmCommentMention[] = Array.isArray(body.mentions)
    ? body.mentions.filter(
        (m) =>
          m &&
          typeof m === 'object' &&
          String(m.employeeId ?? '').trim() &&
          String(m.name ?? '').trim(),
      )
    : [];

  // Auto-resolve @Name tokens against employees if mentions not provided
  if (!mentions.length) {
    const tokens = extractMentionTokens(text);
    if (tokens.length) {
      const empRes = await admin.from('employees').select('id, full_name').limit(100);
      if (!empRes.error && empRes.data) {
        const rows = empRes.data as Array<{ id: unknown; full_name: unknown }>;
        for (const token of tokens) {
          const match = rows.find((r) => {
            const name = String(r.full_name ?? '').trim();
            return (
              name === token ||
              name.split(/\s+/)[0] === token ||
              name.replace(/\s+/g, '') === token
            );
          });
          if (match) {
            mentions.push({
              employeeId: String(match.id),
              name: String(match.full_name),
            });
          }
        }
      }
    }
  }

  const insertPayload = {
    record_type: recordType,
    record_id: recordId,
    author_employee_id: employee.id,
    author_user_id: user.id,
    author_name: employee.fullName,
    body: text,
    mentions,
  };

  const { data, error } = await admin
    .from('crm_record_comments')
    .insert(insertPayload)
    .select('*')
    .maybeSingle();

  if (error) {
    if (isMissingTable(error.message ?? '')) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'جدول النقاشات غير موجود — نفّذ supabase/sql/crm_record_comments.sql في Supabase.',
          setupRequired: true,
        },
        { status: 503, headers: NO_STORE },
      );
    }
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500, headers: NO_STORE },
    );
  }

  const comment = mapCrmCommentRow((data ?? {}) as Record<string, unknown>);
  if (!comment) {
    return NextResponse.json(
      { ok: false, error: 'تعذر قراءة التعليق بعد الحفظ' },
      { status: 500, headers: NO_STORE },
    );
  }

  // OS-level Web Push (service worker) — even when CRM tab is closed
  void notifyCrmTeamChat({
    authorName: comment.authorName,
    body: comment.body,
    recordType: comment.recordType,
    recordId: comment.recordId,
    excludeUserId: user.id,
  });

  return NextResponse.json({ ok: true, comment }, { headers: NO_STORE });
}
