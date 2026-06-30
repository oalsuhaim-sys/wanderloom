import type { ReactNode } from 'react';

import { CrmEmployeeProvider } from './_components/CrmEmployeeProvider';
import { CrmShell } from './_components/CrmShell';

export default function CRMLayout({ children }: { children: ReactNode }) {
  return (
    <CrmEmployeeProvider>
      <CrmShell>{children}</CrmShell>
    </CrmEmployeeProvider>
  );
}
