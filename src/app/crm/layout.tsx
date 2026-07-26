import type { ReactNode } from 'react';

import { CrmEmployeeProvider } from './_components/CrmEmployeeProvider';
import { CrmRouteGuard } from './_components/CrmRouteGuard';
import { CrmShell } from './_components/CrmShell';
import { CrmThemeProvider } from './_components/CrmThemeProvider';

export default function CRMLayout({ children }: { children: ReactNode }) {
  return (
    <CrmEmployeeProvider>
      <CrmThemeProvider>
        <CrmRouteGuard>
          <CrmShell>{children}</CrmShell>
        </CrmRouteGuard>
      </CrmThemeProvider>
    </CrmEmployeeProvider>
  );
}
