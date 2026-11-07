'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { getClientAccessToken } from '@/lib/crm-session-token';
import { PERIOD_LABEL, type CompanyFacts, type CountRow, type PeriodKey } from '@/lib/company-bi';

export const CARD =
  'min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-[#2D3F3A] dark:bg-[#22302C]';

export function useCompanyFacts() {
  const [facts, setFacts] = useState<CompanyFacts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const token = await getClientAccessToken();
      const res = await fetch('/api/crm/company-bi', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
      const json = (await res.json()) as { ok?: boolean; facts?: CompanyFacts; error?: string };
      if (!json.ok || !json.facts) {
        setError(json.error === 'forbidden' ? 'هذه الصفحة تحتاج صلاحية «المدفوعات والمالية».' : 'تعذّر تحميل البيانات.');
      } else {
        setFacts(json.facts);
        setError(null);
      }
    } catch {
      setError('تعذّر تحميل البيانات.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const reload = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  return { facts, error, loading, reload };
}

export function PageHeader({
  kicker,
  title,
  sub,
  period,
  onPeriod,
  onReload,
  loading,
  extra,
}: {
  kicker: string;
  title: string;
  sub: string;
  period: PeriodKey;
  onPeriod: (p: PeriodKey) => void;
  onReload: () => void;
  loading: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400 dark:text-[#D4AF37]/80">{kicker}</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">{sub}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {extra}
        <label className="sr-only" htmlFor="bi-period">
          الفترة
        </label>
        <select
          id="bi-period"
          value={period}
          onChange={(e) => onPeriod(e.target.value as PeriodKey)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-white"
        >
          {(Object.keys(PERIOD_LABEL) as PeriodKey[]).map((k) => (
            <option key={k} value={k}>
              {PERIOD_LABEL[k]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onReload}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-slate-200"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden /> تحديث
        </button>
      </div>
    </div>
  );
}

export function Kpi({
  label,
  value,
  sub,
  tone = 'slate',
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'slate' | 'emerald' | 'amber' | 'gold' | 'rose';
  icon?: ReactNode;
}) {
  const color = {
    slate: 'text-slate-900 dark:text-white',
    emerald: 'text-emerald-700 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    gold: 'text-[#B8921E] dark:text-[#D4AF37]',
    rose: 'text-rose-600 dark:text-rose-400',
  }[tone];
  return (
    <div className={`${CARD} flex flex-col gap-2`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        {icon ? <span className="text-slate-400 dark:text-[#D4AF37]/80">{icon}</span> : null}
      </div>
      <p className={`text-xl font-bold tabular-nums tracking-tight sm:text-2xl ${color}`}>{value}</p>
      {sub ? <p className="text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">{sub}</p> : null}
    </div>
  );
}

export function Section({ title, sub, action, children, className = '' }: { title: string; sub?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`${CARD} ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
          {sub ? <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">{sub}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm font-medium text-slate-400 dark:border-[#2D3F3A]">{text}</p>;
}

/** Horizontal bars — readable on phones and in RTL without a chart library. */
export function BarList({ rows, format = (n: number) => n.toLocaleString('en-US'), empty = 'لا توجد بيانات بعد.' }: { rows: Array<CountRow & { sub?: string }>; format?: (n: number) => string; empty?: string }) {
  if (!rows.length) return <Empty text={empty} />;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-bold text-slate-700 dark:text-slate-200">{r.label}</span>
            <span className="shrink-0 font-bold tabular-nums text-slate-900 dark:text-white">
              {format(r.count)}
              {r.sub ? <span className="ms-1.5 font-medium text-slate-400">{r.sub}</span> : null}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-[#1A2421]">
            <div className="h-2 rounded-full bg-gradient-to-l from-[#9C7A3C] to-[#D9B238]" style={{ width: `${Math.max(4, Math.round((r.count / max) * 100))}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Table({ head, rows, empty, compact = false }: { head: string[]; rows: ReactNode[][]; empty: string; compact?: boolean }) {
  if (!rows.length) return <Empty text={empty} />;
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
      <table className={`w-full text-right text-sm ${compact ? '' : 'min-w-[560px]'}`}>
        <thead>
          <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-[#2D3F3A] dark:text-slate-400">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-2 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-[#2D3F3A]/60">
              {cells.map((c, j) => (
                <td key={j} className="whitespace-nowrap px-2 py-2.5 font-medium text-slate-700 dark:text-slate-200">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RowLink({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <Link href={href} className="font-bold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:text-[#B8921E] dark:text-white dark:decoration-slate-600 dark:hover:text-[#D4AF37]">
      {children}
    </Link>
  );
}

export function LoadingState() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-[#22302C]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-[#22302C]" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-slate-100 dark:bg-[#22302C]" />
    </div>
  );
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ar-SA-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' });
}
