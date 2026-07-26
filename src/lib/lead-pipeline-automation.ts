import type { SupabaseClient } from '@supabase/supabase-js';

import {
  LEAD_KANBAN_DB_STATUS,
  leadStatusPipelineIndex,
  normalizeLeadStatus,
  type LeadKanbanColumnId,
  type LeadStatus,
} from '@/lib/leads-kanban';

/**
 * يحدّث leads.status حسب آلة الحالات الرئيسية (SSOT: `@/lib/lead-status`).
 * لا يسحب البطاقة للخلف إلا مع force (ما عدا الرفض من الرادار).
 */
export async function setLeadPipelineStatus(
  sb: SupabaseClient,
  opts: {
    leadId?: string | null;
    clientId?: string | number | null;
    force?: boolean;
  },
  status: LeadStatus | LeadKanbanColumnId,
): Promise<void> {
  const next = (LEAD_KANBAN_DB_STATUS[status as LeadKanbanColumnId] ?? status) as LeadStatus;
  const leadId = String(opts.leadId ?? '').trim();
  const clientRaw = opts.clientId;
  const clientId =
    clientRaw != null && String(clientRaw).trim() !== '' ? clientRaw : null;

  if (!leadId && clientId == null) return;

  const targetIdx = leadStatusPipelineIndex(next);
  const isTerminalArchive = next === 'radar_rejected' || next === 'postponed';

  if (leadId) {
    if (!opts.force && !isTerminalArchive && targetIdx >= 0) {
      const { data: row } = await sb.from('leads').select('status').eq('id', leadId).maybeSingle();
      const currentIdx = leadStatusPipelineIndex((row as { status?: string } | null)?.status);
      if (currentIdx > targetIdx) return;
    }
    const { error } = await sb.from('leads').update({ status: next }).eq('id', leadId);
    if (error && !/column|schema cache|does not exist|check/i.test(error.message ?? '')) {
      console.warn('[lead-pipeline] update by leadId:', error.message);
    }
    return;
  }

  const { data: rows, error: listErr } = await sb
    .from('leads')
    .select('id, status')
    .eq('client_id', clientId!);

  if (listErr) {
    if (!/column|schema cache|does not exist/i.test(listErr.message ?? '')) {
      console.warn('[lead-pipeline] list by clientId:', listErr.message);
    }
    return;
  }

  for (const row of rows ?? []) {
    const id = String((row as { id?: string }).id ?? '').trim();
    if (!id) continue;
    const current = normalizeLeadStatus((row as { status?: string }).status);
    if ((current === 'radar_rejected' || current === 'postponed') && !opts.force && !isTerminalArchive) {
      continue;
    }
    const currentIdx = leadStatusPipelineIndex(current);
    if (!opts.force && !isTerminalArchive && currentIdx > targetIdx) continue;
    const { error } = await sb.from('leads').update({ status: next }).eq('id', id);
    if (error && !/column|schema cache|does not exist|check/i.test(error.message ?? '')) {
      console.warn('[lead-pipeline] update lead', id, error.message);
    }
  }
}
