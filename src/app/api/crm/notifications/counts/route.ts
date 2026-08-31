import { NextResponse, type NextRequest } from 'next/server';

import {
  accessFromEmployeeRow,
  FULL_CRM_PERMISSIONS,
  type CrmProfileAccess,
  type EmployeeRbacRow,
} from '@/lib/crm-permissions';
import { isEmergencyCrmOwnerBypass } from '@/lib/crm-roles';
import {
  GROUP_ONBOARDING_LEAD_MARKER_OR,
  GROUP_ONBOARDING_PENDING_STATUSES,
} from '@/lib/crm-leads';
import { filterUpcomingBirthdays } from '@/lib/birthday-radar';
import { RADAR_INBOX_STATUS_OR } from '@/lib/lead-status';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

const GROUP_MEMBER_PENDING_STATUSES = [
  'pending_interview',
  'approved',
  'waitlisted',
] as const;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Match Partner Radar: pending + null/empty (normalizeStatus treats them as pending). */
const PENDING_PARTNER_OR = 'status.eq.pending,status.is.null';

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

function safeCount(result: {
  count: number | null;
  error: { message?: string } | null;
}): number {
  if (result.error) {
    console.warn('[crm/notifications] count failed:', result.error.message);
    return 0;
  }
  return result.count ?? 0;
}

