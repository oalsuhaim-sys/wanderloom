import type { SupabaseClient } from '@supabase/supabase-js';

import {
  LEAD_KANBAN_DB_STATUS,
  leadStatusPipelineIndex,
  normalizeLeadStatus,
  type LeadKanbanColumnId,
  type LeadStatus,
} from '@/lib/leads-kanban';

/** Canonical Kanban column IDs (must match `LEAD_KANBAN_COLUMNS`) */
export const PIPELINE_KANBAN_STATUSES = [
  'awaiting_dna',
  'meeting',
  'quote_stage',
  'awaiting_payment',
  'payment_confirmed',
] as const;

export type PipelineKanbanStatus = (typeof PIPELINE_KANBAN_STATUSES)[number];

/**
 * Map friendly / legacy aliases → exact Kanban column IDs written to `leads.status`.
 * `pending_payment` → `awaiting_payment`
 * `route_building` / `route_creation` → `payment_confirmed`
 */
export function resolvePipelineKanbanStatus(raw: unknown): PipelineKanbanStatus | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!s) return null;
  if (s === 'pending_payment' || s === 'awaiting_payment') return 'awaiting_payment';
  if (
    s === 'route_building' ||
    s === 'route_creation' ||
    s === 'preparing_itinerary' ||
    s === 'payment_confirmed'
  ) {
    return 'payment_confirmed';
  }
  if ((PIPELINE_KANBAN_STATUSES as readonly string[]).includes(s)) {
    return s as PipelineKanbanStatus;
  }
  const mapped = LEAD_KANBAN_DB_STATUS[s as LeadKanbanColumnId];
  if (mapped && (PIPELINE_KANBAN_STATUSES as readonly string[]).includes(mapped)) {
    return mapped as PipelineKanbanStatus;
  }
  return null;
}

/**
 * UNIFIED Kanban status updater — single entry point for all pipeline automations.
 * Writes `leads.status` (the column the Kanban board reads).
 */
export async function updatePipelineStatus(
  sb: SupabaseClient,
  ref: {
    leadId?: string | null;
    clientId?: string | number | null;
    clientNameHint?: string | null;
    quoteId?: string | null;
    force?: boolean;
  },
  newStatus: string,
): Promise<void> {
  const resolved = resolvePipelineKanbanStatus(newStatus);
  if (!resolved) {
    console.warn('[updatePipelineStatus] unknown status:', newStatus);
    return;
  }

  await setLeadPipelineStatus(
    sb,
    {
      leadId: ref.leadId,
      clientId: ref.clientId,
      force: ref.force ?? true,
    },
    resolved,
  );

  // Payment stage: also heal by name / quote linkage + auto-create itinerary
  if (resolved === 'payment_confirmed') {
    await syncLeadsPaymentConfirmedByQuoteContext(sb, {
      leadId: ref.leadId,
      clientId: ref.clientId,
      clientNameHint: ref.clientNameHint,
    }).catch((err) =>
      console.warn('[updatePipelineStatus] payment heal:', err),
    );

    // Dynamic import avoids circular deps with crm-quotations
    try {
      const { ensureItineraryOnPaymentConfirmed } = await import(
        '@/lib/quotation-to-itinerary'
      );
      await ensureItineraryOnPaymentConfirmed(sb, {
        leadId: ref.leadId,
        clientId: ref.clientId,
        quoteId: ref.quoteId ?? null,
      });
    } catch (err) {
      console.warn('[updatePipelineStatus] auto itinerary:', err);
    }
  }
}

function clientIdVariants(clientId: string | number): Array<string | number> {
  const raw = String(clientId ?? '').trim();
  if (!raw) return [];
  const variants = new Set<string | number>([raw]);
  const asNum = Number(raw);
  if (Number.isFinite(asNum)) variants.add(asNum);
  return [...variants];
}

