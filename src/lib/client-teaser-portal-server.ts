import 'server-only';

import {
  resolvePortalSpotifyUrl,
  type ClientTeaserPortalData,
} from '@/lib/client-teaser-portal';
import { buildClientDnaWelcomeUrlByClientId } from '@/lib/client-intake-pipeline';
import {
  isGroupMemberStatus,
  type GroupMemberStatus,
} from '@/lib/group-members';
import {
  buildInvoicePublicUrl,
  buildQuoteLedger,
  isInvoiceReceivableStatus,
  INVOICE_RECEIVABLE_DB_STATUSES,
  mapInvoiceRow,
  type InvoiceRow,
  type QuoteLedgerSummary,
} from '@/lib/crm-invoices';
import {
  CRM_INVOICES_TABLE,
  fetchQuoteLedgerAdmin,
  sumPaidInvoicesForQuoteAdmin,
} from '@/lib/crm-invoices-server';
import {
  coerceQuotationIdForDb,
  isQuotationStatusApproved,
  mapQuotationRow,
  normalizeQuotationId,
  quotationTotalPrice,
} from '@/lib/crm-quotations';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type ClientTeaserPortalResult =
  | { ok: true; data: ClientTeaserPortalData }
  | { ok: false; reason: string };

function mapPortalPendingInvoice(
  row: InvoiceRow,
  siteBase?: string,
): ClientTeaserPortalData['pendingInvoice'] {
  return {
    id: row.id,
    amount: row.amount,
    type: row.type,
    url: buildInvoicePublicUrl(row.id, siteBase || undefined),
  };
}

async function fetchReceivableInvoicesForClient(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  clientDbId: string | number,
): Promise<InvoiceRow[]> {
  const { data, error } = await admin
    .from(CRM_INVOICES_TABLE)
    .select('*')
    .eq('client_id', clientDbId)
    .in('status', [...INVOICE_RECEIVABLE_DB_STATUSES])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[teaser-portal] receivable invoices:', error.message);
    return [];
  }

  return (data ?? [])
    .filter((row) => isInvoiceReceivableStatus((row as { status?: unknown }).status))
    .map((row) => mapInvoiceRow(row as Record<string, unknown>));
}

async function loadQuoteForPortal(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  quoteId: string,
): Promise<ReturnType<typeof mapQuotationRow> | null> {
  const { data: quoteRaw } = await admin
    .from('quotations')
    .select('*')
    .eq('id', coerceQuotationIdForDb(quoteId))
    .maybeSingle();

  if (!quoteRaw) return null;
  return mapQuotationRow(quoteRaw as Record<string, unknown>);
}

async function fetchGroupMemberForPortal(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  clientDbId: string | number,
): Promise<ClientTeaserPortalData['groupMember']> {
  try {
    let { data, error } = await admin
      .from('group_members')
      .select('status, group_trip_id, payment_deadline')
      .eq('client_id', clientDbId)
      .maybeSingle();

    if (
      error &&
      /payment_|column|schema cache|does not exist/i.test(error.message ?? '')
    ) {
      const fallback = await admin
        .from('group_members')
        .select('status, group_trip_id')
        .eq('client_id', clientDbId)
        .maybeSingle();
      data = fallback.data
        ? ({ ...fallback.data, payment_deadline: null } as typeof data)
        : null;
      error = fallback.error;
    }

    if (error || !data) return null;
    const statusRaw = (data as { status?: unknown }).status;
    if (!isGroupMemberStatus(statusRaw)) return null;

    let tripTitle: string | null = null;
    const tripId = (data as { group_trip_id?: string | null }).group_trip_id;
    if (tripId) {
      const { data: trip } = await admin
        .from('group_trips')
        .select('title_ar')
        .eq('id', tripId)
        .maybeSingle();
      tripTitle = trip ? String((trip as { title_ar?: string }).title_ar ?? '') || null : null;
    }

    const paymentDeadlineRaw = (data as { payment_deadline?: unknown }).payment_deadline;
    const paymentDeadline =
      paymentDeadlineRaw != null && String(paymentDeadlineRaw).trim()
        ? String(paymentDeadlineRaw)
        : null;

    return {
      status: statusRaw as GroupMemberStatus,
      tripTitle,
      paymentDeadline,
    };
  } catch (err) {
    console.warn('[teaser-portal] group_members:', err);
    return null;
  }
}

