import { NextResponse, type NextRequest } from 'next/server';

import { accessFromEmployeeRow, type EmployeeRbacRow } from '@/lib/crm-permissions';
import { isEmergencyCrmOwnerBypass } from '@/lib/crm-roles';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireCrmAdmin } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_NAME = 'E2E_TEST_BOT';

export type E2ePhase = 'client' | 'quotation' | 'group' | 'cleanup';

export type E2eFixtures = {
  clientId: string | number | null;
  quotationId: string | number | null;
  groupId: string | number | null;
  memberId: string | null;
  createdTrip: boolean;
};

type PhaseBody = {
  phase?: E2ePhase;
  fixtures?: Partial<E2eFixtures>;
};

function emptyFixtures(): E2eFixtures {
  return {
    clientId: null,
    quotationId: null,
    groupId: null,
    memberId: null,
    createdTrip: false,
  };
}

function mergeFixtures(
  base: E2eFixtures,
  patch?: Partial<E2eFixtures> | null,
): E2eFixtures {
  return { ...base, ...(patch ?? {}) };
}

function jsonWithCookies(
  body: unknown,
  status: number,
  getResponse: () => NextResponse,
) {
  const response = NextResponse.json(body, { status });
  getResponse()
    .cookies.getAll()
    .forEach((cookie) => response.cookies.set(cookie));
  return response;
}

async function authorizeAdmin(
  request: NextRequest,
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<
  | { ok: true; getResponse: () => NextResponse }
  | { ok: false; error: string; status: number; getResponse: () => NextResponse }
> {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';
  if (!token) {
    const cookieAuth = await requireCrmAdmin(request);
    if ('error' in cookieAuth) {
      return {
        ok: false,
        error: String(cookieAuth.error ?? 'غير مصرح'),
        status: cookieAuth.status ?? 401,
        getResponse: cookieAuth.getResponse,
      };
    }
    return { ok: true, getResponse: cookieAuth.getResponse };
  }

  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token);
  const getResponse = () => NextResponse.next({ request });
  if (error || !user) {
    return { ok: false, error: 'غير مصرح', status: 401, getResponse };
  }

  const email = user.email?.trim().toLowerCase() ?? null;
  if (isEmergencyCrmOwnerBypass(email)) {
    return { ok: true, getResponse };
  }

  let employeeResult = await admin
    .from('employees')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!employeeResult.data && email) {
    employeeResult = await admin
      .from('employees')
      .select('*')
      .eq('email', email)
      .maybeSingle();
  }
  if (employeeResult.error) {
    return {
      ok: false,
      error: employeeResult.error.message,
      status: 500,
      getResponse,
    };
  }

  const access = accessFromEmployeeRow(
    (employeeResult.data ?? null) as EmployeeRbacRow | null,
    user.email,
  );
  if (!access.is_admin || access.is_suspended) {
    return {
      ok: false,
      error: 'صلاحيات مدير مطلوبة',
      status: 403,
      getResponse,
    };
  }
  return { ok: true, getResponse };
}

function okPhase(
  getResponse: () => NextResponse,
  phase: E2ePhase,
  fixtures: E2eFixtures,
  detail: string,
) {
  return jsonWithCookies(
    { ok: true, phase, fixtures, detail },
    200,
    getResponse,
  );
}

function failPhase(
  getResponse: () => NextResponse,
  phase: E2ePhase,
  fixtures: E2eFixtures,
  error: string,
  status = 500,
) {
  return jsonWithCookies(
    { ok: false, phase, fixtures, error },
    status,
    getResponse,
  );
}

