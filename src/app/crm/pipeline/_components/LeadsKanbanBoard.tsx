'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import { CalendarDays, Clock, Loader2, MapPin, RefreshCw, Rocket, Settings, Trash2, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';

import {
  createItineraryForKanbanLead,
  formatTravelDateArabic,
  fetchKanbanCrmLeads,
  joinDestinations,
  updateLeadKanbanStatus,
  type CrmKanbanLead,
} from '@/lib/crm-leads';
import {
  LEAD_KANBAN_COLUMNS,
  isLeadKanbanColumnId,
  leadKanbanColumnToneClass,
  type LeadKanbanColumnId,
} from '@/lib/leads-kanban';
import { supabase } from '@/lib/supabase';

type ColumnsState = Record<LeadKanbanColumnId, CrmKanbanLead[]>;

/** Stages that must have a real itineraries row to appear on the board */
const ROUTE_LINKED_COLUMNS: ReadonlySet<LeadKanbanColumnId> = new Set([
  // payment_confirmed is allowed before an itinerary exists
]);

function emptyColumns(): ColumnsState {
  return {
    awaiting_dna: [],
    meeting: [],
    quote_stage: [],
    awaiting_payment: [],
    payment_confirmed: [],
  };
}

function isOrphanRouteLead(lead: CrmKanbanLead): boolean {
  return ROUTE_LINKED_COLUMNS.has(lead.kanbanStatus) && !lead.hasLinkedItinerary;
}

function groupLeads(
  leads: CrmKanbanLead[],
  opts?: { includeOrphanRoutes?: boolean },
): { columns: ColumnsState; orphanRouteLeads: CrmKanbanLead[] } {
  const next = emptyColumns();
  const orphanRouteLeads: CrmKanbanLead[] = [];
  const includeOrphans = opts?.includeOrphanRoutes === true;

  for (const lead of leads) {
    if (isOrphanRouteLead(lead)) {
      orphanRouteLeads.push(lead);
      if (!includeOrphans) continue;
    }
    next[lead.kanbanStatus].push(lead);
  }

  // Orphans first so cleanup is obvious when revealed
  for (const col of ROUTE_LINKED_COLUMNS) {
    next[col].sort((a, b) => Number(a.hasLinkedItinerary) - Number(b.hasLinkedItinerary));
  }

  return { columns: next, orphanRouteLeads };
}

function removeLeadFromColumns(columns: ColumnsState, leadId: string): ColumnsState {
  const next = emptyColumns();
  for (const col of LEAD_KANBAN_COLUMNS) {
    next[col.id] = columns[col.id].filter((l) => l.id !== leadId);
  }
  return next;
}