async function listLeadsForClient(
  sb: SupabaseClient,
  clientId: string | number,
): Promise<Array<{ id: string; status: string | null }>> {
  const variants = clientIdVariants(clientId);
  const found = new Map<string, { id: string; status: string | null }>();

  for (const variant of variants) {
    const { data, error } = await sb
      .from('leads')
      .select('id, status')
      .eq('client_id', variant);
    if (error) {
      if (!/column|schema cache|does not exist/i.test(error.message ?? '')) {
        console.warn('[lead-pipeline] list by clientId:', error.message);
      }
      continue;
    }
    for (const row of data ?? []) {
      const id = String((row as { id?: unknown }).id ?? '').trim();
      if (!id) continue;
      found.set(id, {
        id,
        status: (row as { status?: string | null }).status ?? null,
      });
    }
  }

  // Fallback: quotations.client_id → quotations.lead_id → leads
  if (!found.size) {
    for (const variant of variants) {
      const { data: quotes } = await sb
        .from('quotations')
        .select('lead_id')
        .eq('client_id', variant)
        .not('lead_id', 'is', null)
        .limit(40);
      for (const q of quotes ?? []) {
        const leadId = String((q as { lead_id?: unknown }).lead_id ?? '').trim();
        if (!leadId || found.has(leadId)) continue;
        const { data: lead } = await sb
          .from('leads')
          .select('id, status')
          .eq('id', leadId)
          .maybeSingle();
        if (lead) {
          found.set(leadId, {
            id: leadId,
            status: (lead as { status?: string | null }).status ?? null,
          });
        }
      }
    }
  }

  return [...found.values()];
}

function normalizePersonName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Force Kanban `leads.status = payment_confirmed` using every available key:
 * leadId, clientId, quotations.lead_id, and client/lead display name.
 */
export async function syncLeadsPaymentConfirmedByQuoteContext(
  sb: SupabaseClient,
  opts: {
    leadId?: string | null;
    clientId?: string | number | null;
    clientNameHint?: string | null;
  },
): Promise<number> {
  const updatedIds = new Set<string>();
  const target: LeadStatus = 'payment_confirmed';

  const tryUpdate = async (leadId: string) => {
    const id = String(leadId ?? '').trim();
    if (!id || updatedIds.has(id)) return;
    let { error } = await sb.from('leads').update({ status: target }).eq('id', id);
    if (error && /payment_confirmed|check|constraint|status/i.test(error.message ?? '')) {
      const retry = await sb
        .from('leads')
        .update({ status: 'preparing_itinerary' })
        .eq('id', id);
      error = retry.error;
    }
    if (!error) updatedIds.add(id);
    else console.warn('[lead-pipeline] payment_confirmed write failed:', id, error.message);
  };

  const leadId = String(opts.leadId ?? '').trim();
  if (leadId) await tryUpdate(leadId);

  if (opts.clientId != null && String(opts.clientId).trim() !== '') {
    const rows = await listLeadsForClient(sb, opts.clientId);
    for (const row of rows) await tryUpdate(row.id);

    // Ensure quotations for this client also point their lead_id rows forward
    for (const variant of clientIdVariants(opts.clientId)) {
      const { data: quotes } = await sb
        .from('quotations')
        .select('lead_id')
        .eq('client_id', variant)
        .not('lead_id', 'is', null)
        .limit(40);
      for (const q of quotes ?? []) {
        await tryUpdate(String((q as { lead_id?: unknown }).lead_id ?? ''));
      }
    }

    // Resolve client name for name-based heal
    if (!opts.clientNameHint) {
      const { data: client } = await sb
        .from('clients')
        .select('name')
        .eq('id', opts.clientId)
        .maybeSingle();
      opts = {
        ...opts,
        clientNameHint: String((client as { name?: unknown } | null)?.name ?? '').trim() || null,
      };
    }
  }

  const nameHint = normalizePersonName(opts.clientNameHint);
  if (nameHint) {
    const { data: namedLeads } = await sb
      .from('leads')
      .select('id, full_name, status')
      .ilike('full_name', `%${opts.clientNameHint!.trim()}%`)
      .limit(25);
    for (const row of namedLeads ?? []) {
      const rowName = normalizePersonName((row as { full_name?: unknown }).full_name);
      if (rowName !== nameHint && !rowName.includes(nameHint) && !nameHint.includes(rowName)) {
        continue;
      }
      const current = normalizeLeadStatus((row as { status?: unknown }).status);
      if (current === 'radar_rejected' || current === 'postponed' || current === 'interest_only') {
        continue;
      }
      await tryUpdate(String((row as { id?: unknown }).id ?? ''));
    }
  }

  return updatedIds.size;
}

