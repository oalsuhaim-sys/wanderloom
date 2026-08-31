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
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500 ring-1 ring-slate-100">
          {icon}
        </span>
      </div>
      <p className="text-2xl font-semibold text-slate-900" dir="ltr">
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function computeGroupDashboardMetrics(trips: GroupTripRow[]) {
  let activeGroups = 0;
  let bookedSeats = 0;
  let expectedRevenue = 0;

  for (const trip of trips) {
    const fromRegistered = Array.isArray(trip.registered_client_ids)
      ? trip.registered_client_ids.length
      : 0;
    const fromBooked = Number(trip.booked_seats);
    const booked = Number.isFinite(fromBooked)
      ? Math.max(fromBooked, fromRegistered)
      : fromRegistered;
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
    <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
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
