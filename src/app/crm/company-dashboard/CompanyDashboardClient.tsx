'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Info } from 'lucide-react';

import {
  countBy,
  dataAlerts,
  dealsInPeriod,
  destinationRows,
  expertRows,
  financeSummary,
  formatPct,
  formatSar,
  inPeriod,
  monthlyRows,
  pct,
  periodRange,
  sum,
  topClients,
  type PeriodKey,
} from '@/lib/company-bi';
import { LEAD_STATUS_LABEL_AR, LEAD_STATUS_PIPELINE_ORDER, type LeadStatus } from '@/lib/lead-status';
import { translateLeadData } from '@/lib/lead-data-localization';

import { MonthlyChart } from '../_components/bi/MonthlyChart';
import { BarList, CARD, Kpi, LoadingState, PageHeader, Section, Table, shortDate, useCompanyFacts } from '../_components/bi/ui';

const LEAD_STAGE_EXTRA: Record<string, string> = { meeting_scheduled: 'اجتماع مجدول' };

function leadStatusLabel(s: string): string {
  return LEAD_STATUS_LABEL_AR[s as LeadStatus] ?? LEAD_STAGE_EXTRA[s] ?? s;
}

export default function CompanyDashboardClient() {
  const { facts, error, loading, reload } = useCompanyFacts();
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [destination, setDestination] = useState('الكل');
  const range = useMemo(() => periodRange(period), [period]);

  const view = useMemo(() => {
    if (!facts) return null;
    // Destination filter applies to money + requests (like «اختر الوجهة» in the Excel dashboard).
    const scoped =
      destination === 'الكل'
        ? facts
        : {
            ...facts,
            deals: facts.deals.filter((d) => d.destination === destination),
            quotes: facts.quotes.filter((q) => q.destination === destination),
            leads: facts.leads.filter((l) => l.destinations.includes(destination)),
          };
    const summary = financeSummary(scoped, range);
    const deals = dealsInPeriod(scoped, range).filter((d) => !d.profitOnly && d.collected > 0);
    const dests = destinationRows(facts, range);
    const leads = scoped.leads.filter((l) => inPeriod(l.createdAt, range));
    const clientsNew = facts.clients.filter((c) => inPeriod(c.createdAt, range));
    const payerCounts = new Map<string, number>();
    for (const d of dealsInPeriod(facts, { from: null, to: null })) {
      if (d.profitOnly || d.collected <= 0) continue;
      const k = d.clientId || d.client;
      payerCounts.set(k, (payerCounts.get(k) ?? 0) + 1);
    }
    const topDest = [...dests].filter((d) => d.margin != null && d.revenue > 0).sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0))[0];
    const maxShare = Math.max(0, ...dests.map((d) => d.share ?? 0));
    return {
      summary,
      deals,
      dests,
      leads,
      clientsNew,
      repeatPayers: [...payerCounts.values()].filter((n) => n > 1).length,
      payers: payerCounts.size,
      topDest,
      maxShare,
      months: monthlyRows(scoped, 12),
      experts: expertRows(scoped, range),
      clientsTop: topClients(scoped, range),
      alerts: dataAlerts(facts),
    };
  }, [facts, range, destination]);

  const destinationOptions = useMemo(() => {
    if (!facts) return [];
    const set = new Set<string>();
    for (const d of facts.deals) if (d.destination && d.destination !== 'غير محدد' && d.destination !== 'الجلسات') set.add(d.destination);
    for (const q of facts.quotes) if (q.destination !== 'غير محدد') set.add(q.destination);
    for (const l of facts.leads) for (const d of l.destinations) set.add(d);
    return [...set].sort((a, b) => a.localeCompare(b, 'ar'));
  }, [facts]);

  if (loading && !facts) return <Shell><LoadingState /></Shell>;
  if (error || !facts || !view) {
    return (
      <Shell>
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error ?? 'تعذّر تحميل البيانات.'}</p>
      </Shell>
    );
  }

  const { summary } = view;
  const bookings = view.deals.length;
  const tailorInRange = facts.tailor.filter((t) => inPeriod(t.createdAt, range));
  const tailorPaid = tailorInRange.filter((t) => t.paid);
  const upcomingSessions = facts.sessions.filter((s) => s.date && s.date >= new Date().toISOString().slice(0, 10));

  return (
    <Shell>
      <PageHeader
        kicker="Company Dashboard"
        title="لوحة الشركة"
        sub="كل شيء عن واندرلوم في مكان واحد: المبيعات والأرباح، الوجهات، الطلبات، العملاء، القروبات، الجلسات، و«فصّل الآن» — لتتخذ قرارك من الأرقام."
        period={period}
        onPeriod={setPeriod}
        onReload={reload}
        loading={loading}
        extra={
          <>
            <label className="sr-only" htmlFor="bi-dest">
              الوجهة
            </label>
            <select
              id="bi-dest"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="h-10 max-w-[11rem] rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-white"
            >
              <option value="الكل">كل الوجهات</option>
              {destinationOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <Link href="/crm/financial-reports" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1C2E3A] px-3 text-sm font-bold text-white dark:bg-[#D4AF37] dark:text-[#1A2421]">
              التقارير المالية <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
          </>
        }
      />

      {/* headline KPIs — same set as the Excel dashboard */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="المؤشرات الرئيسية">
        <Kpi label="إجمالي المبيعات" value={formatSar(summary.revenue)} sub="مبالغ معتمدة" tone="gold" />
        <Kpi label="إجمالي الأرباح" value={formatSar(summary.grossProfit)} sub={`صافي بعد المصاريف ${formatSar(summary.netProfit)}`} tone="emerald" />
        <Kpi label="عدد الحجوزات" value={String(bookings)} sub={`${summary.paidClients} عميل دفع`} />
        <Kpi label="هامش الربح" value={formatPct(summary.grossMargin)} sub={`الصافي ${formatPct(summary.netMargin)}`} />
        <Kpi label="متوسط قيمة الحجز" value={formatSar(bookings ? summary.revenue / bookings : null)} />
        <Kpi label="متوسط ربح الحجز" value={formatSar(bookings ? sum(view.deals, (d) => d.profit) / bookings : null)} />
        <Kpi label="الوجهة الأعلى في الهامش" value={view.topDest?.destination ?? '—'} sub={view.topDest ? `هامش ${formatPct(view.topDest.margin)} · ربح ${formatSar(view.topDest.profit)}` : 'لا توجد بيانات كافية'} />
        <Kpi
          label="تركّز الأرباح"
          value={formatPct(view.maxShare || null)}
          sub="حصة أعلى وجهة من الأرباح — أكثر من 60% يعني اعتماداً على وجهة واحدة"
          tone={view.maxShare > 60 ? 'amber' : 'slate'}
        />
      </section>

      {view.alerts.length ? (
        <Section title="تنبيهات تحتاج انتباهك" sub="فحوص جودة البيانات والمتابعة">
          <ul className="grid gap-2 md:grid-cols-2">
            {view.alerts.map((a, i) => (
              <li key={i} className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-medium ${a.level === 'warn' ? 'bg-amber-50 text-amber-900 dark:bg-amber-900/15 dark:text-amber-300' : 'bg-slate-50 text-slate-700 dark:bg-[#1A2421] dark:text-slate-300'}`}>
                {a.level === 'warn' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
                {a.text}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="الأداء الشهري" sub="آخر 12 شهراً">
        <MonthlyChart rows={view.months} />
      </Section>

      <Section title="أداء الوجهات" sub="المبيعات والأرباح والهامش وعدد الحجوزات لكل وجهة، مع الطلبات الواردة عليها">
        <Table
          head={['الوجهة', 'المبيعات', 'التكلفة', 'الأرباح', 'الهامش', 'الحجوزات', 'متوسط الربح', 'من الأرباح', 'طلبات']}
          empty="لا توجد مبيعات مؤكدة بعد."
          rows={view.dests.map((d) => [
            <button key="d" type="button" onClick={() => setDestination(d.destination)} className="font-bold text-slate-900 underline decoration-slate-300 underline-offset-4 dark:text-white">
              {d.destination}
            </button>,
            formatSar(d.revenue),
            formatSar(d.cost),
            <span key="p" className="font-bold text-emerald-700 dark:text-emerald-400">{formatSar(d.profit)}</span>,
            formatPct(d.margin),
            d.deals,
            formatSar(d.avgProfit),
            formatPct(d.share),
            d.leads,
          ])}
        />
      </Section>

      {/* requests */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <Section title="الطلبات حسب المرحلة" sub={`${view.leads.length} طلب في الفترة`}>
          <BarList
            rows={[...LEAD_STATUS_PIPELINE_ORDER, 'meeting_scheduled', 'postponed', 'radar_rejected', 'converted', 'interest_only']
              .map((s) => ({ label: leadStatusLabel(s), count: view.leads.filter((l) => l.status === s).length }))
              .filter((r) => r.count > 0)}
            empty="لا توجد طلبات في الفترة."
          />
        </Section>
        <Section title="من أين يأتي العملاء" sub="مصدر الطلب">
          <BarList rows={countBy(view.leads, (l) => translateLeadData(l.source), 8)} empty="لا توجد طلبات في الفترة." />
        </Section>
        <Section title="الوجهات الأكثر طلباً" sub="من نماذج الموقع">
          <BarList rows={countBy(view.leads, (l) => (l.destinations.length ? l.destinations : ['غير محدد']), 8)} empty="لا توجد طلبات في الفترة." />
        </Section>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="طلبات في الفترة" value={String(view.leads.length)} sub={countBy(view.leads, (l) => translateLeadData(l.formType), 3).map((r) => `${r.label} ${r.count}`).join(' · ') || '—'} />
        <Kpi label="نسبة التحويل" value={formatPct(pct(bookings, view.leads.length))} sub="حجوزات مدفوعة ÷ طلبات" />
        <Kpi label="عملاء جدد" value={String(view.clientsNew.length)} sub={`إجمالي قاعدة العملاء ${facts.clients.length}`} />
        <Kpi label="عملاء عادوا للشراء" value={String(view.repeatPayers)} sub={`من ${view.payers} عميل دفع (كل الفترات)`} tone="gold" />
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <Section title="أفضل العملاء" sub="حسب المبالغ المدفوعة في الفترة" className="lg:col-span-2">
          <Table
            head={['العميل', 'الحجوزات', 'المدفوع', 'الربح']}
            empty="لا توجد مدفوعات في الفترة."
            rows={view.clientsTop.map((c) => [c.client, c.deals, formatSar(c.revenue), formatSar(c.profit)])}
          />
        </Section>
        <Section title="العملاء حسب المدينة" sub="قاعدة العملاء كاملة">
          <BarList rows={countBy(facts.clients, (c) => c.city, 8)} />
        </Section>
      </div>

      {/* groups */}
      <Section title="القروبات السياحية" sub="المقاعد والإشغال والإيرادات المؤكدة">
        <Table
          head={['القروب', 'الحالة', 'المقاعد', 'المسجّلون', 'دفعوا', 'الإشغال', 'سعر المقعد', 'إيراد مؤكد', 'إيراد متوقع عند الامتلاء', 'القائد']}
          empty="لا توجد قروبات."
          rows={facts.groups.map((g) => [
            <span key="t" className="block max-w-[16rem] truncate font-bold">{g.title}</span>,
            g.active ? <span key="a" className="text-emerald-700">نشط</span> : <span key="a" className="text-slate-400">متوقف</span>,
            g.maxSeats || '—',
            g.members,
            g.paidMembers,
            formatPct(pct(g.members, g.maxSeats)),
            g.pricePerSeat ? formatSar(g.pricePerSeat) : '—',
            formatSar(g.paidMembers * g.pricePerSeat),
            g.pricePerSeat && g.maxSeats ? formatSar(g.maxSeats * g.pricePerSeat) : '—',
            g.leader || '—',
          ])}
        />
        {facts.groupPlans.length ? (
          <div className="mt-5">
            <p className="mb-2 text-xs font-bold text-slate-500">خطط التسعير المحفوظة في «حاسبة تسعير القروب» (متوقعة، ليست مبيعات)</p>
            <Table
              head={['الخطة', 'المسافرون', 'الإيراد المتوقع', 'الربح المتوقع', 'الهامش', 'التاريخ']}
              empty=""
              rows={facts.groupPlans.map((p) => [p.title, p.passengers, formatSar(p.revenue), formatSar(p.profit), formatPct(pct(p.profit, p.revenue)), shortDate(p.createdAt)])}
            />
          </div>
        ) : null}
      </Section>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Section title="الجلسات" sub={`${upcomingSessions.length} جلسة قادمة`}>
          <Table
            head={['الجلسة', 'التاريخ', 'المسجّلون', 'المقاعد', 'الامتلاء', 'الإيراد']}
            empty="لا توجد جلسات."
            rows={[...facts.sessions]
              .sort((a, b) => String(b.date).localeCompare(String(a.date)))
              .map((s) => [
                <span key="t" className="block max-w-[12rem] truncate">{s.title}</span>,
                shortDate(s.date),
                s.registrations,
                s.spots || '—',
                formatPct(pct(s.registrations, s.spots)),
                s.price ? formatSar(s.price * s.registrations) : 'مجانية',
              ])}
          />
        </Section>
        <Section title="فصّل الآن" sub="الخطط الفورية في الفترة">
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="خطط أُنشئت" value={String(tailorInRange.length)} />
            <MiniStat label="خطط مدفوعة" value={String(tailorPaid.length)} sub={formatPct(pct(tailorPaid.length, tailorInRange.length))} />
            <MiniStat label="إيراد" value={formatSar(sum(tailorPaid, (t) => t.total))} />
            <MiniStat label="تكلفة Claude" value={formatSar(sum(tailorInRange, (t) => t.aiCostSar))} sub="كل الخطط، مدفوعة وغير مدفوعة" />
          </div>
          <div className="mt-4">
            <BarList rows={countBy(tailorInRange, (t) => t.country, 6)} empty="لا توجد خطط في الفترة." />
          </div>
        </Section>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <Section title="أداء الخبراء" sub="مبيعات وأرباح العروض المدفوعة" className="lg:col-span-1">
          <Table compact head={['الخبير', 'حجوزات', 'المبيعات', 'الربح']} empty="لا توجد بيانات." rows={view.experts.map((e) => [e.expert, e.deals, formatSar(e.revenue), formatSar(e.profit)])} />
          {facts.itineraries.byExpert.length ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-bold text-slate-500">المسارات المصممة لكل خبير</p>
              <BarList rows={facts.itineraries.byExpert} />
            </div>
          ) : null}
        </Section>
        <Section title="المسارات" sub={`إجمالي الرحلات المصممة: ${facts.itineraries.total}`}>
          <p className="mb-2 text-xs font-bold text-slate-500">أكثر الدول طلباً</p>
          <BarList rows={facts.itineraries.topCountries} />
        </Section>
        <Section title="أكثر الفنادق اختياراً" sub="من أيام المسارات">
          <BarList rows={facts.itineraries.topHotels} />
        </Section>
      </div>

      <div className={`${CARD} text-[11px] leading-relaxed text-slate-400`}>
        آخر تحديث {shortDate(facts.generatedAt)}. المبيعات = مبالغ معتمدة فقط؛ إذا دفع العميل جزءاً تُحتسب التكلفة والربح بنفس النسبة. فلتر الوجهة يطبَّق على المبيعات والطلبات. الصفحات السابقة (الإحصائيات، الذكاء المالي،
        التقارير) ما زالت تعمل من روابطها: <Link className="underline" href="/crm/analytics">الإحصائيات</Link> · <Link className="underline" href="/crm/finance">الذكاء المالي</Link> ·{' '}
        <Link className="underline" href="/crm/reports">التقارير</Link>.
      </div>
    </Shell>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-[#1A2421]">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
      {sub ? <p className="text-[11px] text-slate-400">{sub}</p> : null}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="mx-auto w-full max-w-[min(100%,88rem)] space-y-5 px-4 pb-12 sm:px-6">
      {children}
    </div>
  );
}
