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
  Calculator,
  Radar,
  FileText,
  Route,
  ShieldCheck,
  Search,
  Settings,
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
  icon?: ComponentType<{ size?: number; className?: string }>;
  adminOnly?: boolean;
};

type NavGroup = {
  key: MenuKey;
  title: string;
  items: NavItem[];
};

const STANDALONE_TOP: NavItem[] = [
  { href: '/crm', label: 'لوحة القيادة', icon: LayoutDashboard },
];

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'operations',
    title: 'قسم العمليات',
    items: [
      { href: '/crm/quotations', label: 'عروض الأسعار', icon: FileText },
      { href: '/crm/itineraries', label: 'المسارات', icon: Route },
      { href: '/crm/groups', label: 'القروبات السياحية', icon: Users },
      { href: '/crm/groups/pricing', label: 'حاسبة تسعير القروب', icon: Calculator },
      { href: '/crm/sessions', label: 'الجلسات', icon: CalendarClock },
      { href: '/crm/marketing', label: 'مركز التسويق', icon: Megaphone },
      { href: '/crm/hotels', label: 'قاعدة الفنادق', icon: Hotel },
      { href: '/crm/suppliers', label: 'دليل الموردين', icon: Handshake },
    ],
  },
  {
    key: 'clients',
    title: 'قسم العملاء',
    items: [
      { href: '/crm/radar', label: 'رادار العملاء', icon: Radar },
      { href: '/crm/pipeline', label: 'لوحة الطلبات', icon: Kanban },
      { href: '/crm/clients', label: 'قاعدة العملاء', icon: Users },
      { href: '/crm/memories', label: 'ذكريات العملاء', icon: Images },
    ],
  },
  {
    key: 'partners',
    title: 'قسم الشركاء',
    items: [
      { href: '/crm/partners-radar', label: 'رادار الشركاء', icon: Radar },
      { href: '/crm/partners-directory', label: 'دليل الشركاء', icon: BookOpen },
    ],
  },
  {
    key: 'knowledge',
    title: 'بنك الموارد',
    items: [
      { href: '/crm/vault', label: 'بنك الأماكن', icon: Map },
      { href: '/crm/destinations', label: 'دليل الوجهات', icon: Globe },
      { href: '/crm/experiences', label: 'التجارب الاستثنائية', icon: Sparkles },
      { href: '/crm/events', label: 'الفعاليات', icon: CalendarDays },
    ],
  },
  {
    key: 'admin',
    title: 'الإدارة والتحليل',
    items: [
      { href: '/crm/analytics', label: 'الإحصائيات', icon: BarChart3 },
      { href: '/crm/finance', label: 'الذكاء المالي', icon: PiggyBank },
      { href: '/crm/reports', label: 'التقارير', icon: BarChart3 },
      { href: '/crm/accounts', label: 'إدارة الحسابات', icon: ShieldCheck, adminOnly: true },
      { href: '/crm/settings', label: 'إعدادات الوكالة', icon: Settings, adminOnly: true },
      { href: '/crm/admin', label: 'صلاحيات الفريق', icon: ShieldCheck, adminOnly: true },
    ],
  },
];

const STANDALONE_BOTTOM: NavItem[] = [
  { href: '/crm/accounts', label: 'إدارة الحسابات', icon: ShieldCheck, adminOnly: true },
  { href: '/crm/settings', label: 'إعدادات الوكالة', icon: Settings, adminOnly: true },
  { href: '/crm/features', label: 'دليل مميزات النظام', icon: Award },
];

