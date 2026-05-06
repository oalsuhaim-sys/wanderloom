'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Map,
  Globe,
  Hotel,
  CalendarDays,
  CalendarClock,
  Route,
  BarChart3,
  Sparkles,
} from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  icon?: ComponentType<{ size?: number; color?: string }>;
};

const NAV: NavItem[] = [
  { href: '/crm', label: 'الرئيسية', icon: LayoutDashboard },
  { href: '/crm/clients', label: 'العملاء', icon: Users },
  { href: '/crm/vault', label: 'بنك الأماكن', icon: Map },
  { href: '/crm/destinations', label: 'دليل الوجهات', icon: Globe },
  { href: '/crm/hotels', label: 'قاعدة الفنادق', icon: Hotel },
  { href: '/crm/experiences', label: 'التجارب الاستثنائية', icon: Sparkles },
  { href: '/crm/events', label: 'الفعاليات', icon: CalendarDays },
  { href: '/crm/sessions', label: 'الجلسات', icon: CalendarClock },
  { href: '/crm/itineraries', label: 'المسارات', icon: Route },
  { href: '/crm/reports', label: 'التقارير', icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname() || '';

  return (
    <aside
      dir="rtl"
      style={{
        width: 260,
        background: 'linear-gradient(160deg,#07100D,#0F1E16)',
        color: '#fff',
        padding: 18,
        position: 'sticky',
        top: 0,
        height: '100vh',
        borderLeft: '1px solid rgba(201,168,76,.14)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#C9A84C', letterSpacing: 6 }}>Wanderloom</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,.28)', marginTop: 4 }}>CRM · إدارة السفر</div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14, flex: 1, overflowY: 'auto' }}>
        {NAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/crm' && (pathname === item.href || pathname.startsWith(item.href + '/')));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 14,
                textDecoration: 'none',
                color: active ? '#1C4532' : 'rgba(255,255,255,.85)',
                background: active ? 'linear-gradient(135deg,#8A6B2A,#C9A84C)' : 'rgba(255,255,255,.04)',
                border: active ? '1px solid rgba(201,168,76,.55)' : '1px solid rgba(255,255,255,.06)',
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: 0.2,
              }}
            >
              {Icon ? <Icon size={16} color={active ? '#1C4532' : '#C9A84C'} /> : <span style={{ width: 16 }} aria-hidden />}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <div
          style={{
            height: 1,
            background: 'linear-gradient(90deg,transparent,rgba(201,168,76,.25),transparent)',
            marginBottom: 12,
          }}
        />
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,.18)', letterSpacing: 3 }}>WANDERLOOM · INTERNAL</div>
      </div>
    </aside>
  );
}
