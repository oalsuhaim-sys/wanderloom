'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, Plus, Receipt, Trash2, Wallet } from 'lucide-react';

import { getClientAccessToken } from '@/lib/crm-session-token';
import {
  DEAL_KIND_LABEL,
  EXPENSE_CATEGORIES,
  financeSummary,
  formatPct,
  formatSar,
  inPeriod,
  monthLabel,
  monthlyRows,
  periodRange,
  dealsInPeriod,
  salesFunnel,
  sum,
  type PeriodKey,
} from '@/lib/company-bi';

import { MonthlyChart } from '../_components/bi/MonthlyChart';
import { CARD, Empty, Kpi, LoadingState, PageHeader, RowLink, Section, Table, shortDate, useCompanyFacts } from '../_components/bi/ui';

const EXPENSES_SQL_URL = 'https://github.com/oalsuhaim-sys/wanderloom/blob/main/supabase/sql/operating_expenses.sql';

export default function FinancialReportsClient() {
  const { facts, error, loading, reload } = useCompanyFacts();
  const [period, setPeriod] = useState<PeriodKey>('this_month');
  const range = useMemo(() => periodRange(period), [period]);

  const summary = useMemo(() => (facts ? financeSummary(facts, range) : null), [facts, range]);
  const funnel = useMemo(() => (facts ? salesFunnel(facts, range) : []), [facts, range]);
  const months = useMemo(() => (facts ? monthlyRows(facts, 12) : []), [facts]);
  const deals = useMemo(() => (facts ? dealsInPeriod(facts, range).filter((d) => !d.profitOnly) : []), [facts, range]);
  const expenses = useMemo(() => (facts ? facts.expenses.filter((e) => inPeriod(e.date, range)) : []), [facts, range]);

  if (loading && !facts) return <Shell><LoadingState /></Shell>;
  if (error || !facts || !summary) {
    return (
      <Shell>
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error ?? 'تعذّر تحميل البيانات.'}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader
        kicker="Financial Reports"
        title="التقارير المالية"
        sub="الطريق من الطلب إلى الربح: عرض السعر، ثم إيصال العميل، ثم اعتمادك، وبعدها يدخل المبلغ في الإيرادات والأرباح."
        period={period}
        onPeriod={setPeriod}
        onReload={reload}
        loading={loading}
        extra={
          <Link href="/crm/company-dashboard" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1C2E3A] px-3 text-sm font-bold text-white dark:bg-[#D4AF37] dark:text-[#1A2421]">
            لوحة الشركة <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
        }
      />

      {/* funnel */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="مسار البيع">
        {funnel.map((step, i) => (
          <div key={step.key} className={`${CARD} relative ${step.key === 'receipts' && step.count > 0 ? 'border-amber-300 bg-amber-50/60 dark:border-amber-700/60 dark:bg-amber-900/10' : ''}`}>
            <p className="text-[11px] font-semibold text-slate-400">الخطوة {i + 1}</p>
            <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">{step.label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl dark:text-white">{step.count}</p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{step.hint}</p>
          </div>
        ))}
      </section>

      {/* money */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="الملخص المالي">
        <Kpi label="الإيرادات المحصّلة" value={formatSar(summary.revenue)} sub={`${summary.paidDeals} عملية مدفوعة · ${summary.paidClients} عميل`} tone="gold" icon={<Wallet className="h-4 w-4" />} />
        <Kpi label="تكلفة الرحلات" value={formatSar(summary.tripCost)} sub="فنادق وطيران وموردين للمبالغ المحصّلة" />
        <Kpi label="مجمل الربح" value={formatSar(summary.grossProfit)} sub={`الهامش ${formatPct(summary.grossMargin)}${summary.legacyProfit ? ` · منها ${formatSar(summary.legacyProfit)} سجل قديم` : ''}`} tone="emerald" />
        <Kpi
          label="صافي الربح"
          value={formatSar(summary.netProfit)}
          sub={facts.expensesAvailable ? `بعد مصاريف ${formatSar(summary.expenses)} · الهامش ${formatPct(summary.netMargin)}` : 'المصاريف غير مفعّلة بعد'}
          tone={summary.netProfit < 0 ? 'rose' : 'emerald'}
        />
        <Kpi label="متبقٍ على عملاء دفعوا جزءاً" value={formatSar(summary.outstanding)} sub="عرابين لم يُستكمل باقيها" tone="amber" />
        <Kpi label="فواتير بانتظار السداد" value={formatSar(summary.receivables)} sub={`${facts.receivables.length} فاتورة مفتوحة الآن`} tone="amber" />
        <Kpi label="نسبة التحويل" value={formatPct(funnel[0]?.count ? Math.round(((funnel[3]?.count ?? 0) / funnel[0].count) * 1000) / 10 : null)} sub="من الطلبات إلى عمليات مدفوعة في الفترة" />
        <Kpi label="عروض الأسعار في الفترة" value={formatSar(sum(facts.quotes.filter((q) => inPeriod(q.createdAt, range)), (q) => q.saleValue))} sub="قيمة كل العروض المرسلة (مدفوعة وغير مدفوعة)" />
      </section>

      {/* awaiting approval */}
      <Section
        title="إيصالات بانتظار اعتمادك"
        sub="الأرباح لا تدخل التقارير قبل اعتماد الإيصال. افتح العرض واعتمد الحوالة من هناك."
        action={facts.receipts.length ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{facts.receipts.length}</span> : null}
      >
        {facts.receipts.length ? (
          <ul className="divide-y divide-slate-100 dark:divide-[#2D3F3A]">
            {facts.receipts.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white">{r.client}</p>
                  <p className="truncate text-xs text-slate-500">
                    {r.title} · {shortDate(r.submittedAt)} · {r.source === 'tailor' ? 'فصّل الآن' : 'عرض سعر'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{formatSar(r.amount)}</span>
                  {r.receiptUrl ? (
                    <a href={r.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-900">
                      <Receipt className="h-3.5 w-3.5" aria-hidden /> الإيصال
                    </a>
                  ) : null}
                  <Link href={r.href} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> راجع واعتمد
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty text="لا توجد إيصالات معلّقة. ممتاز." />
        )}
      </Section>

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <Section title="الإيرادات حسب النوع" sub="الفترة المختارة" className="lg:col-span-1">
          {summary.byKind.length ? (
            <ul className="space-y-3">
              {summary.byKind.map((k) => (
                <li key={k.kind} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-[#1A2421]">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{DEAL_KIND_LABEL[k.kind]}</span>
                  <span className="text-end">
                    <span className="block text-sm font-bold tabular-nums text-slate-900 dark:text-white">{k.kind === 'legacy' ? '—' : formatSar(k.revenue)}</span>
                    <span className="block text-[11px] text-emerald-700 dark:text-emerald-400">ربح {formatSar(k.profit)} · {k.count}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="لا توجد مبالغ مؤكدة في هذه الفترة." />
          )}
        </Section>

        <Section title="المقارنة الشهرية" sub="آخر 12 شهراً — الإيرادات والأرباح والمصاريف" className="lg:col-span-2">
          <MonthlyChart rows={months} />
        </Section>
      </div>

      <Section title="العمليات المدفوعة" sub="كل مبلغ اعتمدته في الفترة، مع تكلفته وربحه">
        <Table
          head={['التاريخ', 'العميل', 'الرحلة', 'النوع', 'المحصّل', 'التكلفة', 'الربح', 'متبقٍ']}
          empty="لا توجد عمليات مدفوعة في هذه الفترة."
          rows={deals.map((d) => [
            shortDate(d.date),
            d.client,
            <RowLink key="t" href={d.href}>{d.title}</RowLink>,
            DEAL_KIND_LABEL[d.kind],
            <span key="c" className="tabular-nums">{formatSar(d.collected)}</span>,
            <span key="k" className="tabular-nums">{formatSar(d.cost)}</span>,
            <span key="p" className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatSar(d.profit)}</span>,
            d.outstanding ? <span key="o" className="tabular-nums text-amber-600">{formatSar(d.outstanding)}</span> : '—',
          ])}
        />
      </Section>

      <Section title="فواتير بانتظار السداد" sub="فواتير صدرت ولم تُدفع بعد">
        <Table
          head={['التاريخ', 'العميل', 'الرحلة', 'نوع الدفعة', 'المبلغ', '']}
          empty="لا توجد فواتير مفتوحة."
          rows={facts.receivables.map((r) => [
            shortDate(r.createdAt),
            r.client,
            r.title,
            r.type === 'deposit' ? 'عربون' : r.type === 'full' ? 'كامل' : r.type || '—',
            <span key="a" className="tabular-nums">{formatSar(r.amount)}</span>,
            <Link key="l" href={r.href} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden /> فتح
            </Link>,
          ])}
        />
      </Section>

      <ExpensesSection available={facts.expensesAvailable} expenses={expenses} periodTotal={summary.expenses} onChanged={reload} />

      <Section title="جدول المقارنة الشهرية" sub="نفس أعمدة التقرير الشهري في ملف الإكسل">
        <Table
          head={['الشهر', 'الإيرادات', 'تكلفة الرحلات', 'مجمل الربح', 'المصاريف', 'صافي الربح', 'الهامش', 'النمو', 'طلبات']}
          empty="لا توجد بيانات."
          rows={[...months]
            .reverse()
            .filter((m, i) => i === 0 || m.revenue || m.expenses || m.grossProfit || m.leads)
            .map((m) => [
            monthLabel(m.month),
            formatSar(m.revenue),
            formatSar(m.tripCost),
            formatSar(m.grossProfit),
            formatSar(m.expenses),
            <span key="n" className={m.netProfit < 0 ? 'font-bold text-rose-600' : 'font-bold text-emerald-700 dark:text-emerald-400'}>{formatSar(m.netProfit)}</span>,
            formatPct(m.netMargin),
            m.growth == null ? '—' : <span key="g" className={m.growth < 0 ? 'text-rose-600' : 'text-emerald-700'}>{formatPct(m.growth)}</span>,
            m.leads,
          ])}
        />
      </Section>

      <p className="text-[11px] leading-relaxed text-slate-400">
        طريقة الحساب: الإيراد = المبالغ المعتمدة فقط. إذا دفع العميل جزءاً من العرض، تُحتسب التكلفة والربح بنفس النسبة. «فصّل الآن» تكلفته تكلفة Claude الفعلية.
        السجل القديم (رحلات العملاء قبل النظام) يُعرض ربحه فقط في «كل الفترات».
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="mx-auto w-full max-w-[min(100%,88rem)] space-y-5 px-4 pb-12 sm:px-6">
      {children}
    </div>
  );
}

function ExpensesSection({
  available,
  expenses,
  periodTotal,
  onChanged,
}: {
  available: boolean;
  expenses: { id: string; date: string; category: string; description: string; amount: number }[];
  periodTotal: number;
  onChanged: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState('salaries');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const add = async () => {
    setMsg(null);
    if (!(Number(amount) > 0)) {
      setMsg('اكتب مبلغاً صحيحاً.');
      return;
    }
    setBusy(true);
    try {
      const token = await getClientAccessToken();
      const res = await fetch('/api/crm/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date, category, description, amount }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!json.ok) {
        setMsg(json.error === 'table_missing' ? 'جدول المصاريف غير موجود بعد.' : 'تعذّر الحفظ.');
        return;
      }
      setDescription('');
      setAmount('');
      setMsg('تمت الإضافة.');
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('حذف هذا المصروف؟')) return;
    const token = await getClientAccessToken();
    await fetch(`/api/crm/expenses/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    onChanged();
  };

  const input = 'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-white';

  return (
    <Section title="المصاريف التشغيلية" sub="رواتب وإيجار وتسويق واشتراكات… تُخصم من مجمل الربح ليظهر صافي الربح" action={<span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{formatSar(periodTotal)}</span>}>
      {!available ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium leading-relaxed text-amber-900">
          تسجيل المصاريف يحتاج جدولاً جديداً في قاعدة البيانات. شغّل كود{' '}
          <a href={EXPENSES_SQL_URL} target="_blank" rel="noopener noreferrer" className="font-bold underline">
            operating_expenses.sql
          </a>{' '}
          في Supabase ← SQL Editor مرة واحدة، ثم حدّث الصفحة.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-[150px_180px_1fr_140px_auto]">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} aria-label="التاريخ" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={input} aria-label="النوع">
              {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="الوصف (مثال: رواتب نوفمبر)" className={input} maxLength={300} />
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="المبلغ" inputMode="decimal" dir="ltr" className={input} />
            <button type="button" onClick={() => void add()} disabled={busy} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#1C2E3A] px-4 text-sm font-bold text-white disabled:opacity-60 dark:bg-[#D4AF37] dark:text-[#1A2421]">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />} إضافة
            </button>
          </div>
          {msg ? <p className="text-xs font-bold text-slate-500">{msg}</p> : null}
          <div className="grid min-w-0 gap-4 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              <Table
                head={['التاريخ', 'النوع', 'الوصف', 'المبلغ', '']}
                empty="لا توجد مصاريف في هذه الفترة."
                rows={expenses.map((e) => [
                  shortDate(e.date),
                  EXPENSE_CATEGORIES[e.category] ?? e.category,
                  e.description || '—',
                  <span key="a" className="tabular-nums">{formatSar(e.amount)}</span>,
                  <button key="d" type="button" onClick={() => void remove(e.id)} className="text-slate-400 hover:text-rose-600" aria-label="حذف">
                    <Trash2 className="h-4 w-4" />
                  </button>,
                ])}
              />
            </div>
            <ul className="space-y-2">
              {byCategory.map(([k, v]) => (
                <li key={k} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-[#1A2421]">
                  <span className="font-bold text-slate-700 dark:text-slate-200">{EXPENSE_CATEGORIES[k] ?? k}</span>
                  <span className="tabular-nums text-slate-900 dark:text-white">{formatSar(v)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Section>
  );
}
