import { NextResponse, type NextRequest } from 'next/server';

import {
  addClientWalletTransaction,
  fetchClientWalletLedger,
} from '@/lib/vip-wallet-ledger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

function resolveClientIdFromRequest(
  request: NextRequest,
  body?: Record<string, unknown> | null,
): string {
  const fromQuery =
    request.nextUrl.searchParams.get('clientId')?.trim() ||
    request.nextUrl.searchParams.get('client_id')?.trim() ||
    '';
  if (fromQuery) return fromQuery;

  if (body) {
    const raw = body.clientId ?? body.client_id;
    if (raw != null && String(raw).trim()) return String(raw).trim();
  }
  return '';
}

/**
 * محفظة عهدة العميل
 * GET  ?clientId=…  — رصيد + سجل
 * POST { clientId, amount, description } — إيداع (موجب) أو خصم (سالب)
 *
 * عند غياب clientId أو عدم العثور على العميل: رد مرن 200 بدون 400.
 */
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if ('error' in auth) {
    return jsonWithCookies(
      { ok: false, error: String(auth.error ?? 'غير مصرح') },
      auth.status ?? 401,
      auth.getResponse,
    );
  }

  const clientId = resolveClientIdFromRequest(request);
  if (!clientId) {
    return jsonWithCookies(
      {
        ok: false,
        error: 'يرجى تحديد العميل أولاً.',
        balance: 0,
        totalSpent: 0,
        transactions: [],
      },
      200,
      auth.getResponse,
    );
  }

  try {
    const admin = createSupabaseAdminClient();
    const ledger = await fetchClientWalletLedger(admin, clientId, { limit: 40 });
    return jsonWithCookies(
      {
        ok: true,
        clientId,
        balance: ledger.balance,
        totalSpent: ledger.totalSpent,
        vipTier: ledger.vipTier,
        transactions: ledger.transactions,
      },
      200,
      auth.getResponse,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'تعذر تحميل محفظة العهدة.';
    // عميل غير موجود / أعمدة ناقصة → رد مرن وليس 400
    return jsonWithCookies(
      {
        ok: false,
        error: msg,
        clientId,
        balance: 0,
        totalSpent: 0,
        transactions: [],
      },
      200,
      auth.getResponse,
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if ('error' in auth) {
    return jsonWithCookies(
      { ok: false, error: String(auth.error ?? 'غير مصرح') },
      auth.status ?? 401,
      auth.getResponse,
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const clientId = resolveClientIdFromRequest(request, body);
  if (!clientId) {
    return jsonWithCookies(
      { ok: false, error: 'يرجى تحديد العميل أولاً قبل الإيداع أو الخصم.' },
      200,
      auth.getResponse,
    );
  }

  const amount = Number(body.amount);
  const description = String(body.description ?? '').trim();

  if (!Number.isFinite(amount) || amount === 0) {
    return jsonWithCookies(
      { ok: false, error: 'أدخل مبلغاً غير صفري (موجب للإيداع، سالب للخصم).' },
      200,
      auth.getResponse,
    );
  }
  if (!description) {
    return jsonWithCookies(
      { ok: false, error: 'أدخل وصفاً للعملية.' },
      200,
      auth.getResponse,
    );
  }

  try {
    const admin = createSupabaseAdminClient();
    const result = await addClientWalletTransaction(
      admin,
      clientId,
      amount,
      description,
    );
    return jsonWithCookies(
      {
        ok: true,
        clientId,
        balance: result.balance,
        totalSpent: result.totalSpent,
        vipTier: result.vipTier,
        transactionId: result.transactionId,
      },
      200,
      auth.getResponse,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'تعذر حفظ العملية.';
    const soft =
      /client_not_found|client_id|معرّف العميل|غير صالح|غير موجود/i.test(msg);
    return jsonWithCookies(
      { ok: false, error: msg, clientId },
      soft ? 200 : 500,
      auth.getResponse,
    );
  }
}
