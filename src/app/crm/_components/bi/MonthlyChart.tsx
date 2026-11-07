'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { monthLabel, type MonthRow } from '@/lib/company-bi';

import { Empty } from './ui';

const SERIES = [
  { key: 'revenue', name: 'الإيرادات', color: '#1C2E3A' },
  { key: 'grossProfit', name: 'مجمل الربح', color: '#D9B238' },
  { key: 'expenses', name: 'المصاريف', color: '#94A3B8' },
  { key: 'netProfit', name: 'صافي الربح', color: '#059669' },
] as const;

export function MonthlyChart({ rows }: { rows: MonthRow[] }) {
  const data = rows.map((r) => ({ ...r, label: monthLabel(r.month).replace(/\s\d{4}$/, '') }));
  if (!rows.some((r) => r.revenue || r.expenses || r.grossProfit)) {
    return <Empty text="لا توجد حركة مالية مؤكدة في آخر 12 شهراً بعد." />;
  }
  return (
    <div className="h-[300px] w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 11 }} width={56} tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
          <Tooltip formatter={(v) => `${Math.round(Number(v)).toLocaleString('en-US')} ر.س`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {SERIES.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
