import type { SupabaseClient } from '@supabase/supabase-js';

import {
  countBy,
  round,
  type ClientFact,
  type CompanyFacts,
  type CountRow,
  type DealFact,
  type ExpenseFact,
  type GroupFact,
  type GroupPlanFact,
  type LeadFact,
  type QuoteFact,
  type ReceiptFact,
  type ReceivableFact,
  type SessionFact,
  type TailorFact,
} from '@/lib/company-bi';
import { parseInvoiceStatus } from '@/lib/crm-invoices';
import { effectiveQuotePricing, mapQuotationRow } from '@/lib/crm-quotations';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type Row = Record<string, unknown>;

const USD_TO_SAR = 3.75;
const PAID_QUOTE_STATUSES = new Set(['payment_confirmed', 'fully_paid']);
const DEPOSIT_QUOTE_STATUSES = new Set(['deposit_paid']);

function sanitizePhoneDigits(v: string): string {
  return v.replace(/\D+/g, '');
}

function str(v: unknown): string {
  return String(v ?? '').trim();
}

function num(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function dateOnly(v: unknown): string | null {
  const s = str(v);
  return s.length >= 10 ? s.slice(0, 10) : null;
}

function firstDestination(raw: unknown): string {
  const s = Array.isArray(raw) ? raw.map(str).filter(Boolean).join('، ') : str(raw);
  if (!s || s === '—' || s === '-') return 'غير محدد';
  return (s.split(/[,،|/·]+/)[0] ?? s).trim().slice(0, 48) || 'غير محدد';
}

/** Reads a whole table, tolerating a missing table (returns null) so one gap never breaks the page. */
async function readAll(db: SupabaseClient, table: string, columns: string, warnings: string[], label: string): Promise<Row[] | null> {
  const out: Row[] = [];
  for (let offset = 0; offset < 20_000; offset += 1000) {
    const { data, error } = await db.from(table).select(columns).range(offset, offset + 999);
    if (error) {
      const missing = /does not exist|schema cache|could not find/i.test(error.message);
      if (!missing) warnings.push(`تعذّر قراءة ${label}.`);
      console.warn(`[company-bi] ${table}:`, error.message);
      return out.length ? out : null;
    }
    const rows = (data ?? []) as unknown as Row[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export async function loadCompanyFacts(): Promise<CompanyFacts> {
  const db = createSupabaseAdminClient();
  const warnings: string[] = [];

  const [quotationsRaw, invoicesRaw, clientsRaw, leadsRaw, tailorRaw, groupsRaw, membersRaw, plansRaw, sessionsRaw, regsRaw, legacyRaw, itinerariesRaw, expensesRaw] =
    await Promise.all([
      readAll(db, 'quotations', '*', warnings, 'عروض الأسعار'),
      readAll(db, 'invoices', 'id, client_id, quote_id, amount, type, status, created_at, updated_at, paid_at, receipt_url, trip_title', warnings, 'الفواتير'),
      readAll(db, 'clients', 'id, name, created_at, city, lead_source, client_tier, vip_tier', warnings, 'العملاء'),
      readAll(db, 'leads', 'id, created_at, status, lead_source, form_type, destinations, phone_wa', warnings, 'الطلبات'),
      readAll(db, 'tailor_plans', 'id, created_at, status, total_price, paid_at, ai_usage, country_label, full_name, days_total', warnings, 'خطط فصّل الآن'),
      readAll(db, 'group_trips', 'id, title_ar, is_active, max_seats, booked_seats, price, leader_name', warnings, 'القروبات'),
      readAll(db, 'group_members', 'id, group_id, customer_name, client_id, status, payment_status, created_at, updated_at', warnings, 'أعضاء القروبات'),
      readAll(db, 'group_pricings', 'id, title, passengers_count, total_group_revenue, total_group_net_profit, created_at', warnings, 'تسعير القروبات'),
      readAll(db, 'sessions', 'id, title, date, session_type, price, spots', warnings, 'الجلسات'),
      readAll(db, 'session_registrations', 'id, session_id', warnings, 'تسجيلات الجلسات'),
      readAll(db, 'client_trips', 'id, client_id, destination, profit, trip_date', warnings, 'سجل الرحلات القديم'),
      readAll(db, 'itineraries', 'id, created_at, destination, days_data, is_template, expert_name, customer_name', warnings, 'المسارات'),
      readAll(db, 'operating_expenses', 'id, expense_date, category, description, amount, destination', warnings, 'المصاريف'),
    ]);

  const clientName = new Map<string, string>();
  for (const c of clientsRaw ?? []) clientName.set(str(c.id), str(c.name));

  // ── quotations + invoices → private deals, receipts, receivables
  const invoices = (invoicesRaw ?? []).map((r) => ({
    id: str(r.id),
    quoteId: str(r.quote_id),
    clientId: str(r.client_id) || null,
    amount: Math.max(0, num(r.amount)),
    type: str(r.type),
    status: parseInvoiceStatus(r.status),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
    paidAt: str(r.paid_at) || null,
    receiptUrl: str(r.receipt_url) || null,
    title: str(r.trip_title),
  }));
  const invoicesByQuote = new Map<string, typeof invoices>();
  for (const inv of invoices) {
    if (!inv.quoteId) continue;
    invoicesByQuote.set(inv.quoteId, [...(invoicesByQuote.get(inv.quoteId) ?? []), inv]);
  }

  const quotes: QuoteFact[] = [];
  const deals: DealFact[] = [];
  const receipts: ReceiptFact[] = [];
  const receivables: ReceivableFact[] = [];
  const quoteById = new Map<string, QuoteFact>();

  for (const q of quotationsRaw ?? []) {
    const id = str(q.id);
    if (!id) continue;
    // Exactly the CRM / client-page price rule (cost + Wanderloom profit).
    const eff = effectiveQuotePricing(mapQuotationRow(q));
    const cost = eff.cost;
    const profit = eff.profit;
    const saleValue = eff.total;
    const status = str(q.status);
    const client = str(q.client_name) || clientName.get(str(q.client_id)) || 'عميل';
    const invs = invoicesByQuote.get(id) ?? [];
    const paidInvs = invs.filter((i) => i.status === 'paid');
    let collected = round(paidInvs.reduce((s, i) => s + i.amount, 0));
    let paidDate =
      paidInvs
        .map((i) => dateOnly(i.paidAt) ?? dateOnly(i.updatedAt))
        .filter(Boolean)
        .sort()
        .pop() ?? null;
    // Approved before invoices existed: the quote status is the source of truth.
    if (collected <= 0 && PAID_QUOTE_STATUSES.has(status) && saleValue > 0) {
      collected = saleValue;
      paidDate = dateOnly(q.updated_at) ?? dateOnly(q.created_at);
    }
    const href = `/crm/quotations/edit/${encodeURIComponent(id)}`;
    const fact: QuoteFact = {
      id,
      title: str(q.title) || 'عرض سعر',
      client,
      clientId: str(q.client_id) || null,
      destination: firstDestination(q.destinations ?? q.title),
      status,
      createdAt: str(q.created_at),
      saleValue,
      cost,
      profit,
      collected,
      expert: str(q.expert_name) || null,
      href,
    };
    quotes.push(fact);
    quoteById.set(id, fact);

    if (collected > 0) {
      const ratio = saleValue > 0 ? Math.min(1, collected / saleValue) : 1;
      deals.push({
        id: `quote:${id}`,
        kind: 'private',
        title: fact.title,
        client,
        clientId: fact.clientId,
        destination: fact.destination,
        date: paidDate,
        saleValue: saleValue || collected,
        collected,
        cost: round(cost * ratio),
        profit: saleValue > 0 ? round(profit * ratio) : round(collected - cost),
        outstanding: round(Math.max(0, saleValue - collected)),
        expert: fact.expert,
        href,
      });
    }

    // Receipt uploaded on the quote itself and not yet approved.
    const quoteReceipt = str(q.receipt_url);
    const invoiceReceiptPending = invs.some((i) => i.receiptUrl && i.status !== 'paid' && i.status !== 'rejected');
    if (quoteReceipt && !PAID_QUOTE_STATUSES.has(status) && !DEPOSIT_QUOTE_STATUSES.has(status) && !invoiceReceiptPending && collected <= 0) {
      receipts.push({
        id: `quote:${id}`,
        source: 'quote',
        client,
        title: fact.title,
        amount: saleValue,
        submittedAt: str(q.updated_at) || str(q.created_at),
        receiptUrl: quoteReceipt,
        href,
      });
    }
  }

  let orphanPaid = 0;
  for (const inv of invoices) {
    const quote = inv.quoteId ? quoteById.get(inv.quoteId) : undefined;
    const client = quote?.client ?? (inv.clientId ? clientName.get(inv.clientId) : '') ?? '';
    const href = inv.quoteId ? `/crm/quotations/edit/${encodeURIComponent(inv.quoteId)}` : '/crm/quotations';
    const title = inv.title || quote?.title || 'فاتورة';
    if (inv.status === 'payment_review' || (inv.status === 'pending' && inv.receiptUrl)) {
      receipts.push({
        id: `invoice:${inv.id}`,
        source: 'invoice',
        client: client || 'عميل',
        title,
        amount: inv.amount,
        submittedAt: inv.updatedAt || inv.createdAt,
        receiptUrl: inv.receiptUrl,
        href,
      });
    }
    if (inv.status === 'pending' || inv.status === 'payment_review') {
      receivables.push({ id: inv.id, client: client || 'عميل', title, amount: inv.amount, createdAt: inv.createdAt, type: inv.type, href });
    }
    if (inv.status === 'paid' && !quote) {
      orphanPaid += 1;
      deals.push({
        id: `invoice:${inv.id}`,
        kind: 'private',
        title,
        client: client || 'عميل',
        clientId: inv.clientId,
        destination: 'غير محدد',
        date: dateOnly(inv.paidAt) ?? dateOnly(inv.updatedAt),
        saleValue: inv.amount,
        collected: inv.amount,
        cost: 0,
        profit: 0,
        outstanding: 0,
        expert: null,
        href,
      });
    }
  }
  if (orphanPaid) warnings.push(`${orphanPaid} فاتورة مدفوعة غير مربوطة بعرض سعر — ربحها غير محسوب.`);

  // ── «فصّل الآن»
  const tailor: TailorFact[] = [];
  for (const t of tailorRaw ?? []) {
    const usage = (t.ai_usage ?? {}) as Row;
    const aiCostSar = round(num(usage.cost_usd) * USD_TO_SAR);
    const total = num(t.total_price);
    const paid = Boolean(str(t.paid_at));
    const status = str(t.status);
    tailor.push({ id: str(t.id), createdAt: str(t.created_at), status, total, paid, aiCostSar, country: str(t.country_label) });
    if (paid) {
      deals.push({
        id: `tailor:${str(t.id)}`,
        kind: 'tailor',
        title: `فصّل الآن · ${str(t.days_total)} أيام`,
        client: str(t.full_name) || 'عميل',
        clientId: null,
        destination: firstDestination(t.country_label),
        date: dateOnly(t.paid_at),
        saleValue: total,
        collected: total,
        cost: aiCostSar,
        profit: round(total - aiCostSar),
        outstanding: 0,
        expert: null,
        href: '/crm/tailor-now',
      });
    } else if (status === 'receipt_submitted') {
      receipts.push({
        id: `tailor:${str(t.id)}`,
        source: 'tailor',
        client: str(t.full_name) || 'عميل',
        title: `فصّل الآن · ${str(t.days_total)} أيام`,
        amount: total,
        submittedAt: str(t.created_at),
        receiptUrl: null,
        href: '/crm/tailor-now',
      });
    }
  }

  // ── groups
  const membersByGroup = new Map<string, Row[]>();
  for (const m of membersRaw ?? []) {
    const g = str(m.group_id);
    membersByGroup.set(g, [...(membersByGroup.get(g) ?? []), m]);
  }
  const groups: GroupFact[] = [];
  let groupsWithoutCost = 0;
  for (const g of groupsRaw ?? []) {
    const id = str(g.id);
    const members = (membersByGroup.get(id) ?? []).filter((m) => !/cancel|reject|ملغ/i.test(str(m.status)));
    const paidMembers = members.filter((m) => /paid|مدفوع/i.test(str(m.payment_status)));
    const pricePerSeat = num(g.price);
    const title = str(g.title_ar) || `قروب ${id}`;
    groups.push({
      id,
      title,
      active: g.is_active === true,
      maxSeats: num(g.max_seats),
      members: Math.max(members.length, num(g.booked_seats)),
      paidMembers: paidMembers.length,
      pricePerSeat,
      leader: str(g.leader_name),
    });
    for (const m of paidMembers) {
      if (pricePerSeat <= 0) continue;
      groupsWithoutCost += 1;
      deals.push({
        id: `group:${str(m.id)}`,
        kind: 'group',
        title,
        client: str(m.customer_name) || 'مسافر',
        clientId: str(m.client_id) || null,
        destination: firstDestination(title.replace(/[—–-].*$/, '')),
        date: dateOnly(m.updated_at) ?? dateOnly(m.created_at),
        saleValue: pricePerSeat,
        collected: pricePerSeat,
        cost: 0,
        profit: 0,
        outstanding: 0,
        expert: null,
        href: '/crm/groups',
      });
    }
  }
  if (groupsWithoutCost) warnings.push('أرباح مقاعد القروبات غير محسوبة لأن تسعير القروب غير مربوط بالرحلة — الإيراد فقط.');

  const groupPlans: GroupPlanFact[] = (plansRaw ?? []).map((p) => ({
    id: str(p.id),
    title: str(p.title) || 'تسعير قروب',
    passengers: num(p.passengers_count),
    revenue: num(p.total_group_revenue),
    profit: num(p.total_group_net_profit),
    createdAt: str(p.created_at),
  }));

  // ── sessions
  const regsBySession = new Map<string, number>();
  for (const r of regsRaw ?? []) regsBySession.set(str(r.session_id), (regsBySession.get(str(r.session_id)) ?? 0) + 1);
  const sessions: SessionFact[] = (sessionsRaw ?? []).map((s) => ({
    id: str(s.id),
    title: str(s.title) || 'جلسة',
    date: dateOnly(s.date),
    type: str(s.session_type),
    price: num(s.price),
    spots: num(s.spots),
    registrations: regsBySession.get(str(s.id)) ?? 0,
  }));
  for (const s of sessions) {
    if (s.price <= 0 || s.registrations <= 0) continue;
    const revenue = round(s.price * s.registrations);
    deals.push({
      id: `session:${s.id}`,
      kind: 'session',
      title: s.title,
      client: `${s.registrations} مسجّل`,
      clientId: null,
      destination: 'الجلسات',
      date: s.date,
      saleValue: revenue,
      collected: revenue,
      cost: 0,
      profit: revenue,
      outstanding: 0,
      expert: null,
      href: '/crm/sessions',
    });
  }

  // ── legacy client_trips (profit only)
  for (const t of legacyRaw ?? []) {
    const profit = num(t.profit);
    if (profit <= 0) continue;
    deals.push({
      id: `legacy:${str(t.id)}`,
      kind: 'legacy',
      title: `رحلة ${str(t.destination) || ''}`.trim(),
      client: clientName.get(str(t.client_id)) || 'عميل',
      clientId: str(t.client_id) || null,
      destination: firstDestination(t.destination),
      date: dateOnly(t.trip_date),
      saleValue: 0,
      collected: 0,
      cost: 0,
      profit,
      outstanding: 0,
      expert: null,
      href: '/crm/clients',
      profitOnly: true,
    });
  }

  // ── leads, clients
  const leads: LeadFact[] = (leadsRaw ?? []).map((l) => {
    const phone = sanitizePhoneDigits(str(l.phone_wa));
    return {
      id: str(l.id),
      createdAt: str(l.created_at),
      status: str(l.status) || 'radar_pending',
      source: str(l.lead_source) || 'غير محدد',
      formType: str(l.form_type) || 'غير محدد',
      destinations: (Array.isArray(l.destinations) ? l.destinations : [l.destinations]).map((d) => firstDestination(d)).filter((d) => d !== 'غير محدد'),
      hasPhone: phone.length >= 8,
      phoneKey: phone.slice(-9),
    };
  });
  const clients: ClientFact[] = (clientsRaw ?? []).map((c) => ({
    id: str(c.id),
    name: str(c.name),
    createdAt: str(c.created_at),
    city: str(c.city) || 'غير محدد',
    source: str(c.lead_source) || 'غير محدد',
    tier: str(c.client_tier) || str(c.vip_tier) || 'غير محدد',
  }));

  // ── itineraries (carried over from «الإحصائيات»)
  const itins = (itinerariesRaw ?? []).filter((r) => !(r.is_template === true || str(r.is_template) === 'true'));
  const countryCounter: string[] = [];
  const hotelCounter: string[] = [];
  for (const it of itins) {
    const raw = it.days_data;
    const days = Array.isArray(raw) ? raw : Array.isArray((raw as Row | null)?.days) ? ((raw as Row).days as unknown[]) : [];
    let countedCountry = false;
    for (const d of days as Row[]) {
      const hotel = (d?.hotel ?? null) as Row | null;
      const exp = (d?.experience ?? null) as Row | null;
      const hotelName = str(hotel?.name);
      if (hotelName) hotelCounter.push(hotelName);
      const country = str(hotel?.country) || str(exp?.country);
      if (country) {
        countryCounter.push(country);
        countedCountry = true;
      }
    }
    if (!countedCountry && str(it.destination)) countryCounter.push(firstDestination(it.destination));
  }
  const toRows = (list: string[], limit: number): CountRow[] => countBy(list, (x) => x, limit);

  const expenses: ExpenseFact[] = (expensesRaw ?? []).map((e) => ({
    id: str(e.id),
    date: dateOnly(e.expense_date) ?? '',
    category: str(e.category) || 'other',
    description: str(e.description),
    amount: Math.max(0, num(e.amount)),
    destination: str(e.destination),
  }));

  return {
    generatedAt: new Date().toISOString(),
    deals: deals.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))),
    quotes,
    receipts: receipts.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    receivables: receivables.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    leads,
    clients,
    groups,
    groupPlans,
    sessions,
    tailor,
    expenses,
    expensesAvailable: expensesRaw !== null,
    itineraries: {
      total: itins.length,
      topCountries: toRows(countryCounter, 5),
      topHotels: toRows(hotelCounter, 5),
      byExpert: countBy(itins, (r) => str(r.expert_name) || null, 8),
    },
    warnings,
  };
}
