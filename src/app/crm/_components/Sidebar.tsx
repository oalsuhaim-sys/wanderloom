'use client';

import { useState, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Award,
  BarChart3,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  Globe,
  Handshake,
  Hotel,
  Images,
  LayoutDashboard,
  LogOut,
  Map,
  Megaphone,
  Radar,
  FileText,
  Route,
  Shirt,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { hasCrmAdminAccess } from '@/lib/crm-roles';
import { useCrmEmployee } from './CrmEmployeeProvider';

type MenuKey = 'operations' | 'partners' | 'knowledge' | 'admin';

type NavItem = {
  href: string;
  label: string;
  icon?: ComponentType<{ size?: number; color?: string }>;
  adminOnly?: boolean;
};

type NavGroup = {
  key: MenuKey;
  title: string;
  items: NavItem[];
};

const GOLD = '#cda04c';
const OLIVE = '#1e3f20';

const STANDALONE_TOP: NavItem[] = [
  { href: '/crm', label: 'لوحة القيادة', icon: LayoutDashboard },
];

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'operations',
    title: '⚡ قسم العمليات',
    items: [
      { href: '/crm/radar', label: 'الرادار الحي', icon: Radar },
      { href: '/crm/quotations', label: 'عروض الأسعار', icon: FileText },
      { href: '/crm/itineraries', label: 'المسارات', icon: Route },
      { href: '/crm/groups', label: 'القروبات السياحية', icon: Users },
      { href: '/crm/sessions', label: 'الجلسات', icon: CalendarClock },
      { href: '/crm/marketing', label: 'مركز التسويق', icon: Megaphone },
    ],
  },
  {
    key: 'partners',
    title: '🤝 قسم الشركاء',
    items: [
      { href: '/crm/clients', label: 'العملاء', icon: Users },
      { href: '/crm/memories', label: 'ذكريات العملاء', icon: Images },
      { href: '/crm/hotels', label: 'قاعدة الفنادق', icon: Hotel },
      { href: '/crm/suppliers', label: 'دليل الموردين', icon: Handshake },
    ],
  },
  {
    key: 'knowledge',
    title: '📚 بنك الموارد',
    items: [
      { href: '/crm/vault', label: 'بنك الأماكن', icon: Map },
      { href: '/crm/destinations', label: 'دليل الوجهات', icon: Globe },
      { href: '/crm/experiences', label: 'التجارب الاستثنائية', icon: Sparkles },
      { href: '/crm/events', label: 'الفعاليات', icon: CalendarDays },
      { href: '/crm/wardrobe', label: 'مجموعة الأزياء', icon: Shirt },
    ],
  },
  {
    key: 'admin',
    title: '📊 الإدارة والتحليل',
    items: [
      { href: '/crm/analytics', label: 'الإحصائيات', icon: BarChart3 },
      { href: '/crm/reports', label: 'التقارير', icon: BarChart3 },
      { href: '/crm/team', label: 'الفريق', icon: Users, adminOnly: true },
    ],
  },
];

const STANDALONE_BOTTOM: NavItem[] = [
  { href: '/crm/features', label: 'دليل مميزات النظام', icon: Award },
];

function isNavItemActive(pathname: string, href: string): boolean {
  const isDashboardHome = pathname === '/crm' || pathname === '/crm/dashboard';
  if (href === '/crm') {
    return isDashboardHome;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isNavItemActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={() => onNavigate?.()}
      className={`flex items-center gap-2.5 rounded-[14px] border px-3 py-2.5 text-xs font-black tracking-wide transition ${
        active
          ? 'border-[#cda04c]/55 bg-gradient-to-br from-[#cda04c] to-[#b3893d] text-[#1e3f20] shadow-sm shadow-[#cda04c]/20'
          : 'border-white/6 bg-white/[0.04] text-white/85 hover:border-[#cda04c]/35 hover:bg-[#cda04c]/10 hover:text-white'
      }`}
    >
      {Icon ? (
        <Icon size={16} color={active ? OLIVE : GOLD} />
      ) : (
        <span className="w-4" aria-hidden />
      )}
      {item.label}
    </Link>
  );
}


