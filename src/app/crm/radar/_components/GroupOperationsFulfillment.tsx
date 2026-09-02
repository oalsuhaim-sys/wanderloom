'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

import GroupMembersList from '@/app/crm/groups/_components/GroupMembersList';
import {
  groupFulfillmentClients,
  isPendingGroupJoinStatus,
  RADAR_FULFILLMENT_DONE,
  type GroupFulfillmentBucket,
  type GroupFulfillmentClient,
} from '@/lib/group-operations-radar';
import { RADAR_SECTION_INITIAL_LIMIT, ShowAllToggle } from './ShowAllToggle';

type GroupOperationsFulfillmentProps = {
  clients: GroupFulfillmentClient[];
  error?: string;
  onRefresh: () => void | Promise<void>;
};

function GroupTripCard({
  bucket,
  defaultOpen,
}: {
  bucket: GroupFulfillmentBucket;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [rows, setRows] = useState(bucket.clients);
  const [showAllPassengers, setShowAllPassengers] = useState(false);

  useEffect(() => {
    setRows(bucket.clients);
  }, [bucket.clients]);

  const pendingCount = rows.filter((r) => isPendingGroupJoinStatus(r.status)).length;
  const confirmedCount = rows.filter((r) => r.status === 'confirmed_seat').length;
  const done = rows.filter((r) => r.radar_fulfillment_status === RADAR_FULFILLMENT_DONE).length;

  if (rows.length === 0) return null;

  return (
    <article className="mb-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-3.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-white hover:text-slate-600"
            aria-expanded={open}
            aria-label={open ? 'طي المجموعة' : 'توسيع المجموعة'}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="min-w-0 flex-1 text-right"
          >
            <span className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-extrabold text-slate-900">
                {bucket.target_trip}
              </h3>
              <span className="text-[11px] font-bold text-slate-400">
                ({rows.length.toLocaleString('ar-SA')} أعضاء • {confirmedCount} مؤكد
                {pendingCount > 0 ? ` • ${pendingCount} بانتظار` : ''}
                {done > 0 ? ` • ${done} تم` : ''})
              </span>
            </span>
          </button>
        </div>

        {bucket.group_id ? (
          <Link
            href={`/crm/groups/${encodeURIComponent(bucket.group_id)}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-slate-800"
          >
            <span>📋</span>
            <span>عرض الكشف</span>
          </Link>
        ) : null}
      </div>

      {open ? (
        <GroupMembersList
          members={rows}
          onMembersChange={setRows}
          showAll={showAllPassengers}
          onToggleShowAll={() => setShowAllPassengers((v) => !v)}
        />
      ) : null}
    </article>
  );
}

export default function GroupOperationsFulfillment({
  clients,
  error,
  onRefresh,
}: GroupOperationsFulfillmentProps) {
  const [showAllOperations, setShowAllOperations] = useState(false);
  const buckets = useMemo(() => groupFulfillmentClients(clients), [clients]);
  const allBuckets = buckets.filter((b) => b.clients.length > 0);
  const visibleBuckets = showAllOperations
    ? allBuckets
    : allBuckets.slice(0, RADAR_SECTION_INITIAL_LIMIT);

  return (
    <section
      id="group-operations"
      className="mb-10 scroll-mt-24"
      aria-label="عمليات القروبات وتجهيز الطلبات"
      dir="rtl"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">
          عمليات القروبات وتجهيز الطلبات
        </h2>
        <button
          type="button"
          onClick={() => void onRefresh()}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
        >
          تحديث القائمة
        </button>
      </div>

      {error ? (
        <div className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-right text-xs font-medium text-rose-800">
          {error}
        </div>
      ) : null}

      {allBuckets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center text-sm font-medium text-slate-500 shadow-sm">
          لا توجد طلبات انضمام أو مقاعد في عمليات القروبات حالياً.
          <p className="mt-2 text-xs text-slate-400">
            تظهر هنا الطلبات الجديدة (بانتظار التأكيد) والمقاعد المؤكدة بعد مسار الانضمام أو التعيين من
            ملف العميل.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {visibleBuckets.map((bucket, index) => (
              <GroupTripCard key={bucket.target_trip} bucket={bucket} defaultOpen={index === 0} />
            ))}
          </div>
          <ShowAllToggle
            showAll={showAllOperations}
            total={allBuckets.length}
            onToggle={() => setShowAllOperations((v) => !v)}
          />
        </>
      )}
    </section>
  );
}