async function phaseClient(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  fixtures: E2eFixtures,
  getResponse: () => NextResponse,
) {
  const stamp = Date.now();
  const { data, error } = await admin
    .from('clients')
    .insert({
      name: BOT_NAME,
      phone_wa: `+9665${String(stamp).slice(-8)}`,
      email: `e2e.bot.${stamp}@wanderloom.test`,
      lead_source: 'e2e_system_test',
    })
    .select('id')
    .single();

  if (error || data?.id == null) {
    // Retry without optional columns
    const retry = await admin
      .from('clients')
      .insert({
        name: BOT_NAME,
        phone_wa: `+9665${String(stamp + 1).slice(-8)}`,
        email: `e2e.bot.${stamp}@wanderloom.test`,
      })
      .select('id')
      .single();
    if (retry.error || retry.data?.id == null) {
      return failPhase(
        getResponse,
        'client',
        fixtures,
        retry.error?.message || error?.message || 'فشل إنشاء العميل الوهمي',
      );
    }
    const next = mergeFixtures(fixtures, { clientId: retry.data.id });
    return okPhase(getResponse, 'client', next, `client_id=${retry.data.id}`);
  }

  const next = mergeFixtures(fixtures, { clientId: data.id });
  return okPhase(getResponse, 'client', next, `client_id=${data.id}`);
}

async function phaseQuotation(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  fixtures: E2eFixtures,
  getResponse: () => NextResponse,
) {
  if (fixtures.clientId == null) {
    return failPhase(getResponse, 'quotation', fixtures, 'clientId مفقود', 400);
  }

  const insert = await admin
    .from('quotations')
    .insert({
      client_id: fixtures.clientId,
      title: `${BOT_NAME} عرض سعر فردي`,
      destinations: ['كوريا'],
      start_date: '2026-09-01',
      end_date: '2026-09-08',
      total_estimated_cost: 1000,
      expected_profit: 200,
      status: 'pending_client',
    })
    .select('id')
    .single();

  if (insert.error || insert.data?.id == null) {
    const retry = await admin
      .from('quotations')
      .insert({
        client_id: fixtures.clientId,
        title: `${BOT_NAME} عرض سعر فردي`,
        status: 'draft',
      })
      .select('id')
      .single();
    if (retry.error || retry.data?.id == null) {
      return failPhase(
        getResponse,
        'quotation',
        fixtures,
        retry.error?.message || insert.error?.message || 'فشل إنشاء عرض السعر',
      );
    }
    const next = mergeFixtures(fixtures, { quotationId: retry.data.id });
    return okPhase(
      getResponse,
      'quotation',
      next,
      `quotation_id=${retry.data.id}`,
    );
  }

  const next = mergeFixtures(fixtures, { quotationId: insert.data.id });
  return okPhase(
    getResponse,
    'quotation',
    next,
    `quotation_id=${insert.data.id}`,
  );
}