function emptyLedger(tripTitle: string): QuoteLedgerSummary {
  return buildQuoteLedger('', tripTitle, 0, 0);
}

function groupStatusOnlyPayload(input: {
  clientId: string;
  clientName: string;
  dnaWelcomeUrl: string;
  onboardingCompleted: boolean;
  groupMember: NonNullable<ClientTeaserPortalData['groupMember']>;
  pendingInvoices?: ClientTeaserPortalData['pendingInvoices'];
  paymentDueOnly?: boolean;
}): ClientTeaserPortalData {
  const tripTitle = input.groupMember.tripTitle || 'رحلة المجموعة';
  const pendingInvoices = input.pendingInvoices ?? [];
  return {
    clientId: input.clientId,
    clientName: input.clientName,
    tripTitle,
    startDate: null,
    quoteId: '',
    ledger: emptyLedger(tripTitle),
    spotifyUrl: resolvePortalSpotifyUrl(),
    pendingInvoice: pendingInvoices[0] ?? null,
    pendingInvoices,
    paymentDueOnly: Boolean(input.paymentDueOnly),
    dnaWelcomeUrl: input.dnaWelcomeUrl,
    onboardingCompleted: input.onboardingCompleted,
    groupMember: input.groupMember,
    groupStatusOnly: true,
  };
}

/**
 * بوابة العميل التشويقية — تُفتح بعد دفع عربون/فاتورة، أو لعرض حالة انضمام المجموعة.
 */
