'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  Calendar,
  Landmark,
  Loader2,
  Palette,
  Save,
  Search,
  ShoppingBag,
  Sparkles,
  Trees,
  TrendingUp,
  UtensilsCrossed,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  clampRegisteredClientIds,
  computeFellowshipMatches,
  FELLOWSHIP_INTEREST_META,
  type FellowshipClientDna,
  type FellowshipInterest,
  type FellowshipPairMatch,
} from '@/lib/fellowship-matching';
import { supabase } from '@/lib/supabase';

const GOLD = '#D4AF37';
const NAVY = '#001f3f';
const MAX_REGISTRANTS = 10;

const INTEREST_ICONS: Record<FellowshipInterest, LucideIcon> = {
  investment: TrendingUp,
  art: Palette,
  architecture: Building2,
  food: UtensilsCrossed,
  active: Activity,
  culture: Landmark,
  nature: Trees,
  shopping: ShoppingBag,
  spa: Sparkles,
  sports: Activity,
  history: Landmark,
  events: Calendar,
};

type ClientOption = { id: number; name: string };

export type GroupManagementProps = {
  groupTripId: string;
  groupTitle: string;
  registeredClientIds: number[];
  onRegisteredClientIdsChange?: (ids: number[]) => void;
  onClose?: () => void;
};

function InterestIcon({ interest, size = 14 }: { interest: FellowshipInterest; size?: number }) {
  const Icon = INTEREST_ICONS[interest] ?? Sparkles;
  return <Icon size={size} className="shrink-0 text-[#D4AF37]" aria-hidden />;
}

function ClientInterestBadges({ client }: { client: FellowshipClientDna }) {
  if (!client.interests.length) {
    return <span className="text-[10px] font-semibold text-white/40">بدون DNA مسجّل</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {client.priorityInterests.map((key) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-0.5 text-[9px] font-bold text-[#f5e6b8]"
          title={FELLOWSHIP_INTEREST_META[key].labelAr}
        >
          <InterestIcon interest={key} size={10} />
          {FELLOWSHIP_INTEREST_META[key].labelAr}
        </span>
      ))}
    </div>
  );
}

