'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

export type PositionRequestItem = { key: string; bankId?: string | null; name?: string | null; city?: string | null };
type LatLng = [number, number];

/** Map positions of bank places for the itinerary editor (same source as the client map). */
export function usePlacePositions(items: PositionRequestItem[]): { positions: Record<string, LatLng>; kakao: boolean; loaded: boolean } {
  const signature = useMemo(
    () => JSON.stringify(items.filter((i) => i.bankId || i.name).map((i) => [i.key, i.bankId ?? '', i.name ?? '', i.city ?? ''])),
    [items],
  );
  const [state, setState] = useState<{ sig: string; positions: Record<string, LatLng>; kakao: boolean }>({ sig: '', positions: {}, kakao: false });

  useEffect(() => {
    const list = (JSON.parse(signature) as string[][]).map(([key, bankId, name, city]) => ({ key: key!, bankId, name, city }));
    if (!list.length) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/itinerary-positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: list }),
        });
        const json = (await res.json().catch(() => null)) as { positions?: Record<string, LatLng>; kakao?: boolean } | null;
        if (!cancelled) setState({ sig: signature, positions: json?.positions ?? {}, kakao: Boolean(json?.kakao) });
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signature]);

  return { positions: state.positions, kakao: state.kakao, loaded: state.sig === signature };
}

// ── Positions fixed by staff in this session (by bank place id), so every day card updates ──

let overrides: Record<string, LatLng> = {};
const listeners = new Set<() => void>();

export function setPlacePositionOverride(bankId: string, c: LatLng): void {
  overrides = { ...overrides, [bankId]: c };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const EMPTY: Record<string, LatLng> = {};

export function usePlacePositionOverrides(): Record<string, LatLng> {
  return useSyncExternalStore(subscribe, () => overrides, () => EMPTY);
}