function KanbanCard({
  lead,
  index,
  onRemoved,
  onItineraryLinked,
}: {
  lead: CrmKanbanLead;
  index: number;
  onRemoved: (leadId: string) => void;
  onItineraryLinked: (leadId: string, itineraryId: string) => void;
}) {
  const [busy, setBusy] = useState<'postpone' | 'delete' | 'route' | 'generate' | null>(null);
  const destination = joinDestinations(lead.destinations);
  const travelDate = formatTravelDateArabic(lead.travel_date);
  const clientHref =
    lead.client_id != null ? `/crm/clients/${lead.client_id}` : `/crm/radar`;
  const isFinalStage = lead.kanbanStatus === 'payment_confirmed';
  const missingRoute = isFinalStage && !lead.hasLinkedItinerary;
  const itineraryHref = lead.linkedItineraryId
    ? `/crm/itineraries/${encodeURIComponent(lead.linkedItineraryId)}/edit`
    : '/crm/itineraries';

  const handlePostpone = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    if (!window.confirm('هل تريد تأجيل هذا الطلب وإخفاءه من اللوحة النشطة؟')) return;
    if (!supabase) {
      toast.error('Supabase غير مهيأ.');
      return;
    }
    setBusy('postpone');
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: 'postponed' })
        .eq('id', lead.id);
      if (error) throw error;
      toast.success('تم تأجيل الطلب ⏳');
      onRemoved(lead.id);
    } catch (err) {
      console.error('[kanban postpone]', err);
      toast.error(err instanceof Error ? err.message : 'حدث خطأ أثناء التأجيل');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    if (
      !window.confirm(
        'تحذير: هل أنت متأكد من مسح هذا الطلب الوهمي نهائياً من قاعدة البيانات؟',
      )
    ) {
      return;
    }
    if (!supabase) {
      toast.error('Supabase غير مهيأ.');
      return;
    }
    setBusy('delete');
    try {
      const { error } = await supabase.from('leads').delete().eq('id', lead.id);
      if (error) throw error;
      toast.success('تم الحذف النهائي وتطهير النظام 🧹');
      onRemoved(lead.id);
    } catch (err) {
      console.error('[kanban hard delete]', err);
      toast.error(err instanceof Error ? err.message : 'حدث خطأ أثناء الحذف');
    } finally {
      setBusy(null);
    }
  };

  const generateItinerary = async (): Promise<string | null> => {
    if (!supabase) {
      toast.error('Supabase غير مهيأ.');
      return null;
    }
    try {
      const itineraryId = await createItineraryForKanbanLead(
        supabase,
        lead.id,
        lead.client_id,
      );
      onItineraryLinked(lead.id, itineraryId);
      return itineraryId;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`خطأ في توليد المسار: ${message}`, { duration: 8000 });
      throw err;
    }
  };

  const handleGenerateItinerary = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy('generate');
    try {
      const id = await generateItinerary();
      if (id) toast.success('تم توليد المسار بنجاح ⚙️');
    } catch {
      /* toast already shown */
    } finally {
      setBusy(null);
    }
  };

  const handleOpenItinerary = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    if (lead.linkedItineraryId) {
      window.open(itineraryHref, '_blank', 'noopener,noreferrer');
      return;
    }

    setBusy('route');
    try {
      const id = await generateItinerary();
      if (!id) return;
      toast.success('تم إنشاء المسار — جاري الفتح 🚀');
      window.open(
        `/crm/itineraries/${encodeURIComponent(id)}/edit`,
        '_blank',
        'noopener,noreferrer',
      );
    } catch {
      /* toast already shown */
    } finally {
      setBusy(null);
    }
  };

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <article
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`relative rounded-xl border p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-[#D4AF37]/50 ${
            missingRoute
              ? 'border-rose-300 bg-rose-50/40 ring-1 ring-rose-200 dark:border-rose-800/60 dark:bg-rose-950/30 dark:ring-rose-900/40'
              : 'border-slate-200 bg-white dark:border-[#2D3F3A] dark:bg-[#22302C]'
          } ${snapshot.isDragging ? 'shadow-lg ring-2 ring-[#D4AF37]/40' : ''}`}
          dir="rtl"
        >
          <div
            {...provided.dragHandleProps}
            className={`flex items-start justify-between gap-3 ${
              snapshot.isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            <div className="min-w-0 flex-1">
              <Link
                href={clientHref}
                onClick={(e) => e.stopPropagation()}
                className="mb-1 block truncate text-base font-bold text-slate-900 hover:text-[#D4AF37] dark:text-white"
              >
                {lead.full_name || 'عميل بدون اسم'}
              </Link>
              <p className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" />
                <span className="line-clamp-2">{destination}</span>
              </p>
            </div>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-600 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-[#D4AF37]"
              title={
                lead.expertName ? `الخبير: ${lead.expertName}` : 'لم يُعيَّن خبير بعد'
              }
            >
              {lead.expertInitials ? (
                lead.expertInitials
              ) : (
                <UserRound className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              )}
            </div>
          </div>

          {lead.expertName ? (
            <p className="mt-2 truncate text-[10px] font-medium text-slate-400 dark:text-slate-500">
              خبير: {lead.expertName}
            </p>
          ) : null}

          {missingRoute ? (
            <div className="mt-2 rounded-md bg-rose-100 px-2 py-1.5 text-[11px] font-bold leading-snug text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              تحذير: لا يوجد مسار فعلي مرتبط بهذا الطلب
            </div>
          ) : null}

          {isFinalStage && lead.linkedItineraryId ? (
            <button
              type="button"
              onClick={(e) => void handleOpenItinerary(e)}
              disabled={busy !== null}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {busy === 'route' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Rocket className="h-3.5 w-3.5" aria-hidden />
              )}
              فتح المسار
            </button>
          ) : null}

          {missingRoute ? (
            <button
              type="button"
              onClick={(e) => void handleGenerateItinerary(e)}
              disabled={busy !== null}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900 shadow-sm transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200"
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {busy === 'generate' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Settings className="h-3.5 w-3.5" aria-hidden />
              )}
              توليد المسار
            </button>
          ) : null}

          <div
            className="relative z-20 mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-[#2D3F3A]"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => void handleDelete(e)}
                disabled={busy !== null}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-rose-500 disabled:opacity-50 dark:text-slate-400 dark:hover:text-rose-400"
                title="حذف الطلب الوهمي"
              >
                {busy === 'delete' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                )}
                حذف
              </button>
              <button
                type="button"
                onClick={(e) => void handlePostpone(e)}
                disabled={busy !== null}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-amber-600 disabled:opacity-50 dark:text-slate-400 dark:hover:text-amber-400"
                title="تأجيل العميل"
              >
                {busy === 'postpone' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                )}
                تأجيل
              </button>
            </div>
            <p className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">
              <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
              <span className="max-w-[7.5rem] truncate">{travelDate}</span>
            </p>
          </div>
        </article>
      )}
    </Draggable>
  );
}

export function LeadsKanbanBoard() {
  const [columns, setColumns] = useState<ColumnsState>(emptyColumns);
  const [orphanRouteLeads, setOrphanRouteLeads] = useState<CrmKanbanLead[]>([]);
  const [showOrphanRoutes, setShowOrphanRoutes] = useState(false);
  const [allLeads, setAllLeads] = useState<CrmKanbanLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const totalCount = useMemo(
    () => LEAD_KANBAN_COLUMNS.reduce((sum, col) => sum + columns[col.id].length, 0),
    [columns],
  );

  const applyLeads = useCallback((leads: CrmKanbanLead[], includeOrphans: boolean) => {
    const grouped = groupLeads(leads, { includeOrphanRoutes: includeOrphans });
    setColumns(grouped.columns);
    setOrphanRouteLeads(grouped.orphanRouteLeads);
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!supabase) {
      setError('Supabase غير مهيأ.');
      setLoading(false);
      return;
    }
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await fetchKanbanCrmLeads(supabase);
      setAllLeads(result.leads);
      setWarning(result.warning ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل اللوحة.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    applyLeads(allLeads, showOrphanRoutes);
  }, [allLeads, showOrphanRoutes, applyLeads]);

  // Live refresh when leads / quotations / invoices change
  useEffect(() => {
    if (!supabase) return;

    let debounceTimer: number | undefined;
    const softRefresh = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        void load(true);
      }, 400);
    };

    const channel = supabase
      .channel('crm-kanban-pipeline')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        softRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quotations' },
        softRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices' },
        softRefresh,
      )
      .subscribe();

    const onFocus = () => void load(true);
    window.addEventListener('focus', onFocus);

    return () => {
      window.clearTimeout(debounceTimer);
      window.removeEventListener('focus', onFocus);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const removeCard = useCallback((leadId: string) => {
    setColumns((prev) => removeLeadFromColumns(prev, leadId));
    setOrphanRouteLeads((prev) => prev.filter((l) => l.id !== leadId));
    setAllLeads((prev) => prev.filter((l) => l.id !== leadId));
  }, []);

  const linkItinerary = useCallback((leadId: string, itineraryId: string) => {
    const patch = (lead: CrmKanbanLead): CrmKanbanLead =>
      lead.id === leadId
        ? {
            ...lead,
            linkedItineraryId: itineraryId,
            hasLinkedItinerary: true,
            linkedItineraryCount: Math.max(1, lead.linkedItineraryCount),
          }
        : lead;
    setAllLeads((prev) => prev.map(patch));
    setColumns((prev) => {
      const next = emptyColumns();
      for (const col of LEAD_KANBAN_COLUMNS) {
        next[col.id] = prev[col.id].map(patch);
      }
      return next;
    });
  }, []);

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination) return;
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }
      if (!isLeadKanbanColumnId(source.droppableId)) return;
      if (!isLeadKanbanColumnId(destination.droppableId)) return;

      const fromCol = source.droppableId;
      const toCol = destination.droppableId;
      const snapshot = columns;

      const next = emptyColumns();
      for (const col of LEAD_KANBAN_COLUMNS) {
        next[col.id] = [...snapshot[col.id]];
      }
      const [card] = next[fromCol].splice(source.index, 1);
      if (!card) return;
      next[toCol].splice(destination.index, 0, {
        ...card,
        kanbanStatus: toCol,
        status: toCol,
      });

      // Optimistic UI
      setColumns(next);

      if (fromCol === toCol) return;

      if (!supabase) {
        setColumns(snapshot);
        toast.error('Supabase غير مهيأ.');
        return;
      }

      try {
        await updateLeadKanbanStatus(supabase, draggableId, toCol);
        setAllLeads((prev) =>
          prev.map((l) =>
            l.id === draggableId
              ? { ...l, kanbanStatus: toCol, status: toCol }
              : l,
          ),
        );
        toast.success('تم تحديث حالة الطلب');

        // FORCE: drop into final column → auto-create itinerary (visible errors)
        if (toCol === 'payment_confirmed') {
          try {
            const itineraryId = await createItineraryForKanbanLead(
              supabase,
              draggableId,
              card.client_id,
            );
            linkItinerary(draggableId, itineraryId);
            toast.success('تم توليد المسار تلقائياً 🚀');
          } catch (itineraryErr) {
            const message =
              itineraryErr instanceof Error
                ? itineraryErr.message
                : String(itineraryErr);
            toast.error(`خطأ في توليد المسار: ${message}`, { duration: 9000 });
          }
        }
      } catch (err) {
        setColumns(snapshot);
        toast.error(err instanceof Error ? err.message : 'فشل حفظ الحالة');
      }
    },
    [columns, linkItinerary],
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" />
        <span className="text-sm font-medium">جاري تحميل لوحة الطلبات…</span>
      </div>
    );
  }

  return (
    <div dir="rtl" className="max-w-full overflow-x-hidden">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400 dark:text-[#D4AF37]/80">
            Pipeline
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            لوحة طلبات الرحلات
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            مسار المبيعات الموحّد — اسحب البطاقة لتحديث الحالة ·{' '}
            {totalCount.toLocaleString('ar-SA')} طلب
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-slate-200 dark:hover:bg-[#1A2421]"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          تحديث
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : null}
      {warning ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200">
          {warning}
        </div>
      ) : null}

      {orphanRouteLeads.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/40 dark:bg-rose-950/30">
          <p className="text-sm font-medium text-rose-900 dark:text-rose-200">
            {orphanRouteLeads.length} طلب بحالة «تجهيز المسار / تم التسليم» بدون مسار فعلي في
            جدول itineraries
            {!showOrphanRoutes ? ' — مخفية عن اللوحة.' : ' — ظاهرة بتحذير للتنظيف.'}
          </p>
          <button
            type="button"
            onClick={() => setShowOrphanRoutes((v) => !v)}
            className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-[#1A2421] dark:text-rose-200 dark:hover:bg-rose-950/50"
          >
            {showOrphanRoutes ? 'إخفاء الطلبات الوهمية' : 'إظهار للتنظيف'}
          </button>
        </div>
      ) : null}

      <DragDropContext onDragEnd={(r) => void onDragEnd(r)}>
        <div className="pipeline-columns-scroll no-scrollbar flex h-[calc(100vh-200px)] max-w-full gap-6 overflow-x-auto overflow-y-hidden pb-6">
          {LEAD_KANBAN_COLUMNS.map((col) => {
            const tone = leadKanbanColumnToneClass(col.tone);
            const cards = columns[col.id];
            return (
              <section
                key={col.id}
                className="flex w-[280px] shrink-0 flex-col rounded-2xl border border-slate-200 bg-slate-100/80 p-0 transition-all dark:border-[#2D3F3A] dark:bg-[#1A2421]"
              >
                <header
                  className={`flex items-center justify-between gap-2 rounded-t-2xl border-b px-4 py-3 ${tone.header}`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${tone.accentDot}`}
                      aria-hidden
                    />
                    <h2 className="truncate text-base font-bold text-slate-800 dark:text-gray-100">
                      {col.label}
                    </h2>
                  </div>
                  <span
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${tone.badge}`}
                  >
                    {cards.length}
                  </span>
                </header>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex flex-1 flex-col gap-3 overflow-y-auto p-3 transition ${
                        snapshot.isDraggingOver ? `ring-2 ring-inset ${tone.drop}` : ''
                      }`}
                    >
                      {cards.length === 0 ? (
                        <p className="px-1 py-6 text-center text-xs font-medium text-slate-400 dark:text-slate-500">
                          لا توجد بطاقات
                        </p>
                      ) : null}
                      {cards.map((lead, index) => (
                        <KanbanCard
                          key={lead.id}
                          lead={lead}
                          index={index}
                          onRemoved={removeCard}
                          onItineraryLinked={linkItinerary}
                        />
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </section>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