/**
 * يحدّث leads.status حسب آلة الحالات الرئيسية (SSOT: `@/lib/lead-status`).
 * لا يسحب البطاقة للخلف إلا مع force (ما عدا الرفض من الرادار).
 */
export async function setLeadPipelineStatus(
  sb: SupabaseClient,
  opts: {
    leadId?: string | null;
    clientId?: string | number | null;
    force?: boolean;
  },
  status: LeadStatus | LeadKanbanColumnId,
): Promise<void> {
  const next = (LEAD_KANBAN_DB_STATUS[status as LeadKanbanColumnId] ?? status) as LeadStatus;
  const leadId = String(opts.leadId ?? '').trim();
  const clientRaw = opts.clientId;
  const clientId =
    clientRaw != null && String(clientRaw).trim() !== '' ? clientRaw : null;

  if (!leadId && clientId == null) return;

  const targetIdx = leadStatusPipelineIndex(next);
  const isTerminalArchive = next === 'radar_rejected' || next === 'postponed';

  if (leadId) {
    if (!opts.force && !isTerminalArchive && targetIdx >= 0) {
      const { data: row } = await sb.from('leads').select('status').eq('id', leadId).maybeSingle();
      const currentIdx = leadStatusPipelineIndex((row as { status?: string } | null)?.status);
      if (currentIdx > targetIdx) return;
    }
    const { error } = await sb.from('leads').update({ status: next }).eq('id', leadId);
    if (error && !/column|schema cache|does not exist|check/i.test(error.message ?? '')) {
      console.warn('[lead-pipeline] update by leadId:', error.message);
    }
    // Also advance any sibling leads for the same client when provided
    if (clientId != null) {
      const siblings = await listLeadsForClient(sb, clientId);
      for (const row of siblings) {
        if (row.id === leadId) continue;
        const current = normalizeLeadStatus(row.status);
        if (
          (current === 'radar_rejected' || current === 'postponed') &&
          !opts.force &&
          !isTerminalArchive
        ) {
          continue;
        }
        const currentIdx = leadStatusPipelineIndex(current);
        if (!opts.force && !isTerminalArchive && currentIdx > targetIdx) continue;
        await sb.from('leads').update({ status: next }).eq('id', row.id);
      }
    }
    return;
  }

  const rows = await listLeadsForClient(sb, clientId!);

  for (const row of rows) {
    const current = normalizeLeadStatus(row.status);
    if ((current === 'radar_rejected' || current === 'postponed') && !opts.force && !isTerminalArchive) {
      continue;
    }
    const currentIdx = leadStatusPipelineIndex(current);
    if (!opts.force && !isTerminalArchive && currentIdx > targetIdx) continue;
    const { error } = await sb.from('leads').update({ status: next }).eq('id', row.id);
    if (error && !/column|schema cache|does not exist|check/i.test(error.message ?? '')) {
      console.warn('[lead-pipeline] update lead', row.id, error.message);
    }
  }
}

/** Map quotation.status → minimum Kanban pipeline stage evidence */
export function pipelineStatusFromQuotation(raw: unknown): LeadStatus | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!s) return null;
  if (
    s === 'payment_confirmed' ||
    s === 'deposit_paid' ||
    s === 'fully_paid' ||
    s.includes('تأكيد الدفع')
  ) {
    return 'payment_confirmed';
  }
  if (s === 'awaiting_payment' || s.includes('بانتظار الدفع')) {
    return 'awaiting_payment';
  }
  // Any real quotation row means the lead left DNA / meeting
  return 'quote_stage';
}

/** Map invoice.status (+ receipt) → minimum Kanban stage */
export function pipelineStatusFromInvoice(
  statusRaw: unknown,
  receiptUrl?: unknown,
): LeadStatus | null {
  const s = String(statusRaw ?? '')
    .trim()
    .toLowerCase();
  if (!s) return null;
  if (s === 'paid') return 'payment_confirmed';
  if (s === 'payment_review' || s === 'awaiting_confirmation') {
    return 'awaiting_payment';
  }
  if (s === 'pending' || s === 'issued' || s === 'awaiting_payment') {
    return 'awaiting_payment';
  }
  if (String(receiptUrl ?? '').trim()) return 'awaiting_payment';
  return null;
}

