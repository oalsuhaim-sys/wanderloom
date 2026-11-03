import { NextResponse, type NextRequest } from 'next/server';

import {
  ClientFollowupsTableMissingError,
  buildFallbackFollowup,
  createClientFollowup,
  isMissingClientFollowupsTable,
} from '@/lib/client-followups';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/crm/client-followups
 * Body: { clientId | client_id | client: { id }, notes, agentName, agentEmployeeId? }
 */
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if (!('user' in auth) || !auth.user) {
    return NextResponse.json({ ok: false, error: 'غير مصرح' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const client =
    body.client && typeof body.client === 'object'
      ? (body.client as {
          id?: string | number | null;
          client_id?: string | number | null;
          name?: string | null;
        })
      : null;

  const clientId = body.clientId || body.client_id || client?.id || client?.client_id;

  if (typeof clientId === 'number') {
    if (!Number.isFinite(clientId)) {
      return NextResponse.json(
        { ok: false, error: 'معرّف العميل غير صالح.' },
        { status: 400 },
      );
    }
  } else if (typeof clientId !== 'string' || !clientId.trim() || clientId.trim() === 'undefined' || clientId.trim() === 'null') {
    return NextResponse.json(
      { ok: false, error: 'معرّف العميل غير صالح.' },
      { status: 400 },
    );
  }

  const notes = String(body.notes ?? '').trim();
  const agentName =
    String(body.agentName ?? body.agent_name ?? '').trim() ||
    String(auth.employeeRow?.full_name ?? '').trim() ||
    'موظف CRM';
  const agentEmployeeId =
    body.agentEmployeeId != null
      ? String(body.agentEmployeeId)
      : body.agent_employee_id != null
        ? String(body.agent_employee_id)
        : auth.employeeRow?.id != null
          ? String(auth.employeeRow.id)
          : null;

  try {
    let clientDb;
    try {
      clientDb = createSupabaseAdminClient();
    } catch {
      clientDb = auth.supabase;
    }

    const followup = await createClientFollowup(clientDb, {
      clientId,
      client_id: clientId,
      client,
      agentName,
      agentEmployeeId,
      notes,
    });

    return NextResponse.json({ ok: true, followup });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'تعذر حفظ المتابعة.';
    const code = err && typeof err === 'object' && 'code' in err ? String(err.code ?? '') : '';
    if (err instanceof ClientFollowupsTableMissingError || isMissingClientFollowupsTable(message, code)) {
      const followup = buildFallbackFollowup({
        clientId,
        agentName,
        agentEmployeeId,
        notes,
      });
      return NextResponse.json({ ok: true, fallback: true, followup });
    }
    const status = message.includes('ملاحظات') || message.includes('غير صالح') ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