async function authorizeCrmUser(
  request: NextRequest,
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<
  | { ok: true; access: CrmProfileAccess; getResponse: () => NextResponse }
  | {
      ok: false;
      error: string;
      status: number;
      getResponse: () => NextResponse;
    }
> {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';

  if (!token) {
    const cookieAuth = await getAuthenticatedCrmUser(request);
    if ('error' in cookieAuth) {
      return {
        ok: false,
        error: String(cookieAuth.error ?? 'غير مصرح'),
        status: cookieAuth.status ?? 401,
        getResponse: cookieAuth.getResponse,
      };
    }
    return {
      ok: true,
      access: cookieAuth.access,
      getResponse: cookieAuth.getResponse,
    };
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
    return {
      ok: true,
      access: {
        is_admin: true,
        is_expert: false,
        is_suspended: false,
        permissions: { ...FULL_CRM_PERMISSIONS },
      },
      getResponse,
    };
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

  const access = accessFromEmployeeRow(
    (employeeResult.data ?? null) as EmployeeRbacRow | null,
    user.email,
  );

  return { ok: true, access, getResponse };
}

export async function GET(request: NextRequest) {
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'server_config' },
      { status: 503 },
    );
  }

  const auth = await authorizeCrmUser(request, admin);
  if (!auth.ok) {
    return jsonWithCookies(
      { ok: false, error: auth.error },
      auth.status,
      auth.getResponse,
    );
  }
  if (auth.access.is_suspended) {
    return jsonWithCookies(
      { ok: false, error: 'الحساب معلّق' },
      403,
      auth.getResponse,
    );
  }

  const canSeeLeads =
    auth.access.is_admin || auth.access.permissions.can_access_itineraries;
  const canSeePayments = canSeeLeads;

  const [
    leaders,
    experts,
    legacyPartners,
    leads,
    groupByMarkers,
    groupMembersPending,
    paymentReviews,
  ] = await Promise.all([
      admin
        .from('leaders')
        .select('id', { count: 'exact', head: true })
        .or(PENDING_PARTNER_OR),
      admin
        .from('experts')
        .select('id', { count: 'exact', head: true })
        .or(PENDING_PARTNER_OR),
      admin
        .from('partner_applications')
        .select('id', { count: 'exact', head: true })
        .or(PENDING_PARTNER_OR)
        .in('partner_kind', ['leader', 'expert']),
      canSeeLeads
        ? admin
            .from('leads')
            .select('id', { count: 'exact', head: true })
            // Must match Radar inbox (`fetchNewCrmLeads` / RADAR_INBOX_STATUS_OR)
            .or(RADAR_INBOX_STATUS_OR)
        : Promise.resolve({ count: 0, error: null }),
      canSeeLeads
        ? admin
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .or(GROUP_ONBOARDING_LEAD_MARKER_OR)
            .in('status', [...GROUP_ONBOARDING_PENDING_STATUSES])
        : Promise.resolve({ count: 0, error: null }),
      canSeeLeads
        ? admin
            .from('group_members')
            .select('id', { count: 'exact', head: true })
            .in('status', [...GROUP_MEMBER_PENDING_STATUSES])
        : Promise.resolve({ count: 0, error: null }),
      canSeePayments
        ? admin
            .from('invoices')
            .select(
              'id, quote_id, trip_title, amount, status, client_id, receipt_url, updated_at',
              { count: 'exact' },
            )
            .or(
              'status.eq.payment_review,status.eq.awaiting_confirmation,and(status.eq.pending,receipt_url.not.is.null)',
            )
            .order('updated_at', { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [], count: 0, error: null }),
    ]);

  let pendingGroupTrips = canSeeLeads ? safeCount(groupByMarkers) : 0;
  if (
    canSeeLeads &&
    groupByMarkers.error &&
    /form_type|travel_style|preferred_trip|column|schema cache|does not exist/i.test(
      groupByMarkers.error.message ?? '',
    )
  ) {
    const groupByForm = await admin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('form_type', 'group_trip')
      .in('status', [...GROUP_ONBOARDING_PENDING_STATUSES]);
    if (!groupByForm.error) {
      pendingGroupTrips = safeCount(groupByForm);
    } else {
      const groupByStyle = await admin
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('travel_style', 'Group')
        .in('status', [...GROUP_ONBOARDING_PENDING_STATUSES]);
      pendingGroupTrips = safeCount(groupByStyle);
    }
  }
  // Include pending seats on Group Operations board
  if (canSeeLeads && !groupMembersPending.error) {
    pendingGroupTrips += safeCount(groupMembersPending);
  } else if (
    canSeeLeads &&
    groupMembersPending.error &&
    !/relation|does not exist|schema cache/i.test(groupMembersPending.error.message ?? '')
  ) {
    console.warn(
      '[crm/notifications] group_members pending count:',
      groupMembersPending.error.message,
    );
  }

  const pendingPartners =
    safeCount(leaders) + safeCount(experts) + safeCount(legacyPartners);
  const pendingTrips = safeCount(leads);

  type PaymentReviewItem = {
    invoiceId: string;
    quoteId: string;
    clientName: string;
    tripTitle: string;
    amount: number;
    href: string;
  };

  let pendingPayments = 0;
  let pendingPaymentItems: PaymentReviewItem[] = [];

  if (canSeePayments) {
    if (paymentReviews.error) {
      console.warn(
        '[crm/notifications] payment reviews failed:',
        paymentReviews.error.message,
      );
      // Fallback: payment_review only (older DBs without receipt_url filter)
      const fallback = await admin
        .from('invoices')
        .select(
          'id, quote_id, trip_title, amount, status, client_id, updated_at',
          { count: 'exact' },
        )
        .in('status', ['payment_review', 'awaiting_confirmation'])
        .order('updated_at', { ascending: false })
        .limit(20);
      pendingPayments = safeCount(fallback);
      pendingPaymentItems = await enrichPaymentReviewItems(
        admin,
        (fallback.data ?? []) as Record<string, unknown>[],
      );
    } else {
      const rows = ((paymentReviews.data ?? []) as Record<string, unknown>[]).filter(
        (row) => {
          const status = String(row.status ?? '')
            .trim()
            .toLowerCase();
          if (status === 'paid') return false;
          if (status === 'payment_review' || status === 'awaiting_confirmation') {
            return true;
          }
          return Boolean(String(row.receipt_url ?? '').trim());
        },
      );
      pendingPayments = Math.max(safeCount(paymentReviews), rows.length);
      pendingPaymentItems = await enrichPaymentReviewItems(admin, rows);
    }
  }

  let upcomingBirthdays: ReturnType<typeof filterUpcomingBirthdays> = [];
  if (canSeeLeads) {
    const { data: birthdayClients, error: birthdayError } = await admin
      .from('clients')
      .select('id, name, birth_date, phone_wa')
      .not('birth_date', 'is', null)
      .limit(500);
    if (birthdayError) {
      console.warn(
        '[crm/notifications] upcoming birthdays failed:',
        birthdayError.message,
      );
    } else if (birthdayClients?.length) {
      upcomingBirthdays = filterUpcomingBirthdays(
        birthdayClients as Record<string, unknown>[],
        7,
      );
    }
  }
  const upcomingBirthdayCount = upcomingBirthdays.length;

  return jsonWithCookies(
    {
      ok: true,
      pendingPartners,
      pendingTrips,
      pendingGroupTrips,
      pendingPayments,
      pendingPaymentItems,
      upcomingBirthdays,
      upcomingBirthdayCount,
      totalPending:
        pendingPartners + pendingTrips + pendingPayments + upcomingBirthdayCount,
      refreshedAt: new Date().toISOString(),
    },
    200,
    auth.getResponse,
  );
}