async function phaseGroup(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  fixtures: E2eFixtures,
  getResponse: () => NextResponse,
) {
  if (fixtures.clientId == null) {
    return failPhase(getResponse, 'group', fixtures, 'clientId مفقود', 400);
  }

  let groupId = fixtures.groupId;
  let createdTrip = fixtures.createdTrip;

  if (groupId == null) {
    const active = await admin
      .from('group_trips')
      .select('id, title_ar, is_active, max_seats, booked_seats')
      .neq('is_active', false)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (active.data?.id != null) {
      groupId = active.data.id as string | number;
      createdTrip = false;
    } else {
      const tripInsert = await admin
        .from('group_trips')
        .insert({
          title_ar: `${BOT_NAME} Trip`,
          title_en: `${BOT_NAME} Trip`,
          description_ar: 'رحلة وهمية لاختبار E2E',
          description_en: 'Dummy trip for E2E',
          badge_ar: 'E2E',
          badge_en: 'E2E',
          is_active: true,
          max_seats: 20,
          booked_seats: 0,
        })
        .select('id')
        .single();

      if (tripInsert.error || tripInsert.data?.id == null) {
        const lean = await admin
          .from('group_trips')
          .insert({
            title_ar: `${BOT_NAME} Trip`,
            title_en: `${BOT_NAME} Trip`,
            description_ar: 'E2E',
            description_en: 'E2E',
            badge_ar: 'E2E',
            badge_en: 'E2E',
            is_active: true,
          })
          .select('id')
          .single();
        if (lean.error || lean.data?.id == null) {
          return failPhase(
            getResponse,
            'group',
            fixtures,
            lean.error?.message ||
              tripInsert.error?.message ||
              'فشل إنشاء / إيجاد رحلة جماعية',
          );
        }
        groupId = lean.data.id;
      } else {
        groupId = tripInsert.data.id;
      }
      createdTrip = true;
    }
  }

  const linkPayload: Record<string, unknown> = {
    client_id: fixtures.clientId,
    group_id: groupId,
    status: 'confirmed_seat',
    payment_status: 'pending',
    customer_name: BOT_NAME,
  };

  let { data: member, error: linkError } = await admin
    .from('group_members')
    .insert(linkPayload)
    .select('id')
    .single();

  if (linkError && /payment_status|customer_name|column|schema cache/i.test(linkError.message)) {
    const lean = {
      client_id: fixtures.clientId,
      group_id: groupId,
      status: 'confirmed_seat',
    };
    const retry = await admin.from('group_members').insert(lean).select('id').single();
    member = retry.data;
    linkError = retry.error;
  }

  if (linkError && (linkError.code === '23505' || /duplicate|unique/i.test(linkError.message))) {
    const upd = await admin
      .from('group_members')
      .update({
        group_id: groupId,
        status: 'confirmed_seat',
        payment_status: 'pending',
        customer_name: BOT_NAME,
      })
      .eq('client_id', fixtures.clientId)
      .select('id')
      .maybeSingle();
    if (upd.error || upd.data?.id == null) {
      return failPhase(
        getResponse,
        'group',
        mergeFixtures(fixtures, { groupId, createdTrip }),
        upd.error?.message || linkError.message,
      );
    }
    member = upd.data;
    linkError = null;
  }

  if (linkError || member?.id == null) {
    return failPhase(
      getResponse,
      'group',
      mergeFixtures(fixtures, { groupId, createdTrip }),
      linkError?.message || 'فشل ربط العميل بالمجموعة',
    );
  }

  // Best-effort seat bump (ignore errors)
  if (groupId != null) {
    const trip = await admin
      .from('group_trips')
      .select('booked_seats')
      .eq('id', groupId)
      .maybeSingle();
    const booked = Math.max(0, Number(trip.data?.booked_seats) || 0);
    await admin
      .from('group_trips')
      .update({ booked_seats: booked + 1 })
      .eq('id', groupId);
  }

  const next = mergeFixtures(fixtures, {
    groupId,
    memberId: String(member.id),
    createdTrip,
  });
  return okPhase(
    getResponse,
    'group',
    next,
    `group_id=${groupId} · member_id=${member.id}`,
  );
}

