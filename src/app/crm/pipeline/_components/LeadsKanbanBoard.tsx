'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import { CalendarDays, Clock, Loader2, MapPin, RefreshCw, Trash2, UserRound } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import {
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
  'preparing_itinerary',
  'delivered',
]);

function emptyColumns(): ColumnsState {
  return {
    awaiting_dna: [],
    meeting: [],
    quote_stage: [],
    awaiting_payment: [],
    preparing_itinerary: [],
    delivered: [],
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
}: {
  lead: CrmKanbanLead;
  index: number;
  onRemoved: (leadId: string) => void;
}) {
  const [busy, setBusy] = useState<'postpone' | 'delete' | null>(null);
  const destination = joinDestinations(lead.destinations);
  const travelDate = formatTravelDateArabic(lead.travel_date);
  const clientHref =
    lead.client_id != null ? `/crm/clients/${lead.client_id}` : `/crm/radar`;
  const missingRoute =
    (lead.kanbanStatus === 'delivered' || lead.kanbanStatus === 'preparing_itinerary') &&
    !lead.hasLinkedItinerary;

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

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <article
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`relative rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
            missingRoute
              ? 'border-rose-300 bg-rose-50/40 ring-1 ring-rose-200'
              : 'border-gray-100'
          } ${snapshot.isDragging ? 'shadow-lg ring-2 ring-[#C5A059]/40' : ''}`}
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
                className="block truncate text-sm font-black text-slate-900 hover:text-[#1E2720]"
              >
                {lead.full_name || 'عميل بدون اسم'}
              </Link>
              <p className="mt-1.5 flex items-start gap-1.5 text-sm font-bold text-slate-800">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span className="line-clamp-2">{destination}</span>
              </p>
            </div>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[10px] font-black text-slate-600"
              title={
                lead.expertName ? `الخبير: ${lead.expertName}` : 'لم يُعيَّن خبير بعد'
              }
            >
              {lead.expertInitials ? (
                lead.expertInitials
              ) : (
                <UserRound className="h-3.5 w-3.5 text-slate-400" />
              )}
            </div>
          </div>

          {lead.expertName ? (
            <p className="mt-2 truncate text-[10px] font-bold text-slate-400">
              خبير: {lead.expertName}
            </p>
          ) : null}

          {missingRoute ? (
            <div className="mt-2 rounded-md bg-rose-100 px-2 py-1.5 text-[11px] font-black leading-snug text-rose-700">
              ⚠️ تحذير: لا يوجد مسار فعلي مرتبط بهذا الطلب!
            </div>
          ) : null}

          {/* Always-visible quick actions — no hover dependency */}
          <div
            className="relative z-20 mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => void handleDelete(e)}
                disabled={busy !== null}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-bold text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
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
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-bold text-amber-600 transition-colors hover:bg-amber-50 disabled:opacity-50"
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
            <p className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-slate-400">
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

  const removeCard = useCallback((leadId: string) => {
    setColumns((prev) => removeLeadFromColumns(prev, leadId));
    setOrphanRouteLeads((prev) => prev.filter((l) => l.id !== leadId));
    setAllLeads((prev) => prev.filter((l) => l.id !== leadId));
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
      } catch (err) {
        setColumns(snapshot);
        toast.error(err instanceof Error ? err.message : 'فشل حفظ الحالة');
      }
    },
    [columns],
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm font-bold">جاري تحميل لوحة الطلبات…</span>
      </div>
    );
  }

  return (
    <div dir="rtl">
      <Toaster position="top-center" />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-wide text-amber-700/90">PIPELINE</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">لوحة طلبات الرحلات</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            مسار المبيعات الموحّد — اسحب البطاقة لتحديث الحالة · {totalCount} طلب
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
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
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
          {error}
        </div>
      ) : null}
      {warning ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          {warning}
        </div>
      ) : null}

      {orphanRouteLeads.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-sm font-bold text-rose-900">
            {orphanRouteLeads.length} طلب بحالة «تجهيز المسار / تم التسليم» بدون مسار فعلي في
            جدول itineraries
            {!showOrphanRoutes ? ' — مخفية عن اللوحة.' : ' — ظاهرة بتحذير أحمر للتنظيف.'}
          </p>
          <button
            type="button"
            onClick={() => setShowOrphanRoutes((v) => !v)}
            className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-black text-rose-800 transition hover:bg-rose-100"
          >
            {showOrphanRoutes ? 'إخفاء الطلبات الوهمية' : 'إظهار للتنظيف'}
          </button>
        </div>
      ) : null}

      <DragDropContext onDragEnd={(r) => void onDragEnd(r)}>
        <div className="flex h-[calc(100vh-200px)] gap-6 overflow-x-auto pb-4">
          {LEAD_KANBAN_COLUMNS.map((col) => {
            const tone = leadKanbanColumnToneClass(col.tone);
            const cards = columns[col.id];
            return (
              <section
                key={col.id}
                className="flex w-[280px] shrink-0 flex-col rounded-2xl border border-slate-100 bg-[#F4F5F3]/80"
              >
                <header
                  className={`flex items-center justify-between gap-2 rounded-t-2xl border-b px-4 py-3 ${tone.header}`}
                >
                  <h2 className="text-sm font-black text-slate-900">{col.label}</h2>
                  <span
                    className={`inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-black ${tone.badge}`}
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
                        <p className="px-1 py-6 text-center text-xs font-semibold text-slate-400">
                          لا توجد بطاقات
                        </p>
                      ) : null}
                      {cards.map((lead, index) => (
                        <KanbanCard
                          key={lead.id}
                          lead={lead}
                          index={index}
                          onRemoved={removeCard}
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
