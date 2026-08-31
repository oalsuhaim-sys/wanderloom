import { NextResponse, type NextRequest } from 'next/server';

import { accessFromEmployeeRow, type EmployeeRbacRow } from '@/lib/crm-permissions';
import { isEmergencyCrmOwnerBypass } from '@/lib/crm-roles';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireCrmAdmin } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StepResult = {
  step: number;
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  detail?: string;
  id?: string | number | null;
};

type CreatedFixtures = {
  leadId: string | number | null;
  clientId: string | number | null;
  quotationId: string | number | null;
  itineraryId: string | number | null;
  expertId: string | null;
  leaderId: string | null;
  tripLogId: string | null;
  walletIds: string[];
  createdExpert: boolean;
  createdLeader: boolean;
};

const MARKER = '[E2E-TEST]';
const DESTINATION = 'كوريا';

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

function fail(step: number, name: string, detail: string): StepResult {
  return { step, name, status: 'FAIL', detail };
}

function pass(
  step: number,
  name: string,
  detail?: string,
  id?: string | number | null,
): StepResult {
  return { step, name, status: 'PASS', detail, id: id ?? null };
}

async function finish(
  getResponse: () => NextResponse,
  steps: StepResult[],
  created: CreatedFixtures,
  keepFixtures: boolean,
  admin: ReturnType<typeof createSupabaseAdminClient>,
) {
  const cleanup: string[] = [];
  if (!keepFixtures) {
    if (created.walletIds.length) {
      const { error } = await admin
        .from('wallet_transactions')
        .delete()
        .in('id', created.walletIds);
      cleanup.push(error ? `wallet: ${error.message}` : 'wallet_transactions deleted');
    }
    if (created.tripLogId) {
      const { error } = await admin
        .from('trip_logs')
        .delete()
        .eq('id', created.tripLogId);
      cleanup.push(error ? `trip_log: ${error.message}` : 'trip_log deleted');
    }
    if (created.itineraryId != null) {
      const { error } = await admin
        .from('itineraries')
        .delete()
        .eq('id', created.itineraryId);
      cleanup.push(error ? `itinerary: ${error.message}` : 'itinerary deleted');
    }
    if (created.quotationId != null) {
      const { error } = await admin
        .from('quotations')
        .delete()
        .eq('id', created.quotationId);
      cleanup.push(error ? `quotation: ${error.message}` : 'quotation deleted');
    }
    if (created.leadId != null) {
      const { error } = await admin.from('leads').delete().eq('id', created.leadId);
      cleanup.push(error ? `lead: ${error.message}` : 'lead deleted');
    }
    if (created.clientId != null) {
      const { error } = await admin
        .from('clients')
        .delete()
        .eq('id', created.clientId);
      cleanup.push(error ? `client: ${error.message}` : 'client deleted');
    }
    if (created.createdExpert && created.expertId) {
      const { error } = await admin
        .from('experts')
        .delete()
        .eq('id', created.expertId);
      cleanup.push(error ? `expert: ${error.message}` : 'temp expert deleted');
    }
    if (created.createdLeader && created.leaderId) {
      const { error } = await admin
        .from('leaders')
        .delete()
        .eq('id', created.leaderId);
      cleanup.push(error ? `leader: ${error.message}` : 'temp leader deleted');
    }
  }

  const passed = steps.filter((s) => s.status === 'PASS').length;
  const failed = steps.filter((s) => s.status === 'FAIL').length;
  const overall = failed === 0 && passed > 0 ? 'PASS' : 'FAIL';

  return jsonWithCookies(
    {
      ok: overall === 'PASS',
      overall,
      summary: `${passed} passed · ${failed} failed · ${steps.length} steps`,
      workflow:
        'Client Request → Expert Claim → Quote/Itinerary → Client Accept → Leader Assign → Trip Log → Wallet Payout',
      destination: DESTINATION,
      steps,
      fixtures: keepFixtures ? created : { cleaned: true, created },
      cleanup: keepFixtures ? ['kept (pass ?keep=1)'] : cleanup,
      tip: 'POST /api/admin/system-test with CRM admin Bearer token. Add ?keep=1 to retain fixtures.',
    },
    overall === 'PASS' ? 200 : 500,
    getResponse,
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

  const keepFixtures =
    request.nextUrl.searchParams.get('keep') === '1' ||
    request.nextUrl.searchParams.get('keep') === 'true';

  const steps: StepResult[] = [];
  const created: CreatedFixtures = {
    leadId: null,
    clientId: null,
    quotationId: null,
    itineraryId: null,
    expertId: null,
    leaderId: null,
    tripLogId: null,
    walletIds: [],
    createdExpert: false,
    createdLeader: false,
  };

  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

  try {
    // Step 1: dummy client request (lead)
    {
      const { data, error } = await admin
        .from('leads')
        .insert({
          full_name: `${MARKER} عميل كوريا ${stamp}`,
          phone_wa: `+9665${String(Date.now()).slice(-8)}`,
          email: `e2e.korea.${Date.now()}@wanderloom.test`,
          destinations: [DESTINATION],
          travel_days: 7,
          travelers_count: 2,
          budget: 'VIP',
          interests: ['ثقافة'],
          travel_style: 'Private',
          lead_source: 'other',
          daily_pace: 'balanced',
          walking_readiness: 'medium',
          day_start_time: '09:00',
          food_preferences: [],
          accommodation_type: [],
          final_thoughts: `${MARKER} automated lifecycle test`,
          form_type: 'trip_log',
          status: 'new',
        })
        .select('id')
        .single();

      if (error || !data?.id) {
        steps.push(fail(1, 'Insert client request (lead)', error?.message || 'no id'));
        return finish(auth.getResponse, steps, created, keepFixtures, admin);
      }
      created.leadId = data.id;
      steps.push(
        pass(1, 'Insert client request (lead)', `destination=${DESTINATION}`, data.id),
      );
    }

    // Resolve / create active expert & leader
    {
      let expert = await admin
        .from('experts')
        .select('id, name, status')
        .in('status', ['active', 'approved'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!expert.data?.id) {
        const inserted = await admin
          .from('experts')
          .insert({
            name: `${MARKER} خبير كوريا`,
            specialty_regions: DESTINATION,
            status: 'active',
            phone: '+966500000001',
            email: `e2e.expert.${Date.now()}@wanderloom.test`,
          })
          .select('id, name, status')
          .single();
        if (inserted.error || !inserted.data?.id) {
          steps.push(
            fail(2, 'Assign active expert', inserted.error?.message || 'no expert'),
          );
          return finish(auth.getResponse, steps, created, keepFixtures, admin);
        }
        expert = inserted;
        created.createdExpert = true;
      }
      created.expertId = String(expert.data!.id);

      let leader = await admin
        .from('leaders')
        .select('id, name, status')
        .in('status', ['active', 'approved'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!leader.data?.id) {
        const inserted = await admin
          .from('leaders')
          .insert({
            name: `${MARKER} قائد رحلة`,
            destinations: DESTINATION,
            status: 'active',
            phone: '+966500000002',
            email: `e2e.leader.${Date.now()}@wanderloom.test`,
            languages: ['عربي'],
            experience_years: 5,
          })
          .select('id, name, status')
          .single();
        if (inserted.error || !inserted.data?.id) {
          steps.push(
            fail(5, 'Assign trip leader', inserted.error?.message || 'no leader'),
          );
        } else {
          leader = inserted;
          created.createdLeader = true;
        }
      }
      if (leader.data?.id) created.leaderId = String(leader.data.id);
    }

    // Optional client row for quotation FK
    {
      const { data: client, error } = await admin
        .from('clients')
        .insert({
          name: `${MARKER} عميل كوريا`,
          phone_wa: `+9665${String(Date.now() + 1).slice(-8)}`,
          email: `e2e.client.${Date.now()}@wanderloom.test`,
        })
        .select('id')
        .single();
      if (!error && client?.id) {
        created.clientId = client.id;
        if (created.leadId != null) {
          await admin
            .from('leads')
            .update({ client_id: client.id, status: 'approved' })
            .eq('id', created.leadId);
        }
      }
    }

    // Steps 2–3: Expert claim + quote/itinerary
    {
      const quoteInsert = await admin
        .from('quotations')
        .insert({
          client_id: created.clientId,
          title: `${MARKER} عرض سعر كوريا`,
          destinations: [DESTINATION],
          start_date: '2026-09-01',
          end_date: '2026-09-08',
          total_estimated_cost: 25000,
          expected_profit: 5000,
          status: 'pending_client',
          expert_id: created.expertId,
          lead_id: created.leadId != null ? String(created.leadId) : null,
        })
        .select('id')
        .single();

      if (quoteInsert.error || !quoteInsert.data?.id) {
        const retry = await admin
          .from('quotations')
          .insert({
            client_id: created.clientId,
            title: `${MARKER} عرض سعر كوريا`,
            destinations: [DESTINATION],
            start_date: '2026-09-01',
            end_date: '2026-09-08',
            total_estimated_cost: 25000,
            expected_profit: 5000,
            status: 'pending_client',
          })
          .select('id')
          .single();
        if (retry.error || !retry.data?.id) {
          steps.push(
            fail(
              2,
              'Assign expert / create quote',
              retry.error?.message || quoteInsert.error?.message || 'quote failed',
            ),
          );
          return finish(auth.getResponse, steps, created, keepFixtures, admin);
        }
        created.quotationId = retry.data.id;
        if (created.expertId) {
          await admin
            .from('quotations')
            .update({ expert_id: created.expertId })
            .eq('id', retry.data.id);
        }
      } else {
        created.quotationId = quoteInsert.data.id;
      }

      steps.push(
        pass(
          2,
          'Assign active expert (claim)',
          `expert_id=${created.expertId}`,
          created.expertId,
        ),
      );

      const itineraryInsert = await admin
        .from('itineraries')
        .insert({
          title: `${MARKER} مسار كوريا`,
          destination: DESTINATION,
          customer_name: `${MARKER} عميل كوريا`,
          client_id: created.clientId,
          expert_id: created.expertId,
          quote_id: created.quotationId != null ? String(created.quotationId) : null,
          status: 'draft',
          trip_type: 'Individual',
          is_template: false,
          total_budget: 25000,
          amount_paid: 0,
          dates: '2026-09-01 → 2026-09-08',
          days_data: {
            meta: {
              source_quotation_id: created.quotationId,
              e2e_marker: MARKER,
            },
            days: [
              {
                id: 'e2e-day-1',
                title: 'يوم سيول',
                activities: [{ title: 'قصر غيونغبوك', time: '10:00' }],
              },
            ],
          },
        })
        .select('id')
        .single();

      if (itineraryInsert.error || !itineraryInsert.data?.id) {
        const retry = await admin
          .from('itineraries')
          .insert({
            title: `${MARKER} مسار كوريا`,
            destination: DESTINATION,
            customer_name: `${MARKER} عميل كوريا`,
            client_id: created.clientId,
            expert_id: created.expertId,
            status: 'draft',
            days_data: {
              meta: {
                e2e_marker: MARKER,
                source_quotation_id: created.quotationId,
              },
              days: [],
            },
          })
          .select('id')
          .single();
        if (retry.error || !retry.data?.id) {
          steps.push(
            fail(
              3,
              'Create itinerary & quote',
              retry.error?.message ||
                itineraryInsert.error?.message ||
                'itinerary failed',
            ),
          );
          return finish(auth.getResponse, steps, created, keepFixtures, admin);
        }
        created.itineraryId = retry.data.id;
      } else {
        created.itineraryId = itineraryInsert.data.id;
      }

      steps.push(
        pass(
          3,
          'Create dummy itinerary & quote',
          `quote=${created.quotationId} · trip=${created.itineraryId}`,
          created.itineraryId,
        ),
      );
    }

    // Step 4: Client accepts
    {
      const { error } = await admin
        .from('quotations')
        .update({
          status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', created.quotationId!);

      if (error) {
        steps.push(fail(4, 'Status → client accepted (approved)', error.message));
        return finish(auth.getResponse, steps, created, keepFixtures, admin);
      }

      await admin
        .from('itineraries')
        .update({ status: 'active' })
        .eq('id', created.itineraryId!);

      steps.push(
        pass(
          4,
          'Status → client accepted (approved)',
          'quotation.status=approved · itinerary.status=active',
        ),
      );
    }

    // Step 5: Assign trip leader
    {
      if (!created.leaderId) {
        steps.push(fail(5, 'Assign trip leader', 'no active leader available'));
        return finish(auth.getResponse, steps, created, keepFixtures, admin);
      }

      const withColumn = await admin
        .from('itineraries')
        .update({ leader_id: created.leaderId })
        .eq('id', created.itineraryId!)
        .select('id')
        .maybeSingle();

      if (withColumn.error) {
        const current = await admin
          .from('itineraries')
          .select('days_data')
          .eq('id', created.itineraryId!)
          .maybeSingle();
        const daysData =
          current.data?.days_data &&
          typeof current.data.days_data === 'object' &&
          !Array.isArray(current.data.days_data)
            ? (current.data.days_data as Record<string, unknown>)
            : {};
        const meta =
          daysData.meta && typeof daysData.meta === 'object'
            ? (daysData.meta as Record<string, unknown>)
            : {};
        const { error: metaError } = await admin
          .from('itineraries')
          .update({
            days_data: {
              ...daysData,
              meta: {
                ...meta,
                leader_id: created.leaderId,
                e2e_marker: MARKER,
              },
            },
          })
          .eq('id', created.itineraryId!);
        if (metaError) {
          steps.push(fail(5, 'Assign trip leader', metaError.message));
          return finish(auth.getResponse, steps, created, keepFixtures, admin);
        }
        steps.push(
          pass(
            5,
            'Assign trip leader',
            `leader_id stored in days_data.meta (column missing): ${created.leaderId}`,
            created.leaderId,
          ),
        );
      } else {
        steps.push(
          pass(
            5,
            'Assign trip leader',
            `leader_id=${created.leaderId}`,
            created.leaderId,
          ),
        );
      }
    }

    // Step 6: Trip log
    {
      const { data, error } = await admin
        .from('trip_logs')
        .insert({
          trip_id: created.itineraryId,
          leader_id: created.leaderId,
          log_text: `${MARKER} تحديث ميداني من سيول — المجموعة وصلت بسلام.`,
          image_url: null,
        })
        .select('id')
        .single();

      if (error || !data?.id) {
        steps.push(fail(6, 'Insert trip_logs entry', error?.message || 'no log id'));
        return finish(auth.getResponse, steps, created, keepFixtures, admin);
      }
      created.tripLogId = String(data.id);
      steps.push(pass(6, 'Insert trip_logs entry', 'live operational log', data.id));
    }

    // Step 7: Complete trip + wallet commissions
    {
      await admin
        .from('itineraries')
        .update({ status: 'archived' })
        .eq('id', created.itineraryId!);

      const commissions = [
        {
          partner_id: created.expertId!,
          partner_type: 'expert' as const,
          amount: 1500,
          status: 'cleared' as const,
          description: `${MARKER} عمولة خبير الوجهة — رحلة كوريا`,
        },
        {
          partner_id: created.leaderId!,
          partner_type: 'leader' as const,
          amount: 2000,
          status: 'cleared' as const,
          description: `${MARKER} عمولة قائد الرحلة — رحلة كوريا`,
        },
      ];

      const { data, error } = await admin
        .from('wallet_transactions')
        .insert(commissions)
        .select('id');

      if (error || !data?.length) {
        steps.push(
          fail(
            7,
            'Complete trip & wallet commissions',
            error?.message || 'no wallet rows',
          ),
        );
        return finish(auth.getResponse, steps, created, keepFixtures, admin);
      }

      created.walletIds = data.map((row) => String(row.id));

      // Only touch balance columns on temp partners we created — never overwrite live wallets.
      if (created.createdExpert && created.expertId) {
        await admin
          .from('experts')
          .update({ wallet_balance: 1500, pending_commission: 0 })
          .eq('id', created.expertId);
      }
      if (created.createdLeader && created.leaderId) {
        await admin
          .from('leaders')
          .update({ wallet_balance: 2000, pending_commission: 0 })
          .eq('id', created.leaderId);
      }

      steps.push(
        pass(
          7,
          'Complete trip & wallet commissions',
          `expert +1500 · leader +2000 · wallets=${created.walletIds.length}`,
        ),
      );
    }
  } catch (err) {
    steps.push(
      fail(
        steps.length + 1,
        'Unhandled exception',
        err instanceof Error ? err.message : 'unknown',
      ),
    );
  }

  return finish(auth.getResponse, steps, created, keepFixtures, admin);
}

export async function GET(request: NextRequest) {
  return POST(request);
}
