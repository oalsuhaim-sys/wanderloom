import { NextResponse, type NextRequest } from 'next/server';

import { accessFromEmployeeRow, type EmployeeRbacRow } from '@/lib/crm-permissions';
import { isEmergencyCrmOwnerBypass } from '@/lib/crm-roles';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireCrmAdmin } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type WalletPartnerType = 'leader' | 'expert';

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

function parsePartnerType(raw: string | null): WalletPartnerType | null {
  if (raw === 'leader' || raw === 'leaders') return 'leader';
  if (raw === 'expert' || raw === 'experts') return 'expert';
  return null;
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

/**
 * Admin Smart Wallet — Service Role DB reads after Bearer/cookie admin auth.
 * GET /api/admin/wallet?partner_id=&partner_type=leader|expert
 */
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

  const auth = await authorizeAdmin(request, admin);
  if (!auth.ok) {
    return jsonWithCookies(
      { ok: false, error: auth.error },
      auth.status,
      auth.getResponse,
    );
  }

  const partnerId =
    request.nextUrl.searchParams.get('partner_id')?.trim() ?? '';
  const partnerType = parsePartnerType(
    request.nextUrl.searchParams.get('partner_type'),
  );
  if (!partnerId || !partnerType) {
    return jsonWithCookies(
      { ok: false, error: 'partner_id و partner_type مطلوبان.' },
      400,
      auth.getResponse,
    );
  }

  const table = partnerType === 'leader' ? 'leaders' : 'experts';

  let partnerResult = await admin
    .from(table)
    .select('id, name, tier, wallet_balance, pending_commission')
    .eq('id', partnerId)
    .maybeSingle();

  // Soft fallback if wallet columns are not migrated yet
  if (partnerResult.error) {
    partnerResult = await admin
      .from(table)
      .select('id, name')
      .eq('id', partnerId)
      .maybeSingle();
  }

  if (partnerResult.error) {
    return jsonWithCookies(
      { ok: false, error: partnerResult.error.message },
      500,
      auth.getResponse,
    );
  }
  if (!partnerResult.data) {
    return jsonWithCookies(
      { ok: false, error: 'الشريك غير موجود.' },
      404,
      auth.getResponse,
    );
  }

  const transactionsResult = await admin
    .from('wallet_transactions')
    .select(
      'id, partner_id, partner_type, amount, status, description, created_at',
    )
    .eq('partner_id', partnerId)
    .eq('partner_type', partnerType)
    .order('created_at', { ascending: false })
    .limit(50);

  // Missing table / RLS misconfig should not surface as "unauthorized" to the UI —
  // return empty ledger so the card still shows 0 ر.س balances.
  const transactions =
    transactionsResult.error || !Array.isArray(transactionsResult.data)
      ? []
      : transactionsResult.data;

  const partner = partnerResult.data as Record<string, unknown>;
  return jsonWithCookies(
    {
      ok: true,
      wallet: {
        partnerId: String(partner.id),
        partnerType,
        partnerName: String(partner.name ?? ''),
        tier: String(partner.tier ?? 'Bronze'),
        walletBalance: Number(partner.wallet_balance ?? 0) || 0,
        pendingCommission: Number(partner.pending_commission ?? 0) || 0,
      },
      transactions,
      transactionsWarning: transactionsResult.error?.message ?? null,
    },
    200,
    auth.getResponse,
  );
}
