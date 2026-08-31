'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  FileText,
  Handshake,
  Kanban,
  Loader2,
  PiggyBank,
  Plane,
  Plus,
  Radar,
  Route,
  Search,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';

export const CRM_COMMAND_PALETTE_EVENT = 'crm:command-palette';

type PaletteItem = {
  id: string;
  label: string;
  subtitle?: string;
  href: string;
  keywords?: string;
};

type QuickAction = {
  id: string;
  label: string;
  subtitle?: string;
  href: string;
  icon: LucideIcon;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'new-trip',
    label: 'إضافة رحلة جديدة',
    subtitle: 'إطلاق مسار VIP',
    href: '/crm/itineraries/new',
    icon: Plus,
  },
  {
    id: 'new-quote',
    label: 'عرض سعر جديد',
    href: '/crm/quotations/new',
    icon: FileText,
  },
  {
    id: 'clients',
    label: 'قاعدة العملاء',
    href: '/crm/clients',
    icon: Users,
  },
  {
    id: 'itineraries',
    label: 'المسارات',
    href: '/crm/itineraries',
    icon: Route,
  },
  {
    id: 'radar',
    label: 'رادار العملاء',
    href: '/crm/radar',
    icon: Radar,
  },
  {
    id: 'pipeline',
    label: 'لوحة الطلبات (كانبان)',
    subtitle: 'إدارة مراحل طلبات الرحلات',
    href: '/crm/pipeline',
    icon: Kanban,
  },
  {
    id: 'finance',
    label: 'الذكاء المالي',
    subtitle: 'هوامش الربح والوجهات',
    href: '/crm/finance',
    icon: PiggyBank,
  },
  {
    id: 'partners',
    label: 'دليل الشركاء',
    href: '/crm/partners-directory',
    icon: Handshake,
  },
];

function matchesQuery(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return text.toLowerCase().includes(q);
}

