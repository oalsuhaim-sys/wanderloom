'use client';

import { useState, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Award,
  BarChart3,
  BookOpen,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  Globe,
  Handshake,
  Hotel,
  Images,
  Kanban,
  LayoutDashboard,
  LogOut,
  Map,
  Megaphone,
  PiggyBank,
  Radar,
  FileText,
  Route,
  ShieldCheck,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

import {
  hasCrmPermission,
  isExpertAllowedCrmPath,
  navHrefPermission,
} from '@/lib/crm-permissions';
import { supabase } from '@/lib/supabase';
import { openCrmCommandPalette } from './CommandPalette';
import { CrmPwaInstallWidget } from './CrmPwaInstallWidget';
import CrmThemeToggle from './CrmThemeToggle';
import { useCrmEmployee } from './CrmEmployeeProvider';

type MenuKey = 'operations' | 'clients' | 'partners' | 'knowledge' | 'admin';

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

const GOLD = '#C5A059';

const STANDALONE_TOP: NavItem[] = [
  { href: '/crm', label: 'لوحة القيادة', icon: LayoutDashboard },
];

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'operations',
    title: '⚡ قسم العمليات',
    items: [
      { href: '/crm/quotations', label: 'عروض الأسعار', icon: FileText },
      { href: '/crm/itineraries', label: 'المسارات', icon: Route },
      { href: '/crm/groups', label: 'القروبات السياحية', icon: Users },
      { href: '/crm/sessions', label: 'الجلسات', icon: CalendarClock },
      { href: '/crm/marketing', label: 'مركز التسويق', icon: Megaphone },
      { href: '/crm/hotels', label: 'قاعدة الفنادق', icon: Hotel },
      { href: '/crm/suppliers', label: 'دليل الموردين', icon: Handshake },
    ],
  },
  {
    key: 'clients',
    title: '👥 قسم العملاء',
    items: [
      { href: '/crm/radar', label: 'رادار العملاء', icon: Radar },
      { href: '/crm/pipeline', label: 'لوحة الطلبات', icon: Kanban },
      { href: '/crm/clients', label: 'قاعدة العملاء', icon: Users },
      { href: '/crm/memories', label: 'ذكريات العملاء', icon: Images },
    ],
  },
  {
    key: 'partners',
    title: '🤝 قسم الشركاء',
    items: [
      { href: '/crm/partners-radar', label: 'رادار الشركاء', icon: Radar },
      { href: '/crm/partners-directory', label: 'دليل الشركاء', icon: BookOpen },
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
    ],
  },
  {
    key: 'admin',
    title: '📊 الإدارة والتحليل',
    items: [
      { href: '/crm/analytics', label: 'الإحصائيات', icon: BarChart3 },
      { href: '/crm/finance', label: 'الذكاء المالي', icon: PiggyBank },
      { href: '/crm/reports', label: 'التقارير', icon: BarChart3 },
      { href: '/crm/accounts', label: 'إدارة الحسابات', icon: ShieldCheck, adminOnly: true },
      { href: '/crm/admin', label: 'صلاحيات الفريق', icon: ShieldCheck, adminOnly: true },
    ],
  },
];

