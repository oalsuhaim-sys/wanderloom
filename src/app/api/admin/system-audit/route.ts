import { NextResponse, type NextRequest } from 'next/server';

import { accessFromEmployeeRow, type EmployeeRbacRow } from '@/lib/crm-permissions';
import { isEmergencyCrmOwnerBypass } from '@/lib/crm-roles';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireCrmAdmin } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QA_PARTNER = 'QA_TEST_PARTNER';
const QA_CLIENT = 'QA_TEST_CLIENT';
const QA_TRIP = 'QA_TEST_TRIP';

type LogStatus = 'loading' | 'success' | 'error' | 'info';

type AuditLog = {
  time: string;
  step: string;
  status: LogStatus;
  details: string;
  code?: string;
};

type DbErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
} | null;

function nowIso() {
  return new Date().toISOString();
}

function assertDB(
  data: unknown,
  error: DbErrorLike,
  stepName: string,
): asserts data is NonNullable<typeof data> {
  if (error || data == null) {
    const code = error?.code ? ` code=${error.code}` : '';
    const hint = error?.hint ? ` hint=${error.hint}` : '';
    const details = error?.details ? ` details=${error.details}` : '';
    throw new Error(
      `[${stepName}] DB Error:${code} ${error?.message || 'No data returned'}${hint}${details}`,
    );
  }
}