function FellowshipNodeGraph({
  clients,
  pairs,
}: {
  clients: FellowshipClientDna[];
  pairs: FellowshipPairMatch[];
}) {
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 118;

  const nodes = useMemo(() => {
    if (!clients.length) return [];
    return clients.map((c, i) => {
      const angle = (i / clients.length) * Math.PI * 2 - Math.PI / 2;
      return {
        ...c,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });
  }, [clients, cx, cy, radius]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.clientId, n])), [nodes]);

  return (
    <div className="relative mx-auto w-full max-w-[360px]">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full" aria-label="رسم التطابق البشري">
        <defs>
          <filter id="fellowship-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="fellowship-line" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.35" />
            <stop offset="50%" stopColor={GOLD} stopOpacity="1" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0.35" />
          </linearGradient>
        </defs>

        {pairs.map((pair) => {
          const a = nodeById.get(pair.clientAId);
          const b = nodeById.get(pair.clientBId);
          if (!a || !b) return null;
          return (
            <line
              key={`${pair.clientAId}-${pair.clientBId}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="url(#fellowship-line)"
              strokeWidth={2 + Math.min(pair.score, 6) * 0.35}
              filter="url(#fellowship-glow)"
              strokeLinecap="round"
            />
          );
        })}

        {nodes.map((n) => (
          <g key={n.clientId}>
            <circle cx={n.x} cy={n.y} r={26} fill={NAVY} stroke={GOLD} strokeWidth={2} />
            <circle cx={n.x} cy={n.y} r={32} fill="none" stroke={GOLD} strokeWidth={1} opacity={0.25} />
            <text
              x={n.x}
              y={n.y + 4}
              textAnchor="middle"
              fill={GOLD}
              fontSize={11}
              fontWeight={700}
            >
              {n.name.slice(0, 2)}
            </text>
          </g>
        ))}
      </svg>

      <ul className="mt-3 space-y-2">
        {pairs.slice(0, 6).map((pair) => (
          <li
            key={`${pair.clientAId}-${pair.clientBId}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D4AF37]/20 bg-[#001f3f]/40 px-3 py-2"
          >
            <span className="text-[11px] font-bold text-white/90">
              {pair.clientAName} ↔ {pair.clientBName}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#D4AF37]">
              {pair.sharedInterests[0] ? <InterestIcon interest={pair.sharedInterests[0]} size={12} /> : null}
              {pair.matchLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlaneSeatMockup({
  seatPairs,
  clients,
}: {
  seatPairs: FellowshipPairMatch[];
  clients: FellowshipClientDna[];
}) {
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.clientId, c])), [clients]);

  const rows = useMemo(() => {
    const assigned = new Set<number>();
    const result: { left: FellowshipClientDna | null; right: FellowshipClientDna | null; label?: string }[] = [];

    for (const pair of seatPairs) {
      if (assigned.has(pair.clientAId) || assigned.has(pair.clientBId)) continue;
      const a = clientMap.get(pair.clientAId) ?? null;
      const b = clientMap.get(pair.clientBId) ?? null;
      if (a && b) {
        result.push({ left: a, right: b, label: pair.matchLabel });
        assigned.add(pair.clientAId);
        assigned.add(pair.clientBId);
      }
    }

    for (const c of clients) {
      if (!assigned.has(c.clientId)) {
        result.push({ left: c, right: null });
        assigned.add(c.clientId);
      }
    }

    return result.slice(0, 5);
  }, [seatPairs, clients, clientMap]);

  return (
    <div className="rounded-2xl border border-[#D4AF37]/25 bg-gradient-to-b from-[#0a1628] to-[#001f3f] p-4">
      <div className="mb-3 flex items-center justify-center">
        <div className="h-8 w-24 rounded-t-[2rem] border border-[#D4AF37]/30 bg-[#D4AF37]/10" />
      </div>
      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <SeatChip client={row.left} side="يمين" />
            <span className="text-[9px] font-black text-[#D4AF37]/70">{String(idx + 1).padStart(2, '0')}</span>
            <SeatChip client={row.right} side="يسار" align="end" />
          </div>
        ))}
      </div>
      {rows.some((r) => r.label) ? (
        <p className="mt-3 text-center text-[10px] font-semibold text-[#D4AF37]/80">
          الأزواج المتطابقة بجانب بعض — لتنسيق الأرواح
        </p>
      ) : null}
    </div>
  );
}

function SeatChip({
  client,
  side,
  align = 'start',
}: {
  client: FellowshipClientDna | null;
  side: string;
  align?: 'start' | 'end';
}) {
  if (!client) {
    return <div className="h-12 rounded-xl border border-dashed border-white/10" />;
  }
  return (
    <div
      className={`rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-2 py-1.5 ${
        align === 'end' ? 'text-left' : 'text-right'
      }`}
    >
      <p className="truncate text-[10px] font-black text-white">{client.name}</p>
      <p className="text-[8px] font-semibold text-white/50">{side}</p>
      <ClientInterestBadges client={client} />
    </div>
  );
}