async function enrichPaymentReviewItems(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  rows: Record<string, unknown>[],
): Promise<
  Array<{
    invoiceId: string;
    quoteId: string;
    clientName: string;
    tripTitle: string;
    amount: number;
    href: string;
  }>
> {
  if (!rows.length) return [];

  const clientIds = [
    ...new Set(
      rows
        .map((r) => String(r.client_id ?? '').trim())
        .filter(Boolean),
    ),
  ];
  const quoteIds = [
    ...new Set(
      rows
        .map((r) => String(r.quote_id ?? '').trim())
        .filter(Boolean),
    ),
  ];

  const clientNameById = new Map<string, string>();
  const quoteMetaById = new Map<
    string,
    { clientName: string; title: string }
  >();

  if (clientIds.length) {
    const { data: clients } = await admin
      .from('clients')
      .select('id, name')
      .in('id', clientIds);
    for (const client of clients ?? []) {
      const record = client as Record<string, unknown>;
      const id = String(record.id ?? '').trim();
      const name = String(record.name ?? '').trim();
      if (id && name) clientNameById.set(id, name);
    }
  }

  if (quoteIds.length) {
    let quotes: unknown[] | null = null;
    const withRelations = await admin
      .from('quotations')
      .select('id, title, clients(name), lead:leads(full_name)')
      .in('id', quoteIds);
    if (withRelations.error) {
      const plain = await admin
        .from('quotations')
        .select('id, title')
        .in('id', quoteIds);
      quotes = plain.data;
    } else {
      quotes = withRelations.data;
    }
    for (const quote of quotes ?? []) {
      const record = quote as Record<string, unknown>;
      const id = String(record.id ?? '').trim();
      if (!id) continue;
      const clients = record.clients as Record<string, unknown> | null;
      const lead = record.lead as Record<string, unknown> | null;
      const clientName =
        String(clients?.name ?? '').trim() ||
        String(lead?.full_name ?? '').trim();
      quoteMetaById.set(id, {
        clientName,
        title: String(record.title ?? '').trim(),
      });
    }
  }

  return rows.map((row) => {
    const invoiceId = String(row.id ?? '').trim();
    const quoteId = String(row.quote_id ?? '').trim();
    const clientId = String(row.client_id ?? '').trim();
    const quoteMeta = quoteMetaById.get(quoteId);
    const clientName =
      clientNameById.get(clientId) ||
      quoteMeta?.clientName ||
      'عميل';
    const tripTitle =
      String(row.trip_title ?? '').trim() ||
      quoteMeta?.title ||
      'رحلة Wanderloom';
    return {
      invoiceId,
      quoteId,
      clientName,
      tripTitle,
      amount: Number(row.amount) || 0,
      href: quoteId
        ? `/crm/quotations/edit/${encodeURIComponent(quoteId)}`
        : '/crm/quotations',
    };
  });
}
