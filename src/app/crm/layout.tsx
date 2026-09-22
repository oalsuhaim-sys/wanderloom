import type { ReactNode } from 'react';

import { CrmEmployeeProvider } from './_components/CrmEmployeeProvider';
import { CrmRouteGuard } from './_components/CrmRouteGuard';
import { CrmShell } from './_components/CrmShell';
import { CrmSwrProvider } from './_components/CrmSwrProvider';
import { CrmThemeProvider } from './_components/CrmThemeProvider';

export default function CRMLayout({ children }: { children: ReactNode }) {
  return (
    <CrmEmployeeProvider>
      <CrmThemeProvider>
        <CrmSwrProvider>
          <CrmRouteGuard>
            <CrmShell>{children}</CrmShell>
          </CrmRouteGuard>
        </CrmSwrProvider>
      </CrmThemeProvider>
    </CrmEmployeeProvider>
  );
}