const STANDALONE_BOTTOM: NavItem[] = [
  { href: '/crm/accounts', label: 'إدارة الحسابات', icon: ShieldCheck, adminOnly: true },
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
      className={`flex items-center gap-2.5 border-l-4 px-3 py-2.5 text-xs font-bold tracking-wide transition-colors duration-300 ${
        active
          ? 'border-[#C5A059] bg-white/10 text-[#C5A059]'
          : 'border-transparent text-gray-200 hover:bg-white/5 hover:text-white'
      }`}
    >
      {Icon ? (
        <Icon size={16} color={active ? GOLD : '#E5E7EB'} />
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
  const { employee, profileAccess, loading, employeeError } = useCrmEmployee();

  const [openMenu, setOpenMenu] = useState<MenuKey | null>('operations');

  const isAdmin = Boolean(profileAccess?.is_admin);
  const isExpert = Boolean(profileAccess?.is_expert) && !isAdmin;

  function canSeeNavItem(item: NavItem): boolean {
    if (loading) return false;
    if (item.adminOnly && !isAdmin) return false;
    // Experts: Operations + Supplier Bank only (no sessions / marketing / clients / partners)
    if (isExpert) {
      return isExpertAllowedCrmPath(item.href);
    }
    const required = navHrefPermission(item.href);
    if (!required) return true;
    if (required === 'is_admin') return isAdmin;
    if (required === 'can_access_partners') return true;
    return hasCrmPermission(profileAccess, required);
  }

  function filterItems(items: NavItem[]): NavItem[] {
    return items.filter(canSeeNavItem);
  }

  const toggleMenu = (menuKey: MenuKey) => {
    setOpenMenu((prev) => (prev === menuKey ? null : menuKey));
  };

  async function handleSignOut() {
    if (supabase) await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('wanderloom_employee');
      window.sessionStorage.removeItem('wanderloom_profile');
    }
    router.replace('/login');
    router.refresh();
  }

  return (
    <aside
      dir="rtl"
      className={`fixed inset-y-0 right-0 z-[60] flex h-screen w-[min(100vw-2.5rem,280px)] shrink-0 flex-col border-l border-white/10 bg-[#1A3B2A] p-4 text-gray-200 transition-transform duration-300 ease-out sm:p-[18px] lg:relative lg:sticky lg:top-0 lg:z-auto lg:w-[260px] lg:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <div className="text-base font-bold tracking-[0.35em] text-[#C5A059] sm:text-lg">
            Wanderloom
          </div>
          <div className="mt-1 text-[9px] text-gray-400">Command Center · CRM</div>
        </div>
        <button
          type="button"
          onClick={onNavigate}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-gray-300 transition-colors duration-300 hover:bg-white/5 hover:text-white lg:hidden"
          aria-label="إغلاق القائمة"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <CrmPwaInstallWidget />

      <CrmThemeToggle />

      <button
        type="button"
        onClick={() => openCrmCommandPalette()}
        className="mb-3 flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-right transition-colors duration-300 hover:border-[#C5A059]/40 hover:bg-white/10"
        aria-label="بحث سريع Ctrl+K"
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-[#C5A059]" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-gray-300">
          بحث سريع…
        </span>
        <kbd
          className="shrink-0 rounded-md border border-white/15 bg-black/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-[#C5A059]/90"
          dir="ltr"
        >
          Ctrl+K
        </kbd>
      </button>

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
          {filterItems(STANDALONE_TOP).map((item) => (
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
                className="mb-2 mt-2 flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 transition-colors duration-300 hover:bg-white/5 hover:text-white"
              >
                <span>{group.title}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-[#C5A059] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>

              <div
                className={`flex flex-col gap-0.5 overflow-hidden transition-all duration-300 ${
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
          {filterItems(STANDALONE_BOTTOM).map((item) => (
            <SidebarNavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>

      <div className="mt-auto pt-4">
        {!loading && employee ? (
          <div className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <div className="text-[11px] font-black text-[#C5A059]">{employee.full_name}</div>
            {(employee.job_title || employee.role || profileAccess?.is_admin) && (
              <div className="mt-1 text-[9px] text-gray-400">
                {profileAccess?.is_admin ? 'مدير النظام' : employee.job_title || employee.role}
              </div>
            )}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-950/20 px-3 py-2.5 text-xs font-black text-red-100 transition-colors duration-300 hover:bg-red-900/40"
        >
          <LogOut size={16} color="#fca5a5" />
          تسجيل الخروج
        </button>
        <div className="mb-3 h-px bg-gradient-to-r from-transparent via-[#C5A059]/30 to-transparent" />
        <div className="text-[9px] tracking-[0.3em] text-white/25">WANDERLOOM · COMMAND</div>
      </div>
    </aside>
  );
}