async function phaseCleanup(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  fixtures: E2eFixtures,
  getResponse: () => NextResponse,
) {
  const notes: string[] = [];

  if (fixtures.memberId) {
    const { error } = await admin
      .from('group_members')
      .delete()
      .eq('id', fixtures.memberId);
    notes.push(error ? `member: ${error.message}` : 'group_members deleted');
  } else if (fixtures.clientId != null) {
    const { error } = await admin
      .from('group_members')
      .delete()
      .eq('client_id', fixtures.clientId);
    notes.push(error ? `member(client): ${error.message}` : 'group_members by client deleted');
  }

  if (fixtures.groupId != null && fixtures.createdTrip) {
    const { error } = await admin
      .from('group_trips')
      .delete()
      .eq('id', fixtures.groupId);
    notes.push(error ? `trip: ${error.message}` : 'dummy group_trips deleted');
  } else if (fixtures.groupId != null) {
    const trip = await admin
      .from('group_trips')
      .select('booked_seats')
      .eq('id', fixtures.groupId)
      .maybeSingle();
    const booked = Math.max(0, Number(trip.data?.booked_seats) || 0);
    if (booked > 0) {
      await admin
        .from('group_trips')
        .update({ booked_seats: booked - 1 })
        .eq('id', fixtures.groupId);
      notes.push('booked_seats decremented');
    }
  }

  if (fixtures.quotationId != null) {
    const { error } = await admin
      .from('quotations')
      .delete()
      .eq('id', fixtures.quotationId);
    notes.push(error ? `quotation: ${error.message}` : 'quotation deleted');
  } else if (fixtures.clientId != null) {
    const { error } = await admin
      .from('quotations')
      .delete()
      .eq('client_id', fixtures.clientId);
    notes.push(
      error ? `quotation(client): ${error.message}` : 'quotations by client deleted',
    );
  }

  if (fixtures.clientId != null) {
    // Wipe dependents that may block delete
    await admin.from('itineraries').delete().eq('client_id', fixtures.clientId);
    const { error } = await admin
      .from('clients')
      .delete()
      .eq('id', fixtures.clientId);
    notes.push(error ? `client: ${error.message}` : 'client deleted');
  }

  // Sweep any leftover bots by name
  const { data: leftovers } = await admin
    .from('clients')
    .select('id')
    .eq('name', BOT_NAME)
    .limit(20);
  if (leftovers?.length) {
    const ids = leftovers.map((r) => r.id);
    await admin.from('group_members').delete().in('client_id', ids);
    await admin.from('quotations').delete().in('client_id', ids);
    await admin.from('itineraries').delete().in('client_id', ids);
    const { error } = await admin.from('clients').delete().in('id', ids);
    notes.push(
      error
        ? `sweep: ${error.message}`
        : `swept ${ids.length} leftover ${BOT_NAME} client(s)`,
    );
  }

  // Sweep dummy trips we created
  const { data: dummyTrips } = await admin
    .from('group_trips')
    .select('id')
    .eq('title_ar', `${BOT_NAME} Trip`)
    .limit(20);
  if (dummyTrips?.length) {
    const tripIds = dummyTrips.map((r) => r.id);
    await admin.from('group_members').delete().in('group_id', tripIds);
    const { error } = await admin.from('group_trips').delete().in('id', tripIds);
    notes.push(
      error
        ? `trip sweep: ${error.message}`
        : `swept ${tripIds.length} dummy trip(s)`,
    );
  }

  return okPhase(
    getResponse,
    'cleanup',
    emptyFixtures(),
    notes.join(' · ') || 'cleanup complete',
  );
}

export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'server_config' },
      { status: 503 },
    );
  }

  const auth = await authorizeAdmin(request, admin);
  if (!auth.ok) {
    return jsonWithCookies(
      { ok: false, error: auth.error },
      auth.status,
      auth.getResponse,
    );
  }

  let body: PhaseBody = {};
  try {
    body = (await request.json()) as PhaseBody;
  } catch {
    body = {};
  }

  const phase = body.phase;
  const fixtures = mergeFixtures(emptyFixtures(), body.fixtures);

  if (!phase || !['client', 'quotation', 'group', 'cleanup'].includes(phase)) {
    return failPhase(
      auth.getResponse,
      'client',
      fixtures,
      'phase مطلوب: client | quotation | group | cleanup',
      400,
    );
  }

  try {
    switch (phase) {
      case 'client':
        return await phaseClient(admin, fixtures, auth.getResponse);
      case 'quotation':
        return await phaseQuotation(admin, fixtures, auth.getResponse);
      case 'group':
        return await phaseGroup(admin, fixtures, auth.getResponse);
      case 'cleanup':
        return await phaseCleanup(admin, fixtures, auth.getResponse);
      default:
        return failPhase(auth.getResponse, 'client', fixtures, 'phase غير معروف', 400);
    }
  } catch (err) {
    return failPhase(
      auth.getResponse,
      phase,
      fixtures,
      err instanceof Error ? err.message : 'خطأ غير متوقع',
    );
  }
}