export function Sidebar({
  mobileOpen = false,
  onNavigate,
}: {
  mobileOpen?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const { employee, authEmail, loading, employeeError } = useCrmEmployee();

  const [openMenu, setOpenMenu] = useState<MenuKey | null>('operations');

  const isAdmin = hasCrmAdminAccess(employee?.role ?? null, authEmail);

  function filterItems(items: NavItem[]): NavItem[] {
    return items.filter((item) => !item.adminOnly || (isAdmin && !loading));
  }

  const toggleMenu = (menuKey: MenuKey) => {
    setOpenMenu((prev) => (prev === menuKey ? null : menuKey));
  };

  async function handleSignOut() {
    if (supabase) await supabase.auth.signOut();
    if (typeof window !== 'undefined') window.sessionStorage.removeItem('wanderloom_employee');
    router.replace('/login');
    router.refresh();
  }

  return (
    <aside
      dir="rtl"
      className={`fixed inset-y-0 right-0 z-[60] flex h-screen w-[min(100vw-2.5rem,280px)] shrink-0 flex-col border-l border-[#cda04c]/15 bg-gradient-to-b from-[#07100D] to-[#0F1E16] p-4 text-white transition-transform duration-300 ease-out sm:p-[18px] lg:relative lg:sticky lg:top-0 lg:z-auto lg:w-[260px] lg:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <div className="text-base font-bold tracking-[0.35em] text-[#cda04c] sm:text-lg">Wanderloom</div>
          <div className="mt-1 text-[9px] text-white/30">CRM · إدارة السفر</div>
        </div>
        <button
          type="button"
          onClick={onNavigate}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/70 transition hover:bg-white/10 lg:hidden"
          aria-label="إغلاق القائمة"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {employeeError ? (
        <div
          role="alert"
          className="mb-3 rounded-xl border border-red-300/35 bg-red-950/35 px-3 py-2.5 text-[11px] font-bold leading-relaxed text-red-100"
        >
          {employeeError}
        </div>
      ) : null}

      <nav className="no-scrollbar mt-3.5 flex flex-1 flex-col gap-y-1 overflow-y-auto">
        <div className="mb-2 flex flex-col gap-1.5">
          {STANDALONE_TOP.map((item) => (
            <SidebarNavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>

        {NAV_GROUPS.map((group) => {
          const items = filterItems(group.items);
          if (!items.length) return null;
          const isOpen = openMenu === group.key;

          return (
            <div key={group.key} className="mb-3">
              <button
                type="button"
                onClick={() => toggleMenu(group.key)}
                aria-expanded={isOpen}
                className="mb-2 mt-2 flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50 transition hover:bg-[#cda04c]/10 hover:text-[#cda04c]"
              >
                <span>{group.title}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-[#cda04c] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>

              <div
                className={`flex flex-col gap-1 overflow-hidden transition-all duration-300 ${
                  isOpen ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                {items.map((item) => (
                  <SidebarNavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <div className="mt-2 flex flex-col gap-1.5">
          {STANDALONE_BOTTOM.map((item) => (
            <SidebarNavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>

      <div className="mt-auto pt-4">
        {!loading && employee ? (
          <div className="mb-3 rounded-[14px] border border-[#cda04c]/25 bg-white/5 px-3 py-2.5">
            <div className="text-[11px] font-black text-[#cda04c]">{employee.full_name}</div>
            {(employee.job_title || employee.role) && (
              <div className="mt-1 text-[9px] text-white/45">
                {employee.job_title || employee.role}
              </div>
            )}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-[14px] border border-red-400/40 bg-red-950/30 px-3 py-2.5 text-xs font-black text-red-100 transition hover:border-red-300/60 hover:bg-red-900/40"
        >
          <LogOut size={16} color="#fca5a5" />
          تسجيل الخروج
        </button>
        <div className="mb-3 h-px bg-gradient-to-r from-transparent via-[#cda04c]/25 to-transparent" />
        <div className="text-[9px] tracking-[0.3em] text-white/20">WANDERLOOM · INTERNAL</div>
      </div>
    </aside>
  );
}