function DinnerTablesMockup({
  tables,
  clients,
}: {
  tables: { tableIndex: number; clientIds: number[]; label: string }[];
  clients: FellowshipClientDna[];
}) {
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.clientId, c])), [clients]);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {tables.map((table) => (
        <div
          key={table.tableIndex}
          className="relative rounded-2xl border border-[#D4AF37]/25 bg-[#121816] p-4 pt-8"
        >
          <div className="absolute left-1/2 top-3 h-14 w-14 -translate-x-1/2 rounded-full border-2 border-[#D4AF37]/50 bg-[#001f3f]/80 shadow-[0_0_20px_rgba(212,175,55,0.25)]" />
          <p className="relative z-10 mb-3 text-center text-[10px] font-black text-[#D4AF37]">
            طاولة {table.tableIndex}
          </p>
          <ul className="space-y-2">
            {table.clientIds.map((id) => {
              const c = clientMap.get(id);
              if (!c) return null;
              return (
                <li
                  key={id}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-right"
                >
                  <p className="text-[11px] font-bold text-white">{c.name}</p>
                  <ClientInterestBadges client={c} />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function GroupManagement({
  groupTripId,
  groupTitle,
  registeredClientIds,
  onRegisteredClientIdsChange,
  onClose,
}: GroupManagementProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>(() =>
    clampRegisteredClientIds(registeredClientIds, MAX_REGISTRANTS),
  );
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [clientDnaRows, setClientDnaRows] = useState<
    {
      id: number;
      name: string | null;
      travel_dna: unknown;
      dna_interests: string | null;
      dna_activity_level: string | null;
      flight_seat: string | null;
    }[]
  >([]);
  const [search, setSearch] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingDna, setLoadingDna] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    setSelectedIds(clampRegisteredClientIds(registeredClientIds, MAX_REGISTRANTS));
  }, [registeredClientIds]);

  const loadClientOptions = useCallback(async () => {
    setLoadingOptions(true);
    if (!supabase) {
      setClientOptions([]);
      setLoadingOptions(false);
      return;
    }
    const { data, error } = await supabase
      .from('clients')
      .select('id, name')
      .order('name', { ascending: true })
      .limit(200);
    if (error) {
      console.error('[Fellowship] clients list', error);
      setClientOptions([]);
    } else {
      setClientOptions(
        (data ?? [])
          .map((r) => ({ id: Number(r.id), name: String(r.name ?? '').trim() || `عميل #${r.id}` }))
          .filter((r) => Number.isFinite(r.id) && r.id > 0),
      );
    }
    setLoadingOptions(false);
  }, []);

  const loadClientDna = useCallback(async (ids: number[]) => {
    if (!ids.length || !supabase) {
      setClientDnaRows([]);
      return;
    }
    setLoadingDna(true);
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, travel_dna, dna_interests, dna_activity_level, flight_seat')
      .in('id', ids);
    if (error) {
      console.error('[Fellowship] DNA fetch', error);
      setClientDnaRows([]);
    } else {
      setClientDnaRows((data ?? []) as typeof clientDnaRows);
    }
    setLoadingDna(false);
  }, []);

  useEffect(() => {
    void loadClientOptions();
  }, [loadClientOptions]);

  useEffect(() => {
    void loadClientDna(selectedIds);
  }, [selectedIds, loadClientDna]);

  const matchResult = useMemo(() => computeFellowshipMatches(clientDnaRows), [clientDnaRows]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clientOptions;
    return clientOptions.filter((c) => c.name.toLowerCase().includes(q) || String(c.id).includes(q));
  }, [clientOptions, search]);

  function toggleClient(id: number) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_REGISTRANTS) return prev;
      return [...prev, id];
    });
    setSaveMsg(null);
  }

  async function saveRegistrants() {
    if (!supabase || !groupTripId) return;
    setSaving(true);
    setSaveMsg(null);
    const ids = clampRegisteredClientIds(selectedIds, MAX_REGISTRANTS);
    const { error } = await supabase
      .from('group_trips')
      .update({ registered_client_ids: ids } as never)
      .eq('id', groupTripId);
    setSaving(false);
    if (error) {
      const hint = error.message?.includes('registered_client_ids')
        ? ' — نفّذ supabase/sql/group_trips_registered_clients.sql'
        : '';
      setSaveMsg(`تعذّر الحفظ: ${error.message}${hint}`);
      return;
    }
    onRegisteredClientIdsChange?.(ids);
    setSaveMsg('تم حفظ المسجّلين بنجاح');
  }

  return (
    <div className="flex max-h-[90dvh] flex-col overflow-hidden rounded-2xl border border-[#D4AF37]/30 bg-[#0d1210] shadow-[0_24px_80px_rgba(0,0,0,0.55)]" dir="rtl">
      <header className="shrink-0 border-b border-[#D4AF37]/20 bg-gradient-to-l from-[#001f3f] to-[#1E2720] px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#D4AF37]/80">
              Fellowship Matching
            </p>
            <h2 className="mt-1 text-lg font-extrabold text-white sm:text-xl">
              ميزة التطابق البشري
            </h2>
            <p className="mt-1 text-xs font-semibold text-white/65">
              تنسيق الأرواح: مطابقة واكتشاف أصدقاء العمر — {groupTitle}
            </p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/15 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <section className="mb-6 rounded-2xl border border-white/10 bg-[#121816] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-black text-[#D4AF37]">
              <Users className="h-4 w-4" />
              المسجّلون في الرحلة ({selectedIds.length}/{MAX_REGISTRANTS})
            </h3>
            <button
              type="button"
              disabled={saving || !groupTripId}
              onClick={() => void saveRegistrants()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#D4AF37] px-4 py-2 text-xs font-black text-[#001f3f] transition hover:brightness-105 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              حفظ القائمة
            </button>
          </div>

          {saveMsg ? (
            <p
              className={`mb-3 text-xs font-bold ${
                saveMsg.includes('تعذّر') ? 'text-red-300' : 'text-emerald-300'
              }`}
            >
              {saveMsg}
            </p>
          ) : null}

          <div className="relative mb-3">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث عن عميل…"
              className="w-full rounded-xl border border-white/10 bg-[#0d1210] py-2.5 pe-3 ps-10 text-right text-sm font-semibold text-white outline-none focus:border-[#D4AF37]/50"
            />
          </div>

          {loadingOptions ? (
            <div className="flex items-center justify-center py-8 text-white/50">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/5 p-2">
              {filteredOptions.map((c) => {
                const checked = selectedIds.includes(c.id);
                const disabled = !checked && selectedIds.length >= MAX_REGISTRANTS;
                return (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 transition ${
                      checked ? 'bg-[#D4AF37]/15' : 'hover:bg-white/5'
                    } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
                  >
                    <span className="text-xs font-bold text-white">{c.name}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleClient(c.id)}
                      className="h-4 w-4 accent-[#D4AF37]"
                    />
                  </label>
                );
              })}
            </div>
          )}
        </section>

        {loadingDna ? (
          <div className="flex flex-col items-center justify-center py-16 text-white/50">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-[#D4AF37]" />
            <p className="text-sm font-semibold">تحليل DNA السياحي…</p>
          </div>
        ) : selectedIds.length < 2 ? (
          <div className="rounded-2xl border border-dashed border-[#D4AF37]/30 px-6 py-12 text-center">
            <p className="text-sm font-bold text-white/70">
              اختر عميلين على الأقل لبدء التطابق البشري
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-[#D4AF37]/20 bg-[#121816] p-4 sm:p-5">
              <h3 className="mb-4 text-sm font-black text-[#D4AF37]">خريطة التوافق — DNA Graph</h3>
              <FellowshipNodeGraph clients={matchResult.clients} pairs={matchResult.pairs} />
            </section>

            <section className="rounded-2xl border border-[#D4AF37]/20 bg-[#121816] p-4 sm:p-5">
              <h3 className="mb-4 text-sm font-black text-[#D4AF37]">توزيع مقاعد الطائرة</h3>
              <PlaneSeatMockup seatPairs={matchResult.seatPairs} clients={matchResult.clients} />
            </section>

            <section className="rounded-2xl border border-[#D4AF37]/20 bg-[#121816] p-4 sm:p-5">
              <h3 className="mb-4 text-sm font-black text-[#D4AF37]">طاولات العشاء</h3>
              <DinnerTablesMockup tables={matchResult.dinnerTables} clients={matchResult.clients} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
