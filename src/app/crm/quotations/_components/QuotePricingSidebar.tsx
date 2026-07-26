'use client';

import { Building2, Bus, Plane, Ticket } from 'lucide-react';

import { formatInvoiceAmount } from '@/lib/crm-invoices';

type QuotePricingSidebarProps = {
  flightsTotal: number;
  hotelsTotal: number;
  activitiesTotal: number;
  transportsTotal: number;
  baseCost: number;
  marginProfit: number;
  serviceFee: number;
  grandTotal: number;
  className?: string;
};

function LineItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  if (value <= 0) return null;
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="flex items-center gap-1.5 font-semibold text-white/65">
        {icon}
        {label}
      </span>
      <span className="font-black text-white/90" dir="ltr">
        {formatInvoiceAmount(value)}
      </span>
    </div>
  );
}

export function QuotePricingSidebar({
  flightsTotal,
  hotelsTotal,
  activitiesTotal,
  transportsTotal,
  baseCost,
  marginProfit,
  serviceFee,
  grandTotal,
  className = '',
}: QuotePricingSidebarProps) {
  return (
    <aside
      className={`rounded-2xl border border-[#C9A84C]/35 bg-gradient-to-br from-[#1C4532] via-[#163528] to-[#0f241c] p-5 text-white shadow-lg shadow-[#1C4532]/20 ${className}`}
      aria-label="ملخص التسعير"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#C9A84C]/75">
        Live Pricing
      </p>
      <h2 className="mt-1 text-sm font-black text-white">ملخص التكلفة</h2>
      <p className="mt-1 text-[10px] font-semibold text-white/45">يتحدّث فوراً مع كل صف</p>

      <div className="mt-4 space-y-2.5 border-b border-white/10 pb-4">
        <LineItem
          icon={<Plane className="h-3.5 w-3.5 text-[#C9A84C]" aria-hidden />}
          label="الطيران"
          value={flightsTotal}
        />
        <LineItem
          icon={<Building2 className="h-3.5 w-3.5 text-[#C9A84C]" aria-hidden />}
          label="الفنادق"
          value={hotelsTotal}
        />
        <LineItem
          icon={<Ticket className="h-3.5 w-3.5 text-[#C9A84C]" aria-hidden />}
          label="الفعاليات"
          value={activitiesTotal}
        />
        <LineItem
          icon={<Bus className="h-3.5 w-3.5 text-[#C9A84C]" aria-hidden />}
          label="المواصلات"
          value={transportsTotal}
        />
      </div>

      <div className="mt-4 space-y-2 text-xs">
        <div className="flex justify-between gap-2 font-semibold text-white/60">
          <span>التكلفة الأساسية</span>
          <span dir="ltr">{formatInvoiceAmount(baseCost)}</span>
        </div>
        {marginProfit > 0 ? (
          <div className="flex justify-between gap-2 font-semibold text-emerald-200/80">
            <span>هامش الربح</span>
            <span dir="ltr">{formatInvoiceAmount(marginProfit)}</span>
          </div>
        ) : null}
        {serviceFee > 0 ? (
          <div className="flex justify-between gap-2 font-semibold text-white/60">
            <span>رسوم الخدمة</span>
            <span dir="ltr">{formatInvoiceAmount(serviceFee)}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-5 rounded-xl border border-[#C9A84C]/30 bg-[#C9A84C]/10 px-4 py-4 text-center">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#C9A84C]/80">
          الإجمالي للعميل
        </p>
        <p className="mt-1 text-2xl font-black text-[#C9A84C]" dir="ltr">
          {formatInvoiceAmount(grandTotal)}
        </p>
      </div>
    </aside>
  );
}
