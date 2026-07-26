'use client';

import { CalendarCheck2, Users, Wallet } from 'lucide-react';

import {
  parseGroupTripPriceNumber,
  resolveGroupSeatStatus,
} from '@/lib/group-trip-card-ui';
import { parseGroupTripStoredDates } from '@/lib/group-trip-dates';
import type { GroupTripRow } from '@/types/group-trip';

type Props = {
  trips: GroupTripRow[];
};

function MetricCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C5A059]">
          {label}
        </p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1A3B2A]/8 text-[#1A3B2A]">
          {icon}
        </span>
      </div>
      <p className="text-2xl font-black text-[#1A3B2A]" dir="ltr">
        {value}
      </p>
      {sub ? <p className="mt-1 text-[11px] font-semibold text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function computeGroupDashboardMetrics(trips: GroupTripRow[]) {
  let activeGroups = 0;
  let bookedSeats = 0;
  let expectedRevenue = 0;

  for (const trip of trips) {
    const booked = Array.isArray(trip.registered_client_ids)
      ? trip.registered_client_ids.length
      : 0;
    const capacity = Math.max(0, Number(trip.max_seats) || 0);
    const { to: endIso } = parseGroupTripStoredDates(trip.dates_ar, trip.dates_en);
    const status = resolveGroupSeatStatus({
      isActive: trip.is_active !== false,
      booked,
      capacity,
      endIso: endIso || null,
    });

    if (status === 'open' || status === 'full') {
      activeGroups += 1;
    }

    bookedSeats += booked;
    const price = parseGroupTripPriceNumber(trip.price);
    if (price > 0) {
      const seatsForRevenue = capacity > 0 ? capacity : booked;
      expectedRevenue += price * (seatsForRevenue || 0);
    }
  }

  return { activeGroups, bookedSeats, expectedRevenue };
}

export default function GroupTripsMetrics({ trips }: Props) {
  const { activeGroups, bookedSeats, expectedRevenue } =
    computeGroupDashboardMetrics(trips);

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <MetricCard
        label="إجمالي القروبات النشطة"
        value={String(activeGroups)}
        sub={`من أصل ${trips.length} قروب`}
        icon={<CalendarCheck2 className="h-4 w-4" />}
      />
      <MetricCard
        label="إجمالي المقاعد المباعة"
        value={bookedSeats.toLocaleString('ar-SA')}
        sub="من الحجوزات المسجّلة"
        icon={<Users className="h-4 w-4" />}
      />
      <MetricCard
        label="الإيرادات المتوقعة"
        value={
          expectedRevenue > 0
            ? `${expectedRevenue.toLocaleString('en-US')} ر.س`
            : '—'
        }
        sub="السعر × سعة القروب"
        icon={<Wallet className="h-4 w-4" />}
      />
    </div>
  );
}
