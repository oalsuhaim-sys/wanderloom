/**
 * Company BI — shared (client-safe) types and pure aggregations used by
 * «التقارير المالية» and «لوحة الشركة». The server sends normalized "facts";
 * every number on both pages is computed here so the two pages always agree.
 */

export type DealKind = 'private' | 'tailor' | 'group' | 'session' | 'legacy';

/** Money that actually came in (or a legacy record of profit). */
export type DealFact = {
  id: string;
  kind: DealKind;
  title: string;
  client: string;
  clientId: string | null;
  destination: string;
  /** ISO date the money was confirmed (null for legacy rows without a date). */
  date: string | null;
  /** Full sale value agreed with the client. */
  saleValue: number;
  /** Collected and approved. */
  collected: number;
  /** Cost attributed to what was collected. */
  cost: number;
  /** Profit attributed to what was collected. */
  profit: number;
  /** Agreed but not yet collected. */
  outstanding: number;
  expert: string | null;
  href: string | null;
  /** Profit known but revenue unknown (legacy client_trips). */
  profitOnly?: boolean;
};

export type QuoteFact = {
  id: string;
  title: string;
  client: string;
  clientId: string | null;
  destination: string;
  status: string;
  createdAt: string;
  saleValue: number;
  cost: number;
  profit: number;
  collected: number;
  expert: string | null;
  href: string;
};

/** A receipt the client uploaded that staff haven't approved yet. */
export type ReceiptFact = {
  id: string;
  source: 'invoice' | 'quote' | 'tailor';
  client: string;
  title: string;
  amount: number;
  submittedAt: string;
  receiptUrl: string | null;
  href: string;
};

export type ReceivableFact = {
  id: string;
  client: string;
  title: string;
  amount: number;
  createdAt: string;
  type: string;
  href: string;
};

export type LeadFact = {
  id: string;
  createdAt: string;
  status: string;
  source: string;
  formType: string;
  destinations: string[];
  hasPhone: boolean;
  phoneKey: string;
};

export type ClientFact = {
  id: string;
  name: string;
  createdAt: string;
  city: string;
  source: string;
  tier: string;
};

export type GroupFact = {
  id: string;
  title: string;
  active: boolean;
  maxSeats: number;
  members: number;
  paidMembers: number;
  pricePerSeat: number;
  leader: string;
};

export type GroupPlanFact = {
  id: string;
  title: string;
  passengers: number;
  revenue: number;
  profit: number;
  createdAt: string;
};

export type SessionFact = {
  id: string;
  title: string;
  date: string | null;
  type: string;
  price: number;
  spots: number;
  registrations: number;
};

export type TailorFact = {
  id: string;
  createdAt: string;
  status: string;
  total: number;
  paid: boolean;
  aiCostSar: number;
  country: string;
};

export type ExpenseFact = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  destination: string;
};

export type CountRow = { label: string; count: number };

export type CompanyFacts = {
  generatedAt: string;
  deals: DealFact[];
  quotes: QuoteFact[];
  receipts: ReceiptFact[];
  receivables: ReceivableFact[];
  leads: LeadFact[];
  clients: ClientFact[];
  groups: GroupFact[];
  groupPlans: GroupPlanFact[];
  sessions: SessionFact[];
  tailor: TailorFact[];
  expenses: ExpenseFact[];
  expensesAvailable: boolean;
  itineraries: { total: number; topCountries: CountRow[]; topHotels: CountRow[]; byExpert: CountRow[] };
  warnings: string[];
};

// ─────────────────────────────────────────────────────────────── periods

export type PeriodKey = 'this_month' | 'last_month' | 'last_3' | 'this_year' | 'all';

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  this_month: 'هذا الشهر',
  last_month: 'الشهر الماضي',
  last_3: 'آخر 3 أشهر',
  this_year: 'هذه السنة',
  all: 'كل الفترات',
};

/** [from, to) in ISO date strings (Asia/Riyadh calendar month boundaries are close enough at day level). */
export function periodRange(key: PeriodKey, now = new Date()): { from: string | null; to: string | null } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  switch (key) {
    case 'this_month':
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 1)) };
    case 'last_month':
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 1)) };
    case 'last_3':
      return { from: iso(new Date(y, m - 2, 1)), to: iso(new Date(y, m + 1, 1)) };
    case 'this_year':
      return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y + 1, 0, 1)) };
    default:
      return { from: null, to: null };
  }
}

