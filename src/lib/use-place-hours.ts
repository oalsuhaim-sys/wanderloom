'use client';

import { useEffect, useMemo, useState } from 'react';

import { parseStoredHours, type StoredPlaceHours } from '@/lib/place-hours';

export type PlaceHoursRequestItem = { key: string; bankId?: string | null; name?: string | null; city?: string | null };

const cache = new Map<string, Record<string, StoredPlaceHours>>();

async function request(items: PlaceHoursRequestItem[]): Promise<{ hours: Record<string, StoredPlaceHours>; pending: number }> {
  const res = await fetch('/api/place-hours', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  const json = (await res.json().catch(() => null)) as { hours?: Record<string, unknown>; pending?: number } | null;
  const hours: Record<string, StoredPlaceHours> = {};
  for (const [k, v] of Object.entries(json?.hours ?? {})) {
    const h = parseStoredHours(v);
    if (h) hours[k] = h;
  }
  return { hours, pending: Number(json?.pending ?? 0) };
}

/** Opening hours for a list of stops, keyed by the item key. Empty until loaded / when unavailable. */
export function usePlaceHours(items: PlaceHoursRequestItem[]): Record<string, StoredPlaceHours> {
  const signature = useMemo(
    () => JSON.stringify(items.filter((i) => i.bankId || i.name).map((i) => [i.key, i.bankId ?? '', i.name ?? '', i.city ?? ''])),
    [items],
  );
  const [hours, setHours] = useState<Record<string, StoredPlaceHours>>(() => cache.get(signature) ?? {});

  useEffect(() => {
    const list = (JSON.parse(signature) as string[][]).map(([key, bankId, name, city]) => ({ key: key!, bankId, name, city }));
    if (!list.length) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const cached = cache.get(signature);
    if (cached) {
      queueMicrotask(() => {
        if (!cancelled) setHours(cached);
      });
      return () => {
        cancelled = true;
      };
    }
    const load = async (again: boolean) => {
      try {
        const { hours: h, pending } = await request(list);
        if (cancelled) return;
        setHours(h);
        if (pending > 0 && again) retry = setTimeout(() => void load(false), 8000);
        else cache.set(signature, h);
      } catch {
        /* hours are optional — never break the page */
      }
    };
    void load(true);
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [signature]);

  return hours;
}