export async function fetchClientTeaserPortalAdmin(
  clientIdRaw: string,
): Promise<ClientTeaserPortalResult> {
  const clientId = String(clientIdRaw ?? '').trim();
  if (!clientId || !/^\d+$/.test(clientId)) {
    return { ok: false, reason: 'رابط البوابة غير صالح.' };
  }

  const admin = createSupabaseAdminClient();
  const clientDbId = coerceQuotationIdForDb(clientId);

  const { data: client, error: clientError } = await admin
    .from('clients')
    .select('id, name, phone_wa, sales_stage, onboarding_completed')
    .eq('id', clientDbId)
    .maybeSingle();

  if (clientError || !client) {
    return { ok: false, reason: 'لم نتمكن من العثور على ملف الضيف.' };
  }

  const clientRecord = client as Record<string, unknown>;
  const clientName =
    String(clientRecord.name ?? '').trim() || 'ضيفنا الكريم';

  const siteBase = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  const dnaWelcomeUrl = buildClientDnaWelcomeUrlByClientId(clientId, siteBase || undefined);
  const onboardingCompleted = clientRecord.onboarding_completed === true;
  const groupMember = await fetchGroupMemberForPortal(admin, clientDbId);

  const receivableInvoices = await fetchReceivableInvoicesForClient(admin, clientDbId);
  const pendingInvoices = receivableInvoices
    .map((row) => mapPortalPendingInvoice(row, siteBase))
    .filter((row): row is NonNullable<ClientTeaserPortalData['pendingInvoice']> => Boolean(row));

  const { data: paidInvoices, error: invError } = await admin
    .from(CRM_INVOICES_TABLE)
    .select('id, quote_id, amount, status, created_at')
    .eq('client_id', clientDbId)
    .eq('status', 'paid')
    .order('created_at', { ascending: false });

  if (invError) {
    if (/relation|does not exist|schema cache/i.test(invError.message ?? '')) {
      if (groupMember) {
        return {
          ok: true,
          data: groupStatusOnlyPayload({
            clientId,
            clientName,
            dnaWelcomeUrl,
            onboardingCompleted,
            groupMember,
          }),
        };
      }
      return {
        ok: false,
        reason: 'نظام الفواتير غير مفعّل بعد. تواصل مع فريق Wanderloom.',
      };
    }
    console.error('[teaser-portal] invoices:', invError.message);
    return { ok: false, reason: 'تعذر التحقق من حالة الحجز.' };
  }

  if (!paidInvoices?.length) {
    if (receivableInvoices.length > 0) {
      const primary = receivableInvoices[0];
      const quoteId = normalizeQuotationId(primary.quote_id);
      const quote = quoteId ? await loadQuoteForPortal(admin, quoteId) : null;
      const tripTitle =
        groupMember?.tripTitle ||
        primary.trip_title.trim() ||
        quote?.title ||
        'رحلتك الاستثنائية';
      const ledger =
        quote && quoteId
          ? buildQuoteLedger(quoteId, tripTitle, quotationTotalPrice(quote), 0)
          : buildQuoteLedger(quoteId || primary.quote_id, tripTitle, primary.amount, 0);

      return {
        ok: true,
        data: {
          clientId,
          clientName,
          tripTitle,
          startDate: quote?.start_date ?? null,
          quoteId: quoteId || primary.quote_id,
          ledger,
          spotifyUrl: resolvePortalSpotifyUrl(),
          pendingInvoice: pendingInvoices[0] ?? null,
          pendingInvoices,
          paymentDueOnly: true,
          dnaWelcomeUrl,
          onboardingCompleted,
          groupMember,
        },
      };
    }

    if (groupMember) {
      return {
        ok: true,
        data: groupStatusOnlyPayload({
          clientId,
          clientName,
          dnaWelcomeUrl,
          onboardingCompleted,
          groupMember,
        }),
      };
    }

    return {
      ok: false,
      reason:
        'بوابتك التشويقية تُفتح بعد تأكيد الحجز ودفع العربون. إذا أتممت الدفع للتو، تواصل معنا وسنفعّلها فوراً.',
    };
  }

  const quoteIds = [
    ...new Set(
      paidInvoices
        .map((row) => normalizeQuotationId((row as { quote_id?: unknown }).quote_id))
        .filter(Boolean),
    ),
  ];

  type Candidate = {
    quote: ReturnType<typeof mapQuotationRow>;
    ledger: QuoteLedgerSummary;
  };
  const candidates: Candidate[] = [];

  for (const quoteId of quoteIds) {
    const { data: quoteRaw } = await admin
      .from('quotations')
      .select('*')
      .eq('id', coerceQuotationIdForDb(quoteId))
      .maybeSingle();

    if (!quoteRaw) continue;
    const quote = mapQuotationRow(quoteRaw as Record<string, unknown>);
    const paid = await sumPaidInvoicesForQuoteAdmin(quoteId);
    if (paid <= 0) continue;

    const ledger =
      (await fetchQuoteLedgerAdmin(quoteId)) ??
      buildQuoteLedger(quoteId, quote.title, quotationTotalPrice(quote), paid);

    candidates.push({ quote, ledger });
  }

  candidates.sort((a, b) => {
    const aApproved = isQuotationStatusApproved(a.quote.status) ? 1 : 0;
    const bApproved = isQuotationStatusApproved(b.quote.status) ? 1 : 0;
    if (bApproved !== aApproved) return bApproved - aApproved;
    return String(b.quote.created_at).localeCompare(String(a.quote.created_at));
  });

  const bestQuote = candidates[0]?.quote ?? null;
  const bestLedger = candidates[0]?.ledger ?? null;

  if (!bestQuote || !bestLedger || bestLedger.paidAmount <= 0) {
    if (groupMember) {
      return {
        ok: true,
        data: groupStatusOnlyPayload({
          clientId,
          clientName,
          dnaWelcomeUrl,
          onboardingCompleted,
          groupMember,
          pendingInvoices,
          paymentDueOnly: pendingInvoices.length > 0,
        }),
      };
    }
    return {
      ok: false,
      reason:
        'لم نجد رحلة مؤكدة مرتبطة بحسابك بعد. أكمل دفع العربون عبر رابط الفاتورة، أو تواصل مع فريق Wanderloom.',
    };
  }

  const tripTitle =
    groupMember?.tripTitle ||
    bestLedger.tripTitle ||
    bestQuote.title ||
    'رحلتك الاستثنائية';

  const pendingRow = receivableInvoices.find(
    (row) => normalizeQuotationId(row.quote_id) === normalizeQuotationId(bestLedger.quoteId),
  );
  const scopedPending = pendingRow
    ? mapPortalPendingInvoice(pendingRow, siteBase)
    : pendingInvoices[0] ?? null;

  return {
    ok: true,
    data: {
      clientId,
      clientName,
      tripTitle,
      startDate: bestQuote.start_date,
      quoteId: bestLedger.quoteId,
      ledger: { ...bestLedger, tripTitle },
      spotifyUrl: resolvePortalSpotifyUrl(),
      pendingInvoice: scopedPending,
      pendingInvoices: pendingInvoices.length
        ? pendingInvoices
        : scopedPending
          ? [scopedPending]
          : [],
      paymentDueOnly: false,
      dnaWelcomeUrl,
      onboardingCompleted,
      groupMember,
    },
  };
}