function assertEquals(
  actual: unknown,
  expected: unknown,
  stepName: string,
  field: string,
) {
  if (String(actual ?? '') !== String(expected ?? '')) {
    throw new Error(
      `[${stepName}] VERIFY FAIL: ${field} expected="${expected}" got="${actual}"`,
    );
  }
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

export async function POST(request: NextRequest) {
  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const auth = await authorizeAdmin(request, admin);
  if (!auth.ok) {
    const response = NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
    auth.getResponse()
      .cookies.getAll()
      .forEach((cookie) => response.cookies.set(cookie));
    return response;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (entry: AuditLog | { type: 'done'; ok: boolean }) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(entry)}\n`));
      };

      const log = (
        step: string,
        status: LogStatus,
        details: string,
        code?: string,
      ) => {
        push({ time: nowIso(), step, status, details, code });
      };

      // Tracking IDs — defined at top for guaranteed cleanup
      let dSupplierId: string | number | null = null;
      let dClientId: string | number | null = null;
      let dQuotationId: string | number | null = null;
      let dTripId: string | number | null = null;
      let dMemberId: string | number | null = null;
      let auditOk = false;

      try {
        log('BOOT', 'info', 'Starting enterprise E2E diagnostic (Write → Read → Verify)');

        // ═══════════════════════════════════════════
        // PHASE 1: PARTNERS (الشركاء)
        // ═══════════════════════════════════════════
        log('PHASE_1', 'loading', 'الشركاء — INSERT QA_TEST_PARTNER');

        {
          const stamp = Date.now();
          let inserted: { id?: string | number } | null = null;
          let insertError: DbErrorLike = null;

          const full = await admin
            .from('suppliers')
            .insert({
              name: QA_PARTNER,
              category: 'hotel',
              country: 'كوريا',
              city: 'سيول',
              destination: 'كوريا',
              contact_person: 'QA Bot',
              phone: `+9665${String(stamp).slice(-8)}`,
              email: `qa.partner.${stamp}@wanderloom.test`,
              services_provided: 'E2E diagnostic fixture',
            })
            .select('id')
            .single();

          if (full.error || !full.data?.id) {
            const lean = await admin
              .from('suppliers')
              .insert({
                name: QA_PARTNER,
                category: 'hotel',
                country: 'كوريا',
                contact_person: 'QA Bot',
                phone: `+9665${String(stamp + 1).slice(-8)}`,
                email: `qa.partner.${stamp}@wanderloom.test`,
                services_provided: 'E2E diagnostic fixture',
              })
              .select('id')
              .single();
            inserted = lean.data;
            insertError = lean.error;
          } else {
            inserted = full.data;
          }

          assertDB(inserted, insertError, 'PARTNER_INSERT');
          dSupplierId = inserted.id as string | number;
          log(
            'PARTNER_INSERT',
            'success',
            `Wrote supplier id=${dSupplierId}`,
          );

          log('PARTNER_VERIFY', 'loading', `SELECT suppliers WHERE id=${dSupplierId}`);
          const verify = await admin
            .from('suppliers')
            .select('id, name')
            .eq('id', dSupplierId)
            .single();
          assertDB(verify.data, verify.error, 'PARTNER_VERIFY');
          assertEquals(verify.data.name, QA_PARTNER, 'PARTNER_VERIFY', 'name');
          log(
            'PARTNER_VERIFY',
            'success',
            `Read-back OK — name="${verify.data.name}"`,
          );
        }

        // ═══════════════════════════════════════════
        // PHASE 2: INDIVIDUAL FLOW (العميل الفرد)
        // ═══════════════════════════════════════════
        log('PHASE_2', 'loading', 'الأفراد — INSERT QA_TEST_CLIENT');

        {
          const stamp = Date.now();
          let clientRow: { id?: string | number } | null = null;
          let clientErr: DbErrorLike = null;

          const full = await admin
            .from('clients')
            .insert({
              name: QA_CLIENT,
              phone_wa: `+9665${String(stamp).slice(-8)}`,
              email: `qa.client.${stamp}@wanderloom.test`,
              lead_source: 'qa_system_audit',
            })
            .select('id')
            .single();

          if (full.error || !full.data?.id) {
            const lean = await admin
              .from('clients')
              .insert({
                name: QA_CLIENT,
                phone_wa: `+9665${String(stamp + 1).slice(-8)}`,
                email: `qa.client.${stamp}@wanderloom.test`,
              })
              .select('id')
              .single();
            clientRow = lean.data;
            clientErr = lean.error;
          } else {
            clientRow = full.data;
          }

          assertDB(clientRow, clientErr, 'CLIENT_INSERT');
          dClientId = clientRow.id as string | number;
          log('CLIENT_INSERT', 'success', `Wrote client id=${dClientId}`);

          log('CLIENT_VERIFY', 'loading', `SELECT clients WHERE id=${dClientId}`);
          const verifyClient = await admin
            .from('clients')
            .select('id, name')
            .eq('id', dClientId)
            .single();
          assertDB(verifyClient.data, verifyClient.error, 'CLIENT_VERIFY');
          assertEquals(verifyClient.data.name, QA_CLIENT, 'CLIENT_VERIFY', 'name');
          log(
            'CLIENT_VERIFY',
            'success',
            `Read-back OK — name="${verifyClient.data.name}"`,
          );
        }

        {
          log('QUOTE_INSERT', 'loading', `INSERT quotation linked to client=${dClientId}`);
          let quoteRow: { id?: string | number } | null = null;
          let quoteErr: DbErrorLike = null;

          const full = await admin
            .from('quotations')
            .insert({
              client_id: dClientId,
              title: `${QA_CLIENT} Quotation`,
              destinations: ['كوريا'],
              start_date: '2026-10-01',
              end_date: '2026-10-08',
              total_estimated_cost: 15000,
              expected_profit: 3000,
              status: 'pending_client',
            })
            .select('id, status')
            .single();

          if (full.error || !full.data?.id) {
            const lean = await admin
              .from('quotations')
              .insert({
                client_id: dClientId,
                title: `${QA_CLIENT} Quotation`,
                status: 'draft',
              })
              .select('id, status')
              .single();
            quoteRow = lean.data;
            quoteErr = lean.error;
          } else {
            quoteRow = full.data;
          }

          assertDB(quoteRow, quoteErr, 'QUOTE_INSERT');
          dQuotationId = quoteRow.id as string | number;
          log(
            'QUOTE_INSERT',
            'success',
            `Wrote quotation id=${dQuotationId} status=${(quoteRow as { status?: string }).status ?? '?'}`,
          );

          // Prefer 'accepted' per audit plan; fall back to 'approved' (live CRM enum)
          log('QUOTE_UPDATE', 'loading', `UPDATE status → accepted/approved`);
          let savedStatus = 'accepted';
          let upd = await admin
            .from('quotations')
            .update({ status: 'accepted' })
            .eq('id', dQuotationId)
            .select('id, status')
            .single();

          if (upd.error) {
            savedStatus = 'approved';
            upd = await admin
              .from('quotations')
              .update({ status: 'approved' })
              .eq('id', dQuotationId)
              .select('id, status')
              .single();
          }

          assertDB(upd.data, upd.error, 'QUOTE_UPDATE');
          log(
            'QUOTE_UPDATE',
            'success',
            `UPDATE wrote status="${upd.data.status}"`,
          );

          log('QUOTE_VERIFY', 'loading', `SELECT quotations WHERE id=${dQuotationId}`);
          const verifyQuote = await admin
            .from('quotations')
            .select('id, status, client_id')
            .eq('id', dQuotationId)
            .single();
          assertDB(verifyQuote.data, verifyQuote.error, 'QUOTE_VERIFY');
          assertEquals(
            verifyQuote.data.client_id,
            dClientId,
            'QUOTE_VERIFY',
            'client_id',
          );
          assertEquals(
            verifyQuote.data.status,
            savedStatus,
            'QUOTE_VERIFY',
            'status',
          );
          log(
            'QUOTE_VERIFY',
            'success',
            `Read-back OK — status="${verifyQuote.data.status}" client_id=${verifyQuote.data.client_id}`,
          );
        }

        // ═══════════════════════════════════════════
        // PHASE 3: GROUP FLOW (القروبات)
        // ═══════════════════════════════════════════
        log('PHASE_3', 'loading', 'القروبات — INSERT QA_TEST_TRIP');

        {
          let tripRow: { id?: string | number } | null = null;
          let tripErr: DbErrorLike = null;

          const full = await admin
            .from('group_trips')
            .insert({
              title_ar: QA_TRIP,
              title_en: QA_TRIP,
              description_ar: 'رحلة وهمية للفحص التشخيصي',
              description_en: 'QA diagnostic fixture trip',
              badge_ar: 'QA',
              badge_en: 'QA',
              is_active: true,
              max_seats: 20,
              booked_seats: 0,
            })
            .select('id, title_ar')
            .single();

          if (full.error || !full.data?.id) {
            const lean = await admin
              .from('group_trips')
              .insert({
                title_ar: QA_TRIP,
                title_en: QA_TRIP,
                description_ar: 'QA',
                description_en: 'QA',
                badge_ar: 'QA',
                badge_en: 'QA',
                is_active: true,
              })
              .select('id, title_ar')
              .single();
            tripRow = lean.data;
            tripErr = lean.error;
          } else {
            tripRow = full.data;
          }

          assertDB(tripRow, tripErr, 'TRIP_INSERT');
          dTripId = tripRow.id as string | number;
          log('TRIP_INSERT', 'success', `Wrote trip id=${dTripId}`);

          log('TRIP_VERIFY', 'loading', `SELECT group_trips WHERE id=${dTripId}`);
          const verifyTrip = await admin
            .from('group_trips')
            .select('id, title_ar')
            .eq('id', dTripId)
            .single();
          assertDB(verifyTrip.data, verifyTrip.error, 'TRIP_VERIFY');
          assertEquals(verifyTrip.data.title_ar, QA_TRIP, 'TRIP_VERIFY', 'title_ar');
          log(
            'TRIP_VERIFY',
            'success',
            `Read-back OK — title_ar="${verifyTrip.data.title_ar}"`,
          );
        }

        {
          log(
            'MEMBER_INSERT',
            'loading',
            `INSERT group_members client=${dClientId} trip=${dTripId}`,
          );

          let memberRow: { id?: string | number } | null = null;
          let memberErr: DbErrorLike = null;

          const full = await admin
            .from('group_members')
            .insert({
              client_id: dClientId,
              group_id: dTripId,
              status: 'confirmed_seat',
              payment_status: 'pending',
              customer_name: QA_CLIENT,
            })
            .select('id')
            .single();

          if (full.error || !full.data?.id) {
            const lean = await admin
              .from('group_members')
              .insert({
                client_id: dClientId,
                group_id: dTripId,
                status: 'confirmed_seat',
              })
              .select('id')
              .single();
            memberRow = lean.data;
            memberErr = lean.error;
          } else {
            memberRow = full.data;
          }

          // Unique client_id → update in place
          if (
            memberErr &&
            (memberErr.code === '23505' ||
              /duplicate|unique/i.test(memberErr.message ?? ''))
          ) {
            const upd = await admin
              .from('group_members')
              .update({
                group_id: dTripId,
                status: 'confirmed_seat',
                payment_status: 'pending',
                customer_name: QA_CLIENT,
              })
              .eq('client_id', dClientId)
              .select('id')
              .single();
            memberRow = upd.data;
            memberErr = upd.error;
          }

          assertDB(memberRow, memberErr, 'MEMBER_INSERT');
          dMemberId = memberRow.id as string | number;
          log('MEMBER_INSERT', 'success', `Wrote member id=${dMemberId}`);

          log(
            'MEMBER_STATUS_UPDATE',
            'loading',
            `UPDATE group_members SET payment_status=paid, visa_status=issued WHERE id=${dMemberId}`,
          );

          const statusUpd = await admin
            .from('group_members')
            .update({
              payment_status: 'paid',
              visa_status: 'issued',
            })
            .eq('id', dMemberId)
            .select('id, payment_status, visa_status')
            .single();
          assertDB(statusUpd.data, statusUpd.error, 'MEMBER_STATUS_UPDATE');
          assertEquals(
            statusUpd.data.payment_status,
            'paid',
            'MEMBER_STATUS_UPDATE',
            'payment_status',
          );
          assertEquals(
            statusUpd.data.visa_status,
            'issued',
            'MEMBER_STATUS_UPDATE',
            'visa_status',
          );
          log(
            'MEMBER_STATUS_UPDATE',
            'success',
            `Wrote payment_status=paid · visa_status=issued on group_members id=${dMemberId}`,
          );

          log('MEMBER_VERIFY', 'loading', `SELECT group_members WHERE id=${dMemberId}`);
          const verifyMember = await admin
            .from('group_members')
            .select('id, client_id, group_id, payment_status, visa_status, status')
            .eq('id', dMemberId)
            .single();
          assertDB(verifyMember.data, verifyMember.error, 'MEMBER_VERIFY');
          assertEquals(
            verifyMember.data.client_id,
            dClientId,
            'MEMBER_VERIFY',
            'client_id',
          );
          assertEquals(
            verifyMember.data.group_id,
            dTripId,
            'MEMBER_VERIFY',
            'group_id',
          );
          assertEquals(
            verifyMember.data.payment_status,
            'paid',
            'MEMBER_VERIFY',
            'payment_status',
          );
          assertEquals(
            verifyMember.data.visa_status,
            'issued',
            'MEMBER_VERIFY',
            'visa_status',
          );

          log(
            'MEMBER_VERIFY',
            'success',
            `Read-back OK — payment=${verifyMember.data.payment_status} visa=${verifyMember.data.visa_status} group_id=${verifyMember.data.group_id}`,
          );
        }

        log(
          'AUDIT_COMPLETE',
          'success',
          'All pillars passed Write-Read-Verify (Partners · Individuals · Groups)',
        );
        auditOk = true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unhandled audit exception';
        const codeMatch = message.match(/code=([A-Z0-9_]+)/i);
        log('FATAL', 'error', message, codeMatch?.[1]);
        auditOk = false;
      } finally {
        // ═══════════════════════════════════════════
        // NUCLEAR CLEANUP (reverse order)
        // ═══════════════════════════════════════════
        log('CLEANUP', 'loading', 'Nuclear cleanup — reverse-order DELETE');

        const del = async (
          table: string,
          id: string | number | null,
          label: string,
        ) => {
          if (id == null) {
            log('CLEANUP', 'info', `skip ${label} (null id)`);
            return;
          }
          const { error } = await admin.from(table).delete().eq('id', id);
          if (error) {
            log(
              'CLEANUP',
              'error',
              `DELETE ${label} id=${id} failed: ${error.message}`,
              error.code,
            );
          } else {
            log('CLEANUP', 'success', `DELETE ${label} id=${id}`);
          }
        };

        await del('group_members', dMemberId, 'dMemberId');
        await del('quotations', dQuotationId, 'dQuotationId');
        await del('group_trips', dTripId, 'dTripId');

        if (dClientId != null) {
          await admin.from('itineraries').delete().eq('client_id', dClientId);
          await admin.from('group_members').delete().eq('client_id', dClientId);
          await admin.from('quotations').delete().eq('client_id', dClientId);
        }
        await del('clients', dClientId, 'dClientId');
        await del('suppliers', dSupplierId, 'dSupplierId');

        // Sweep leftovers by QA markers
        const { data: leftoverClients } = await admin
          .from('clients')
          .select('id')
          .eq('name', QA_CLIENT)
          .limit(20);
        if (leftoverClients?.length) {
          const ids = leftoverClients.map((r) => r.id);
          await admin.from('group_members').delete().in('client_id', ids);
          await admin.from('quotations').delete().in('client_id', ids);
          await admin.from('clients').delete().in('id', ids);
          log('CLEANUP', 'success', `Swept ${ids.length} leftover QA_TEST_CLIENT`);
        }

        const { data: leftoverTrips } = await admin
          .from('group_trips')
          .select('id')
          .eq('title_ar', QA_TRIP)
          .limit(20);
        if (leftoverTrips?.length) {
          const ids = leftoverTrips.map((r) => r.id);
          await admin.from('group_members').delete().in('group_id', ids);
          await admin.from('group_trips').delete().in('id', ids);
          log('CLEANUP', 'success', `Swept ${ids.length} leftover QA_TEST_TRIP`);
        }

        const { data: leftoverPartners } = await admin
          .from('suppliers')
          .select('id')
          .eq('name', QA_PARTNER)
          .limit(20);
        if (leftoverPartners?.length) {
          const ids = leftoverPartners.map((r) => r.id);
          await admin.from('suppliers').delete().in('id', ids);
          log('CLEANUP', 'success', `Swept ${ids.length} leftover QA_TEST_PARTNER`);
        }

        log(
          'CLEANUP',
          'success',
          'Zero-trace cleanup finished',
        );
        push({ type: 'done', ok: auditOk });
        controller.close();
      }
    },
  });

  const response = new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
  auth.getResponse()
    .cookies.getAll()
    .forEach((cookie) => response.cookies.set(cookie));
  return response;
}
