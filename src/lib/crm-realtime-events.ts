/** Custom browser events for CRM Realtime → UI refresh */

export const CRM_REALTIME_REFRESH_EVENT = 'wanderloom:crm-realtime-refresh';

export type CrmRealtimeRefreshDetail = {
  source:
    | 'leads'
    | 'clients'
    | 'quotations'
    | 'invoices'
    | 'group_members'
    | 'itineraries'
    | 'manual';
  reason?: string;
};

export function dispatchCrmRealtimeRefresh(detail: CrmRealtimeRefreshDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<CrmRealtimeRefreshDetail>(CRM_REALTIME_REFRESH_EVENT, { detail }),
  );
}

export function subscribeCrmRealtimeRefresh(
  handler: (detail: CrmRealtimeRefreshDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const listener = (event: Event) => {
    const custom = event as CustomEvent<CrmRealtimeRefreshDetail>;
    handler(custom.detail ?? { source: 'manual' });
  };
  window.addEventListener(CRM_REALTIME_REFRESH_EVENT, listener);
  return () => window.removeEventListener(CRM_REALTIME_REFRESH_EVENT, listener);
}
