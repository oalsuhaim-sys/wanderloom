'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, MessageCircleHeart } from 'lucide-react';

import { getClientAccessToken } from '@/lib/crm-session-token';
import {
  FOLLOWUP_UPDATED_EVENT,
  canonicalFollowupClientId,
  followupIdsLooselyMatch,
  followupNamesMatch,
  formatFollowupDateTime,
  readWanderloomFollowups,
  type ClientFollowup,
} from '@/lib/client-followups';

type Props = {
  clientId?: string;
  clientName?: string | null;
  refreshKey?: number;
};

export default function ClientFollowupsLog({ clientId = '', clientName = '', refreshKey = 0 }: Props) {
  const params = useParams();
  const routeId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [rows, setRows] = useState<ClientFollowup[]>([]);
  const [loading, setLoading] = useState(true);

  const unifiedClientId = canonicalFollowupClientId(routeId ?? clientId);

  const fetchFollowups = useCallback(async (input?: { silent?: boolean } | Event) => {
    const silent = Boolean(input && typeof input === 'object' && 'silent' in input && input.silent);
    if (!unifiedClientId) {
      setRows([]);
      setLoading(false);
      return;
    }
    const localRows = readWanderloomFollowups(unifiedClientId, clientName);
    if (!silent) setLoading(true);
    try {
      const token = await getClientAccessToken().catch(() => '');
      const res = await fetch(
        `/api/admin/followups?clientId=${encodeURIComponent(unifiedClientId)}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: 'no-store',
        },
      );
      const json = (await res.json().catch(() => ({}))) as { followups?: ClientFollowup[] };
      const remote = (Array.isArray(json.followups) ? json.followups : []).filter(
        (row) =>
          followupIdsLooselyMatch(row.clientId, unifiedClientId) ||
          followupNamesMatch(row.clientName, clientName),
      );
      if (remote.length === 0) {
        setRows(localRows);
        return;
      }
      const merged = [...localRows, ...remote].filter(
        (row, index, list) => list.findIndex((item) => item.id === row.id) === index,
      );
      merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      setRows(merged);
    } catch {
      setRows(localRows);
    } finally {
      setLoading(false);
    }
  }, [clientName, unifiedClientId]);

  useEffect(() => {
    void fetchFollowups();
  }, [fetchFollowups, refreshKey]);

  useEffect(() => {
    const onRefresh = () => {
      void fetchFollowups({ silent: true });
    };
    const onFollowupUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ clientId?: string }>).detail;
      if (detail?.clientId && !followupIdsLooselyMatch(detail.clientId, unifiedClientId)) return;
      onRefresh();
    };
    window.addEventListener('refresh-followups', onRefresh);
    window.addEventListener('storage', onRefresh);
    window.addEventListener(FOLLOWUP_UPDATED_EVENT, onFollowupUpdated);
    return () => {
      window.removeEventListener('refresh-followups', onRefresh);
      window.removeEventListener('storage', onRefresh);
      window.removeEventListener(FOLLOWUP_UPDATED_EVENT, onFollowupUpdated);
    };
  }, [fetchFollowups]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:!bg-[#22302C]">
      <div className="mb-4">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-gray-100">
          <MessageCircleHeart className="h-5 w-5 text-emerald-600" aria-hidden />
          سجل متابعات الرحلة
        </h2>
        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          تواصل الفريق أثناء الرحلة النشطة — الأحدث أولاً.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span className="text-sm font-medium">جاري التحميل…</span>
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400 dark:border-[#2D3F3A]">
          لا توجد متابعات مسجّلة بعد لهذا العميل.
        </p>
      ) : (
        <ol className="relative space-y-3 border-r-2 border-emerald-100 pr-4 dark:border-emerald-900/40">
          {rows.map((row) => (
            <li key={row.id} className="relative">
              <span className="absolute top-1.5 -right-[1.35rem] h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-[#22302C]" />
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-[#2D3F3A] dark:bg-[#1A2421]/70">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-800 dark:text-gray-100">
                    {row.agentName}
                  </span>
                  <time className="text-[11px] font-bold text-slate-400" dateTime={row.createdAt}>
                    {formatFollowupDateTime(row.createdAt)}
                  </time>
                </div>
                <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-300">
                  {row.notes || '—'}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