function isNavItemActive(pathname: string, href: string): boolean {
  const isDashboardHome = pathname === '/crm' || pathname === '/crm/dashboard';
  if (href === '/crm') {
    return isDashboardHome;
  }
  // Keep /crm/groups from stealing active state from /crm/groups/pricing
  if (href === '/crm/groups' && pathname.startsWith('/crm/groups/pricing')) {
    return false;
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
      className={`group flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-all duration-200 ease-in-out ${
        active
          ? 'bg-slate-900 font-medium text-white shadow-sm dark:border dark:border-[#D4AF37]/30 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37] dark:shadow-none'
          : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-[#2A3834] dark:hover:text-gray-100'
      }`}
    >
      {Icon ? (
        <Icon
          size={16}
          className={`shrink-0 transition-colors ${
            active
              ? 'text-white dark:text-[#D4AF37]'
              : 'text-slate-400 group-hover:text-slate-600 dark:text-gray-500 dark:group-hover:text-[#D4AF37]'
          }`}
        />
      ) : (
        <span className="w-4" aria-hidden />
      )}
      <span className="truncate">{item.label}</span>
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
      className={`fixed inset-y-0 right-0 z-[60] flex h-screen w-[min(100vw-2.5rem,280px)] shrink-0 flex-col border-l border-slate-200 bg-white p-4 text-slate-900 transition-transform duration-300 ease-out dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-gray-100 lg:relative lg:sticky lg:top-0 lg:z-auto lg:w-[260px] lg:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
      }`}
    >
      <div className="mb-5 flex items-start justify-between gap-2 border-b border-slate-100 pb-4 dark:border-[#2D3F3A]">
        <div>
          <div className="text-base font-semibold tracking-tight text-slate-900 dark:text-[#D4AF37] sm:text-lg">
            Wanderloom
          </div>
          <div className="mt-0.5 text-xs font-medium text-slate-500 dark:text-gray-400">
            Command Center · CRM
          </div>
        </div>
        <button
          type="button"
          onClick={onNavigate}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#2A3834] dark:hover:text-[#D4AF37] lg:hidden"
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
        className="mb-4 flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-right transition-all duration-200 ease-in-out hover:bg-slate-100 dark:border-[#2D3F3A] dark:bg-[#2A3834] dark:hover:border-[#D4AF37]/30"
        aria-label="بحث سريع Ctrl+K"
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-[#D4AF37]" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-500 dark:text-gray-400">
          بحث سريع…
        </span>
        <kbd
          className="shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-400 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-500"
          dir="ltr"
        >
          Ctrl+K
        </kbd>
      </button>

      {employeeError ? (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-rose-700 ring-1 ring-rose-600/10"
        >
          {employeeError}
        </div>
      ) : null}

      <nav className="no-scrollbar mt-1 flex flex-1 flex-col gap-y-1 overflow-y-auto">
        <div className="mb-2 flex flex-col gap-0.5">
          {filterItems(STANDALONE_TOP).map((item) => (
            <SidebarNavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>

        {NAV_GROUPS.map((group) => {
          const items = filterItems(group.items);
          if (!items.length) return null;
          const isOpen = openMenu === group.key;

          return (
            <div key={group.key} className="mb-2">
              <button
                type="button"
                onClick={() => toggleMenu(group.key)}
                aria-expanded={isOpen}
                className="mb-1 flex w-full items-center justify-between rounded-lg px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 transition-all duration-200 ease-in-out hover:bg-slate-100 hover:text-slate-600 dark:text-gray-500 dark:hover:bg-[#2A3834] dark:hover:text-[#D4AF37]"
              >
                <span>{group.title}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 dark:text-gray-500 ${isOpen ? 'rotate-180' : ''}`}
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

        <div className="mt-2 flex flex-col gap-0.5">
          {filterItems(STANDALONE_BOTTOM).map((item) => (
            <SidebarNavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>

      <div className="mt-auto border-t border-slate-100 pt-4 dark:border-[#2D3F3A]">
        {!loading && employee ? (
          <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-[#2D3F3A] dark:bg-[#2A3834]">
            <div className="text-xs font-semibold text-slate-900 dark:text-[#D4AF37]">
              {employee.full_name}
            </div>
            {(employee.job_title || employee.role || profileAccess?.is_admin) && (
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-gray-400">
                {profileAccess?.is_admin ? 'مدير النظام' : employee.job_title || employee.role}
              </div>
            )}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700 transition-all duration-200 ease-in-out hover:bg-rose-100 active:scale-[0.98] dark:border-[#2D3F3A] dark:bg-[#2A3834] dark:text-gray-300 dark:hover:border-rose-500/40 dark:hover:text-rose-300"
        >
          <LogOut size={16} className="text-rose-500 dark:text-rose-400" />
          تسجيل الخروج
        </button>
        <div className="text-[10px] tracking-[0.2em] text-slate-300 dark:text-[#D4AF37]/40">
          WANDERLOOM · CRM
        </div>
      </div>
    </aside>
  );
}
