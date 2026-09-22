'use client';

import { useCallback } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';

import { syncLegacyGroupMemberDnaAction } from '@/app/actions/clientDirectoryActions';
import { runGroupMembersClientSyncOnce } from '@/app/crm/clients/useClients';
import type { VipClientProfile } from '@/lib/clientsTravelDna';
import { getClientAccessToken } from '@/lib/crm-session-token';

export const CLIENT_DIRECTORY_SWR_KEY = '/api/admin/clients';

export type ClientDirectoryPayload = {
  rows: VipClientProfile[];
  tripCounts: Record<string, number>;
  profitTotals: Record<string, number>;
};

function uniqueClientsById(rows: VipClientProfile[]): VipClientProfile[] {
  const seen = new Set<string>();
  const out: VipClientProfile[] = [];
  for (const row of rows) {
    const id = String(row.id ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

function buildStatsFromRows(rows: VipClientProfile[]): Pick<
  ClientDirectoryPayload,
  'tripCounts' | 'profitTotals'
> {
  const tripCounts: Record<string, number> = {};
  const profitTotals: Record<string, number> = {};
  for (const row of rows) {
    const id = String(row.id ?? '').trim();
    if (!id) continue;
    tripCounts[id] = Math.max(0, Math.floor(Number(row.total_trips) || 0));
    profitTotals[id] = Number(row.total_profit ?? row.lifetime_value ?? 0) || 0;
  }
  return { tripCounts, profitTotals };
}

type ApiOk = { ok: true } & ClientDirectoryPayload;
type ApiErr = { ok: false; error?: string };

/** Cached HTTP fetcher — browser/CDN honor Cache-Control from the API. */
export async function fetchClientDirectoryPayload(): Promise<ClientDirectoryPayload> {
  // One-time repairs — non-blocking for perceived speed
  void runGroupMembersClientSyncOnce().catch((err) => {
    console.warn('[client-directory] group_members sync:', err);
  });

  const token = await getClientAccessToken();
  void syncLegacyGroupMemberDnaAction(token).catch((err) => {
    console.warn('[client-directory] legacy DNA backfill:', err);
  });

  const res = await fetch(CLIENT_DIRECTORY_SWR_KEY, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    // Prefer fresh-enough cached responses when available
    cache: 'default',
  });

  const body = (await res.json()) as ApiOk | ApiErr;
  if (!res.ok || !body || body.ok === false) {
    throw new Error(
      (body && 'error' in body && body.error) || 'تعذر تحميل قاعدة العملاء.',
    );
  }

  const rows = uniqueClientsById(body.rows ?? []);
  const stats =
    body.tripCounts && body.profitTotals
      ? { tripCounts: body.tripCounts, profitTotals: body.profitTotals }
      : buildStatsFromRows(rows);

  return { rows, ...stats };
}

type UseClientDirectoryOptions = {
  /** Server-prefetched payload for instant first paint */
  fallbackData?: ClientDirectoryPayload | null;
};

export function useClientDirectory(options: UseClientDirectoryOptions = {}) {
  const fallbackData = options.fallbackData ?? undefined;

  const { data, error, isLoading, isValidating, mutate } = useSWR<ClientDirectoryPayload>(
    CLIENT_DIRECTORY_SWR_KEY,
    fetchClientDirectoryPayload,
    {
      fallbackData,
      revalidateOnFocus: false,
      // Soft refresh in background; never block paint when fallback/cache exists
      revalidateOnMount: true,
      keepPreviousData: true,
      dedupingInterval: 8_000,
    },
  );

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const hasRows = Boolean((data ?? fallbackData)?.rows?.length);
  const showSkeleton = Boolean(!hasRows && isLoading && !fallbackData);

  return {
    clients: data?.rows ?? fallbackData?.rows ?? [],
    tripCounts: data?.tripCounts ?? fallbackData?.tripCounts ?? {},
    profitTotals: data?.profitTotals ?? fallbackData?.profitTotals ?? {},
    error: error instanceof Error ? error.message : error ? String(error) : '',
    /** Skeleton only — never block the whole chrome with a spinner */
    showSkeleton,
    isValidating,
    mutate,
    refresh,
  };
}

/** Invalidate / refresh directory from anywhere (after delete, accept lead, etc.). */
export function revalidateClientDirectory() {
  return globalMutate(CLIENT_DIRECTORY_SWR_KEY);
}