function maxPipelineStatus(
  a: LeadStatus | null | undefined,
  b: LeadStatus | null | undefined,
): LeadStatus | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return leadStatusPipelineIndex(a) >= leadStatusPipelineIndex(b) ? a : b;
}

type LeadLikeForReconcile = {
  id: string;
  status?: string | null;
  client_id?: string | number | null;
};

/**
 * Heals stale `leads.status` from quotations + invoices evidence.
 * Never moves a card backwards. Writes corrected status back to DB.
 */
export async function reconcileLeadStatusesFromQuotesAndInvoices<T extends LeadLikeForReconcile>(
  sb: SupabaseClient,
  leads: T[],
): Promise<T[]> {
  if (!leads.length) return leads;

  const leadIds = leads.map((l) => String(l.id).trim()).filter(Boolean);
  const clientIds = [
    ...new Set(
      leads
        .map((l) => String(l.client_id ?? '').trim())
        .filter(Boolean),
    ),
  ];

  const evidenceByLeadId = new Map<string, LeadStatus>();

  const bump = (leadId: string, status: LeadStatus | null) => {
    if (!leadId || !status) return;
    evidenceByLeadId.set(
      leadId,
      maxPipelineStatus(evidenceByLeadId.get(leadId), status) ?? status,
    );
  };

  // Quotations linked by lead_id
  if (leadIds.length) {
    const { data: byLead } = await sb
      .from('quotations')
      .select('id, lead_id, client_id, status')
      .in('lead_id', leadIds)
      .limit(500);
    for (const row of byLead ?? []) {
      const leadId = String((row as { lead_id?: unknown }).lead_id ?? '').trim();
      bump(leadId, pipelineStatusFromQuotation((row as { status?: unknown }).status));
    }
  }

  // Quotations linked by client_id → map onto leads sharing that client
  if (clientIds.length) {
    const numericClients = clientIds
      .map((id) => Number(id))
      .filter((n) => Number.isFinite(n));
    const clientFilter = [...new Set([...clientIds, ...numericClients])];

    const { data: byClient } = await sb
      .from('quotations')
      .select('id, lead_id, client_id, status')
      .in('client_id', clientFilter)
      .limit(500);

    const leadsByClient = new Map<string, string[]>();
    for (const lead of leads) {
      const cid = String(lead.client_id ?? '').trim();
      if (!cid) continue;
      const list = leadsByClient.get(cid) ?? [];
      list.push(String(lead.id));
      leadsByClient.set(cid, list);
      const num = String(Number(cid));
      if (num !== cid && Number.isFinite(Number(cid))) {
        const alt = leadsByClient.get(num) ?? [];
        alt.push(String(lead.id));
        leadsByClient.set(num, alt);
      }
    }

    for (const row of byClient ?? []) {
      const derived = pipelineStatusFromQuotation((row as { status?: unknown }).status);
      const quoteLeadId = String((row as { lead_id?: unknown }).lead_id ?? '').trim();
      if (quoteLeadId) bump(quoteLeadId, derived);
      const cid = String((row as { client_id?: unknown }).client_id ?? '').trim();
      for (const leadId of leadsByClient.get(cid) ?? []) {
        bump(leadId, derived);
      }
    }

    // Paid / review invoices for these clients
    const { data: invoices } = await sb
      .from('invoices')
      .select('id, client_id, quote_id, status, receipt_url')
      .in('client_id', clientFilter)
      .limit(500);

    for (const inv of invoices ?? []) {
      const derived = pipelineStatusFromInvoice(
        (inv as { status?: unknown }).status,
        (inv as { receipt_url?: unknown }).receipt_url,
      );
      const cid = String((inv as { client_id?: unknown }).client_id ?? '').trim();
      for (const leadId of leadsByClient.get(cid) ?? []) {
        bump(leadId, derived);
      }
    }
  }

  // Also: invoices by quote_id for quotes we already saw (covers missing client_id on invoice)
  const quoteIdsNeedingInvoice: string[] = [];
  // Collect quote ids from a lightweight second pass if evidence is only quote_stage but payment may exist
  {
    const allEvidenceLeadIds = [...evidenceByLeadId.keys()];
    if (allEvidenceLeadIds.length) {
      const { data: quoteRows } = await sb
        .from('quotations')
        .select('id, lead_id, status')
        .in('lead_id', allEvidenceLeadIds)
        .limit(500);
      for (const q of quoteRows ?? []) {
        const qid = String((q as { id?: unknown }).id ?? '').trim();
        if (qid) quoteIdsNeedingInvoice.push(qid);
      }
    }
  }

  if (quoteIdsNeedingInvoice.length) {
    const { data: invByQuote } = await sb
      .from('invoices')
      .select('id, quote_id, status, receipt_url')
      .in('quote_id', quoteIdsNeedingInvoice)
      .limit(500);

    const leadByQuote = new Map<string, string>();
    const { data: quoteMap } = await sb
      .from('quotations')
      .select('id, lead_id')
      .in('id', quoteIdsNeedingInvoice)
      .limit(500);
    for (const q of quoteMap ?? []) {
      const qid = String((q as { id?: unknown }).id ?? '').trim();
      const lid = String((q as { lead_id?: unknown }).lead_id ?? '').trim();
      if (qid && lid) leadByQuote.set(qid, lid);
    }

    for (const inv of invByQuote ?? []) {
      const derived = pipelineStatusFromInvoice(
        (inv as { status?: unknown }).status,
        (inv as { receipt_url?: unknown }).receipt_url,
      );
      const qid = String((inv as { quote_id?: unknown }).quote_id ?? '').trim();
      const leadId = leadByQuote.get(qid);
      if (leadId) bump(leadId, derived);
    }
  }

  // Global payment evidence: paid quotes/invoices → bump linked leads
  {
    const { data: paidQuotes } = await sb
      .from('quotations')
      .select('id, lead_id, client_id, status')
      .in('status', ['payment_confirmed', 'deposit_paid', 'fully_paid'])
      .limit(300);

    for (const row of paidQuotes ?? []) {
      const derived = pipelineStatusFromQuotation((row as { status?: unknown }).status);
      const quoteLeadId = String((row as { lead_id?: unknown }).lead_id ?? '').trim();
      if (quoteLeadId) bump(quoteLeadId, derived);
      const cid = String((row as { client_id?: unknown }).client_id ?? '').trim();
      if (!cid) continue;
      for (const lead of leads) {
        if (String(lead.client_id ?? '').trim() === cid) {
          bump(String(lead.id), derived);
        }
      }
    }

    const { data: paidInvoices } = await sb
      .from('invoices')
      .select('id, client_id, quote_id, status, receipt_url')
      .eq('status', 'paid')
      .limit(300);

    for (const inv of paidInvoices ?? []) {
      const derived = pipelineStatusFromInvoice(
        (inv as { status?: unknown }).status,
        (inv as { receipt_url?: unknown }).receipt_url,
      );
      const cid = String((inv as { client_id?: unknown }).client_id ?? '').trim();
      if (!cid) continue;
      for (const lead of leads) {
        if (String(lead.client_id ?? '').trim() === cid) {
          bump(String(lead.id), derived);
        }
      }
    }
  }

  // Fallback: match leads still before payment_confirmed to quotations by client name
  // (covers quote_stage / awaiting_payment stuck cards when FKs are missing)
  const earlyLeads = leads.filter((lead) => {
    const leadId = String(lead.id);
    const currentEvidence = evidenceByLeadId.get(leadId);
    if (currentEvidence && leadStatusPipelineIndex(currentEvidence) >= leadStatusPipelineIndex('payment_confirmed')) {
      return false;
    }
    const idx = leadStatusPipelineIndex(lead.status);
    return (
      idx >= 0 &&
      idx < leadStatusPipelineIndex('payment_confirmed') &&
      leadStatusPipelineIndex(currentEvidence) < leadStatusPipelineIndex('payment_confirmed')
    );
  });

  if (earlyLeads.length) {
    const normalizeName = (value: unknown) =>
      String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

    let recentQuotes: Record<string, unknown>[] = [];
    const withClients = await sb
      .from('quotations')
      .select('id, lead_id, client_id, status, clients(name)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (withClients.error) {
      const plain = await sb
        .from('quotations')
        .select('id, lead_id, client_id, status')
        .order('created_at', { ascending: false })
        .limit(200);
      recentQuotes = (plain.data ?? []) as Record<string, unknown>[];
    } else {
      recentQuotes = (withClients.data ?? []) as Record<string, unknown>[];
    }

    // Resolve client names for quotes missing embed
    const missingNameClientIds = [
      ...new Set(
        recentQuotes
          .filter((q) => !normalizeName((q.clients as { name?: unknown } | null)?.name))
          .map((q) => String(q.client_id ?? '').trim())
          .filter(Boolean),
      ),
    ];
    const clientNameById = new Map<string, string>();
    if (missingNameClientIds.length) {
      const { data: clients } = await sb
        .from('clients')
        .select('id, name')
        .in('id', missingNameClientIds);
      for (const c of clients ?? []) {
        const id = String((c as { id?: unknown }).id ?? '').trim();
        const name = normalizeName((c as { name?: unknown }).name);
        if (id && name) clientNameById.set(id, name);
      }
    }

    const matchedQuoteIds: string[] = [];
    const quoteToLead = new Map<string, string>();

    for (const lead of earlyLeads) {
      const leadName = normalizeName(
        (lead as { full_name?: unknown }).full_name ??
          (lead as { name?: unknown }).name,
      );
      if (!leadName) continue;

      for (const q of recentQuotes) {
        const clients = q.clients as { name?: unknown } | null;
        const clientName =
          normalizeName(clients?.name) ||
          clientNameById.get(String(q.client_id ?? '').trim()) ||
          '';
        if (!clientName || clientName !== leadName) continue;
        const leadId = String(lead.id);
        bump(leadId, pipelineStatusFromQuotation(q.status));
        const qid = String(q.id ?? '').trim();
        if (qid) {
          matchedQuoteIds.push(qid);
          quoteToLead.set(qid, leadId);
        }
        break;
      }
    }

    if (matchedQuoteIds.length) {
      const { data: invs } = await sb
        .from('invoices')
        .select('quote_id, status, receipt_url')
        .in('quote_id', matchedQuoteIds)
        .limit(200);
      for (const inv of invs ?? []) {
        const qid = String((inv as { quote_id?: unknown }).quote_id ?? '').trim();
        const leadId = quoteToLead.get(qid);
        if (!leadId) continue;
        bump(
          leadId,
          pipelineStatusFromInvoice(
            (inv as { status?: unknown }).status,
            (inv as { receipt_url?: unknown }).receipt_url,
          ),
        );
      }
    }
  }

  if (!evidenceByLeadId.size) return leads;

  const healed: T[] = [];
  const writes: Array<Promise<unknown>> = [];

  for (const lead of leads) {
    const leadId = String(lead.id).trim();
    const evidence = evidenceByLeadId.get(leadId);
    if (!evidence) {
      healed.push(lead);
      continue;
    }

    const current = normalizeLeadStatus(lead.status);
    // Never resurrect archived / marketing-only / converted from evidence alone
    if (
      current === 'radar_rejected' ||
      current === 'postponed' ||
      current === 'interest_only' ||
      current === 'converted'
    ) {
      healed.push(lead);
      continue;
    }

    const currentIdx = leadStatusPipelineIndex(current);
    const evidenceIdx = leadStatusPipelineIndex(evidence);
    if (evidenceIdx <= currentIdx) {
      healed.push(lead);
      continue;
    }

    healed.push({ ...lead, status: evidence });
    writes.push(
      sb
        .from('leads')
        .update({ status: evidence })
        .eq('id', leadId)
        .then(({ error }) => {
          if (error) {
            console.warn('[lead-pipeline] reconcile write:', leadId, error.message);
          }
        }),
    );
  }

  if (writes.length) {
    await Promise.all(writes);
  }

  return healed;
}
