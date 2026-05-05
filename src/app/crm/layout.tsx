import type { ReactNode } from 'react'
import { Sidebar } from './_components/Sidebar'

export default function CRMLayout({ children }: { children: ReactNode }) {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#F6F4F0', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <Sidebar />
        <main style={{ flex: 1, minWidth: 0 }}>
          <div style={{ padding: '16px 18px' }}>{children}</div>
        </main>
      </div>
    </div>
  )
}

