'use client';

import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';

/** Shared CRM SWR defaults — instant revisit via cache, quiet background refresh. */
export function CrmSwrProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        keepPreviousData: true,
        dedupingInterval: 8_000,
        errorRetryCount: 2,
        shouldRetryOnError: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