export function inPeriod(date: string | null | undefined, range: { from: string | null; to: string | null }): boolean {
  if (!range.from && !range.to) return true;
  if (!date) return false;
  const d = date.slice(0, 10);
  if (range.from && d < range.from) return false;
  if (range.to && d >= range.to) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────── helpers

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sum<T>(list: T[], pick: (x: T) => number): number {
  return round(list.reduce((s, x) => s + (Number(pick(x)) || 0), 0));
}

export function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

export function formatSar(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${Math.round(n).toLocaleString('en-US')} ر.س`;
}

export function formatPct(n: number | null | undefined): string {
  return n == null ? '—' : `${n.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
}

export function monthKey(date: string | null | undefined): string | null {
  return date && date.length >= 7 ? date.slice(0, 7) : null;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString('ar-SA-u-nu-latn', { month: 'long', year: 'numeric' });
}

export function countBy<T>(list: T[], key: (x: T) => string | string[] | null | undefined, limit = 12): CountRow[] {
  const map = new Map<string, number>();
  for (const x of list) {
    const raw = key(x);
    const keys = Array.isArray(raw) ? raw : [raw];
    for (const k of keys) {
      const label = String(k ?? '').trim() || 'غير محدد';
      map.set(label, (map.get(label) ?? 0) + 1);
    }
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export const DEAL_KIND_LABEL: Record<DealKind, string> = {
  private: 'رحلات خاصة',
  tailor: 'فصّل الآن',
  group: 'رحلات جماعية',
  session: 'الجلسات',
  legacy: 'سجل قديم',
};

export const EXPENSE_CATEGORIES: Record<string, string> = {
  salaries: 'رواتب',
  rent: 'إيجار',
  marketing: 'تسويق وإعلانات',
  subscriptions: 'اشتراكات وأنظمة',
  ai: 'ذكاء اصطناعي واستضافة',
  travel: 'سفر وتنقلات',
  government: 'رسوم حكومية',
  other: 'أخرى',
};

// ─────────────────────────────────────────────────────────────── finance summary

export type FinanceSummary = {
  revenue: number;
  tripCost: number;
  grossProfit: number;
  grossMargin: number | null;
  expenses: number;
  netProfit: number;
  netMargin: number | null;
  outstanding: number;
  receivables: number;
  paidDeals: number;
  paidClients: number;
  legacyProfit: number;
  byKind: Array<{ kind: DealKind; revenue: number; profit: number; count: number }>;
};

/** Deals with money confirmed in the period (legacy rows only count in «كل الفترات»). */
export function dealsInPeriod(facts: CompanyFacts, range: { from: string | null; to: string | null }): DealFact[] {
  return facts.deals.filter((d) => (d.date ? inPeriod(d.date, range) : !range.from && !range.to));
}

export function financeSummary(facts: CompanyFacts, range: { from: string | null; to: string | null }): FinanceSummary {
  const deals = dealsInPeriod(facts, range);
  const revenueDeals = deals.filter((d) => !d.profitOnly);
  const revenue = sum(revenueDeals, (d) => d.collected);
  const tripCost = sum(revenueDeals, (d) => d.cost);
  const legacyProfit = sum(deals.filter((d) => d.profitOnly), (d) => d.profit);
  const grossProfit = round(sum(revenueDeals, (d) => d.profit) + legacyProfit);
  const expenses = sum(facts.expenses.filter((e) => inPeriod(e.date, range)), (e) => e.amount);
  const netProfit = round(grossProfit - expenses);
  const kinds: DealKind[] = ['private', 'tailor', 'group', 'session', 'legacy'];
  return {
    revenue,
    tripCost,
    grossProfit,
    grossMargin: pct(round(grossProfit - legacyProfit), revenue),
    expenses,
    netProfit,
    netMargin: pct(round(netProfit - legacyProfit), revenue),
    outstanding: sum(deals, (d) => d.outstanding),
    receivables: sum(facts.receivables, (r) => r.amount),
    paidDeals: revenueDeals.filter((d) => d.collected > 0).length,
    paidClients: new Set(revenueDeals.filter((d) => d.collected > 0).map((d) => d.clientId || d.client)).size,
    legacyProfit,
    byKind: kinds
      .map((kind) => {
        const list = deals.filter((d) => d.kind === kind);
        return { kind, revenue: sum(list, (d) => d.collected), profit: sum(list, (d) => d.profit), count: list.length };
      })
      .filter((k) => k.count > 0),
  };
}

export type FunnelStep = { key: string; label: string; count: number; hint: string };

/** طلب ← عرض سعر ← إيصال بانتظار الاعتماد ← مدفوع ومعتمد */
export function salesFunnel(facts: CompanyFacts, range: { from: string | null; to: string | null }): FunnelStep[] {
  const leads = facts.leads.filter((l) => inPeriod(l.createdAt, range));
  const quotes = facts.quotes.filter((q) => inPeriod(q.createdAt, range));
  const paid = dealsInPeriod(facts, range).filter((d) => !d.profitOnly && d.collected > 0);
  return [
    { key: 'leads', label: 'طلبات وصلت', count: leads.length, hint: 'من نماذج الموقع و«فصّل الآن»' },
    { key: 'quotes', label: 'عروض أسعار', count: quotes.length, hint: 'أُنشئت في الفترة' },
    { key: 'receipts', label: 'إيصالات بانتظار اعتمادك', count: facts.receipts.length, hint: 'الآن، بغض النظر عن الفترة' },
    { key: 'paid', label: 'مدفوعة ومعتمدة', count: paid.length, hint: 'تم تأكيد الدفع في الفترة' },
  ];
}

export type MonthRow = {
  month: string;
  revenue: number;
  tripCost: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  netMargin: number | null;
  growth: number | null;
  deals: number;
  leads: number;
};

export function monthlyRows(facts: CompanyFacts, months = 12, now = new Date()): MonthRow[] {
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const rows = keys.map((month) => {
    const deals = facts.deals.filter((d) => !d.profitOnly && monthKey(d.date) === month);
    const revenue = sum(deals, (d) => d.collected);
    const tripCost = sum(deals, (d) => d.cost);
    const grossProfit = sum(deals, (d) => d.profit);
    const expenses = sum(facts.expenses.filter((e) => monthKey(e.date) === month), (e) => e.amount);
    const netProfit = round(grossProfit - expenses);
    return {
      month,
      revenue,
      tripCost,
      grossProfit,
      expenses,
      netProfit,
      netMargin: pct(netProfit, revenue),
      growth: null as number | null,
      deals: deals.length,
      leads: facts.leads.filter((l) => monthKey(l.createdAt) === month).length,
    };
  });
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.growth = prev && prev.revenue > 0 ? Math.round(((r.revenue - prev.revenue) / prev.revenue) * 1000) / 10 : null;
  });
  return rows;
}

export type DestinationRow = {
  destination: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number | null;
  deals: number;
  avgProfit: number;
  share: number | null;
  leads: number;
};

export function destinationRows(facts: CompanyFacts, range: { from: string | null; to: string | null }): DestinationRow[] {
  const deals = dealsInPeriod(facts, range);
  const leads = facts.leads.filter((l) => inPeriod(l.createdAt, range));
  const totalProfit = sum(deals, (d) => d.profit);
  const map = new Map<string, DealFact[]>();
  for (const d of deals) {
    const k = d.destination || 'غير محدد';
    map.set(k, [...(map.get(k) ?? []), d]);
  }
  const leadCount = new Map<string, number>();
  for (const l of leads) for (const dest of l.destinations) leadCount.set(dest, (leadCount.get(dest) ?? 0) + 1);
  return [...map.entries()]
    .map(([destination, list]) => {
      const revenueList = list.filter((d) => !d.profitOnly);
      const revenue = sum(revenueList, (d) => d.collected);
      const profit = sum(list, (d) => d.profit);
      return {
        destination,
        revenue,
        cost: sum(revenueList, (d) => d.cost),
        profit,
        margin: pct(sum(revenueList, (d) => d.profit), revenue),
        deals: list.length,
        avgProfit: list.length ? round(profit / list.length) : 0,
        share: pct(profit, totalProfit),
        leads: leadCount.get(destination) ?? 0,
      };
    })
    .sort((a, b) => b.profit - a.profit || b.revenue - a.revenue);
}

export type ExpertRow = { expert: string; deals: number; revenue: number; profit: number };

export function expertRows(facts: CompanyFacts, range: { from: string | null; to: string | null }): ExpertRow[] {
  const map = new Map<string, ExpertRow>();
  for (const d of dealsInPeriod(facts, range)) {
    if (!d.expert) continue;
    const row = map.get(d.expert) ?? { expert: d.expert, deals: 0, revenue: 0, profit: 0 };
    row.deals += 1;
    row.revenue = round(row.revenue + d.collected);
    row.profit = round(row.profit + d.profit);
    map.set(d.expert, row);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

export type ClientValueRow = { client: string; deals: number; revenue: number; profit: number };

export function topClients(facts: CompanyFacts, range: { from: string | null; to: string | null }, limit = 8): ClientValueRow[] {
  const map = new Map<string, ClientValueRow>();
  for (const d of dealsInPeriod(facts, range)) {
    if (d.profitOnly || d.collected <= 0) continue;
    const k = d.client || 'غير محدد';
    const row = map.get(k) ?? { client: k, deals: 0, revenue: 0, profit: 0 };
    row.deals += 1;
    row.revenue = round(row.revenue + d.collected);
    row.profit = round(row.profit + d.profit);
    map.set(k, row);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export type Alert = { level: 'warn' | 'info'; text: string };

/** Data checks in the spirit of the Excel model (missing costs, duplicates, stale follow-ups…). */
export function dataAlerts(facts: CompanyFacts): Alert[] {
  const alerts: Alert[] = [];
  const noCost = facts.quotes.filter((q) => q.saleValue > 0 && q.cost <= 0);
  if (noCost.length) alerts.push({ level: 'warn', text: `${noCost.length} عرض سعر بدون تكلفة مسجّلة — الربح فيها غير دقيق.` });
  const noProfit = facts.quotes.filter((q) => q.saleValue <= 0);
  if (noProfit.length) alerts.push({ level: 'warn', text: `${noProfit.length} عرض سعر بدون قيمة بيع.` });
  if (facts.receipts.length) alerts.push({ level: 'warn', text: `${facts.receipts.length} إيصال بانتظار اعتمادك — الأرباح لا تُحتسب قبل الاعتماد.` });
  const staleDays = 3;
  const stale = facts.leads.filter(
    (l) => ['radar_pending', 'new', 'pending'].includes(l.status) && Date.now() - new Date(l.createdAt).getTime() > staleDays * 86_400_000,
  );
  if (stale.length) alerts.push({ level: 'warn', text: `${stale.length} طلب جديد لم يُرد عليه منذ أكثر من ${staleDays} أيام.` });
  const phones = new Map<string, number>();
  for (const l of facts.leads) if (l.phoneKey) phones.set(l.phoneKey, (phones.get(l.phoneKey) ?? 0) + 1);
  const dup = [...phones.values()].filter((n) => n > 1).length;
  if (dup) alerts.push({ level: 'info', text: `${dup} رقم جوال مكرر في الطلبات (نفس العميل أرسل أكثر من طلب).` });
  const noPhone = facts.leads.filter((l) => !l.hasPhone).length;
  if (noPhone) alerts.push({ level: 'info', text: `${noPhone} طلب بدون رقم جوال.` });
  for (const g of facts.groups) {
    if (g.active && g.maxSeats > 0 && g.members > g.maxSeats) {
      alerts.push({ level: 'warn', text: `قروب «${g.title}»: المسجّلون (${g.members}) أكثر من المقاعد (${g.maxSeats}).` });
    }
    if (g.active && g.pricePerSeat <= 0) alerts.push({ level: 'info', text: `قروب «${g.title}» بدون سعر مقعد — إيراداته لا تظهر.` });
  }
  if (!facts.expensesAvailable) alerts.push({ level: 'info', text: 'جدول المصاريف التشغيلية غير مفعّل بعد — صافي الربح = مجمل الربح.' });
  for (const w of facts.warnings) alerts.push({ level: 'info', text: w });
  return alerts;
}
