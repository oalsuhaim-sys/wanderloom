'use client';

import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const PIE_COLORS = ['#1C4532', '#C9A84C', '#2D6A4F', '#40916C', '#95D5B2', '#6B7280', '#92400E', '#1E3A5F'];

export type PieDatum = { name: string; value: number };
export type LineDatum = { month: string; confirmed: number };

export function CrmDashboardCharts({
  pieData,
  lineData,
}: {
  pieData: PieDatum[];
  lineData: LineDatum[];
}) {
  const pieSafe = pieData.length ? pieData : [{ name: 'لا بيانات', value: 1 }];
  const lineSafe = lineData.length
    ? lineData
    : [{ month: '—', confirmed: 0 }];

  return (
    <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div className="rounded-2xl border border-[#E8E4DC] bg-white p-6 shadow-[0_8px_28px_rgba(20,34,28,0.07)]">
        <h2 className="mb-1 text-lg font-black text-[#1C4532]">توزيع حالات الرحلات</h2>
        <p className="mb-4 text-xs font-bold text-gray-500">استثناء القوالب (template)</p>
        <div className="h-[320px] w-full min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieSafe}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={56}
                outerRadius={100}
                paddingAngle={2}
              >
                {pieSafe.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [Number(value ?? 0), 'عدد']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E8E4DC] bg-white p-6 shadow-[0_8px_28px_rgba(20,34,28,0.07)]">
        <h2 className="mb-1 text-lg font-black text-[#1C4532]">نمو الرحلات المؤكدة</h2>
        <p className="mb-4 text-xs font-bold text-gray-500">حسب شهر الإنشاء (آخر 12 شهراً)</p>
        <div className="h-[320px] w-full min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineSafe} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [Number(value ?? 0), 'رحلات']} />
              <Legend />
              <Line
                type="monotone"
                dataKey="confirmed"
                name="مؤكدة"
                stroke="#1C4532"
                strokeWidth={2.5}
                dot={{ fill: '#C9A84C', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