function ItemRow({
  icon: Icon,
  label,
  subtitle,
  onSelect,
}: {
  icon?: LucideIcon;
  label: string;
  subtitle?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={`${label} ${subtitle ?? ''}`}
      onSelect={onSelect}
      className="mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-slate-800 outline-none transition-colors hover:bg-slate-100 aria-selected:bg-slate-900 aria-selected:text-white data-[selected=true]:bg-slate-900 data-[selected=true]:text-white dark:text-gray-200 dark:hover:bg-[#1A2421] dark:aria-selected:bg-[#D4AF37]/20 dark:aria-selected:text-[#D4AF37] dark:data-[selected=true]:bg-[#D4AF37]/20 dark:data-[selected=true]:text-[#D4AF37]"
    >
      {Icon ? (
        <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
      ) : (
        <span className="h-4 w-4 shrink-0" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{label}</span>
        {subtitle ? (
          <span className="mt-0.5 block truncate text-[11px] font-semibold opacity-60">
            {subtitle}
          </span>
        ) : null}
      </span>
    </Command.Item>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-black [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-gray-400"
    >
      {children}
    </Command.Group>
  );
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<PaletteItem[]>([]);
  const [trips, setTrips] = useState<PaletteItem[]>([]);
  const [partners, setPartners] = useState<PaletteItem[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  const loadResults = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [clientsRes, tripsRes, leadersRes, expertsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, phone_wa, email')
          .order('id', { ascending: false })
          .limit(40),
        supabase
          .from('itineraries')
          .select('id, title, destination, status')
          .order('id', { ascending: false })
          .limit(40),
        supabase.from('leaders').select('id, name, full_name, city').limit(20),
        supabase.from('experts').select('id, name, full_name, city').limit(20),
      ]);

      const clientRows = (clientsRes.data ?? []) as Array<{
        id: string | number;
        name?: string | null;
        phone_wa?: string | null;
        email?: string | null;
      }>;
      setClients(
        clientRows.map((c) => ({
          id: `client-${c.id}`,
          label: String(c.name ?? 'عميل').trim() || 'عميل',
          subtitle: String(c.phone_wa || c.email || '').trim() || undefined,
          href: `/crm/clients/${c.id}`,
          keywords: `${c.name} ${c.phone_wa} ${c.email}`,
        })),
      );

      const tripRows = (tripsRes.data ?? []) as Array<{
        id: string | number;
        title?: string | null;
        destination?: string | null;
        status?: string | null;
      }>;
      setTrips(
        tripRows.map((t) => {
          const dest = String(t.destination ?? '').trim();
          const title = String(t.title ?? '').trim();
          return {
            id: `trip-${t.id}`,
            label: dest || title || 'رحلة',
            subtitle: [title && title !== dest ? title : null, t.status]
              .filter(Boolean)
              .join(' · ') || undefined,
            href: `/crm/itineraries/${t.id}/edit`,
            keywords: `${dest} ${title} ${t.status}`,
          };
        }),
      );

      type PartnerRow = {
        id: string | number;
        name?: string | null;
        full_name?: string | null;
        city?: string | null;
      };
      const partnerItems: PaletteItem[] = [];
      for (const row of (leadersRes.data ?? []) as PartnerRow[]) {
        const label = String(row.full_name || row.name || 'قائد').trim();
        partnerItems.push({
          id: `leader-${row.id}`,
          label,
          subtitle: row.city ? `قائد · ${row.city}` : 'قائد',
          href: `/crm/partners-directory/profile?type=leader&id=${row.id}`,
          keywords: `${label} leader قائد ${row.city}`,
        });
      }
      for (const row of (expertsRes.data ?? []) as PartnerRow[]) {
        const label = String(row.full_name || row.name || 'خبير').trim();
        partnerItems.push({
          id: `expert-${row.id}`,
          label,
          subtitle: row.city ? `خبير · ${row.city}` : 'خبير',
          href: `/crm/partners-directory/expert/${row.id}`,
          keywords: `${label} expert خبير ${row.city}`,
        });
      }
      setPartners(partnerItems);
    } catch {
      // keep previous / empty lists
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(CRM_COMMAND_PALETTE_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(CRM_COMMAND_PALETTE_EVENT, onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadResults();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, loadResults]);

  const filteredClients = useMemo(
    () =>
      clients.filter((c) =>
        matchesQuery(`${c.label} ${c.subtitle ?? ''} ${c.keywords ?? ''}`, query),
      ),
    [clients, query],
  );
  const filteredTrips = useMemo(
    () =>
      trips.filter((t) =>
        matchesQuery(`${t.label} ${t.subtitle ?? ''} ${t.keywords ?? ''}`, query),
      ),
    [trips, query],
  );
  const filteredPartners = useMemo(
    () =>
      partners.filter((p) =>
        matchesQuery(`${p.label} ${p.subtitle ?? ''} ${p.keywords ?? ''}`, query),
      ),
    [partners, query],
  );
  const filteredActions = useMemo(
    () =>
      QUICK_ACTIONS.filter((a) =>
        matchesQuery(`${a.label} ${a.subtitle ?? ''}`, query),
      ),
    [query],
  );

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-[15vh] backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <Command
        dir="rtl"
        label="بحث سريع في CRM"
        shouldFilter={false}
        className="w-[95%] max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-gray-100"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
        }}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 dark:border-[#2D3F3A]">
          <Search className="h-5 w-5 shrink-0 text-slate-400 dark:text-[#D4AF37]" aria-hidden />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="ابحث عن عميل، رحلة، شريك، أو إجراء…"
            className="w-full border-0 bg-transparent px-2 py-4 text-xl text-slate-900 outline-none placeholder:text-slate-400 dark:text-gray-100"
            autoFocus
          />
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400 dark:text-[#D4AF37]" aria-hidden />
          ) : (
            <kbd className="hidden shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-400 sm:inline dark:border-[#2D3F3A] dark:bg-[#1A2421]">
              Esc
            </kbd>
          )}
        </div>

        <Command.List className="max-h-[min(55vh,420px)] overflow-y-auto py-2">
          <Command.Empty className="px-6 py-8 text-center text-sm font-bold text-gray-400">
            لا توجد نتائج مطابقة.
          </Command.Empty>

          {filteredActions.length > 0 ? (
            <Section heading="الإجراءات السريعة">
              {filteredActions.map((action) => (
                <ItemRow
                  key={action.id}
                  icon={action.icon}
                  label={action.label}
                  subtitle={action.subtitle}
                  onSelect={() => go(action.href)}
                />
              ))}
            </Section>
          ) : null}

          {filteredClients.length > 0 ? (
            <Section heading="العملاء">
              {filteredClients.slice(0, 12).map((item) => (
                <ItemRow
                  key={item.id}
                  icon={Users}
                  label={item.label}
                  subtitle={item.subtitle}
                  onSelect={() => go(item.href)}
                />
              ))}
            </Section>
          ) : null}

          {filteredTrips.length > 0 ? (
            <Section heading="الرحلات">
              {filteredTrips.slice(0, 12).map((item) => (
                <ItemRow
                  key={item.id}
                  icon={Plane}
                  label={item.label}
                  subtitle={item.subtitle}
                  onSelect={() => go(item.href)}
                />
              ))}
            </Section>
          ) : null}

          {filteredPartners.length > 0 ? (
            <Section heading="الشركاء">
              {filteredPartners.slice(0, 12).map((item) => (
                <ItemRow
                  key={item.id}
                  icon={Handshake}
                  label={item.label}
                  subtitle={item.subtitle}
                  onSelect={() => go(item.href)}
                />
              ))}
            </Section>
          ) : null}
        </Command.List>

        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-2.5 text-[10px] font-bold text-gray-400">
          <span>Wanderloom Command</span>
          <span className="inline-flex items-center gap-1.5" dir="ltr">
            <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5">↑↓</kbd>
            للتنقل
            <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5">Enter</kbd>
            للفتح
          </span>
        </div>
      </Command>
    </div>,
    document.body,
  );
}

export function openCrmCommandPalette() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CRM_COMMAND_PALETTE_EVENT));
}
