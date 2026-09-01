'use client';

import { useCallback, useEffect, useRef } from 'react';

import {
  syncExistingGroupMembersAction,
  type SyncExistingGroupMembersActionResult,
} from '@/app/actions/clientDirectoryActions';
import { getClientAccessToken } from '@/lib/crm-session-token';

/** localStorage flag — auto-runs once per browser until key version bumps */
export const GROUP_MEMBERS_CLIENT_SYNC_KEY = 'wanderloom_crm_group_members_sync_v1';

/** Runs the one-time group_members → clients repair (no-op if already done). */
export async function runGroupMembersClientSyncOnce(): Promise<SyncExistingGroupMembersActionResult | null> {
  if (typeof window === 'undefined') return null;
  if (localStorage.getItem(GROUP_MEMBERS_CLIENT_SYNC_KEY) === 'done') return null;

  const token = await getClientAccessToken();
  const result = await syncExistingGroupMembersAction(token);
  localStorage.setItem(GROUP_MEMBERS_CLIENT_SYNC_KEY, 'done');
  return result;
}

export type UseClientsOptions = {
  /** Called when sync created or linked at least one profile (refresh directory). */
  onSynced?: () => void;
  /** Set false to disable automatic one-time sync on mount. */
  autoSync?: boolean;
};

/**
 * CRM clients hook — one-time repair of group_members → clients SSOT on initialization.
 */
export function useClients(options: UseClientsOptions = {}) {
  const { onSynced, autoSync = true } = options;
  const initStarted = useRef(false);

  const syncExistingGroupMembers =
    useCallback(async (): Promise<SyncExistingGroupMembersActionResult> => {
      const token = await getClientAccessToken();
      return syncExistingGroupMembersAction(token);
    }, []);

  useEffect(() => {
    if (!autoSync || initStarted.current) return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(GROUP_MEMBERS_CLIENT_SYNC_KEY) === 'done') return;

    initStarted.current = true;

    void (async () => {
      try {
        const result = await runGroupMembersClientSyncOnce();
        if (!result) return;

        if (result.ok && (result.created > 0 || result.linked > 0)) {
          console.info(
            `[useClients] group_members → clients: created=${result.created}, linked=${result.linked}`,
          );
          onSynced?.();
        } else if (!result.ok) {
          console.warn('[useClients] group_members sync:', result.error);
        }
      } catch (err) {
        console.warn('[useClients] group_members sync failed:', err);
      }
    })();
  }, [autoSync, onSynced]);

  return { syncExistingGroupMembers };
}
