'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, Plus, Save, Send } from 'lucide-react';

import {
  VIP_BTN_GHOST,
  VIP_BTN_GOLD,
  VIP_BTN_OLIVE,
  VIP_INPUT,
} from '@/app/crm/itineraries/[id]/edit/vip-crm-theme';
import { supabase } from '@/lib/supabase';
import { parseBypass24hLock } from '@/lib/vip-vault-reveal';
import type { ItineraryDraft } from '@/lib/itinerary-builder-model';

type Props = {
  editId: string;
  draft: ItineraryDraft;
  onDraftPatch: (patch: Partial<ItineraryDraft>) => void;
  saving: boolean;
  broadcasting: boolean;
  notice: string | null;
  bypass24hLock: boolean;
  onBypassChange: (value: boolean) => void;
  onAddDay: () => void;
  onSave: () => void;
  onBroadcast: () => void;
};

export default function ItineraryEditDashboardHeader({
  editId,
  draft,
  onDraftPatch,
  saving,
  broadcasting,
  notice,
  bypass24hLock,
  onBypassChange,
  onAddDay,
  onSave,
  onBroadcast,
}: Props) {
  const [lockSaving, setLockSaving] = useState(false);
  const queryId = /^\d+$/.test(editId) ? Number(editId) : editId;

  const toggleLock = useCallback(
    async (next: boolean) => {
      if (!supabase) return;
      setLockSaving(true);
      try {
        const { error } = await supabase
          .from('itineraries')
          .update({ bypass_24h_lock: next })
          .eq('id', queryId);
        if (!error) onBypassChange(next);
      } finally {
        setLockSaving(false);
      }
    },
    [queryId, onBypassChange],
  );

  return (
    <header className="sticky top-0 z-50 border-b border-[#D4AF37] bg-[#FAFAFA] shadow-sm">
      <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Link href="/crm/itineraries" className={VIP_BTN_GHOST}>
            <ArrowRight className="h-4 w-4" aria-hidden />
            المسارات
          </Link>
          <input
            value={draft.title}
            onChange={(e) => onDraftPatch({ title: e.target.value })}
            placeholder="عنوان الرحلة"
            className={`${VIP_INPUT} max-w-[200px]`}
          />
          <input
            value={draft.customerName}
            onChange={(e) => onDraftPatch({ customerName: e.target.value })}
            placeholder="اسم العميل"
            className={`${VIP_INPUT} max-w-[160px]`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-[#D4AF37] bg-white px-3 py-2">
            <span className="text-[10px] font-bold text-[#1E2720]">فتح 24س للعميل</span>
            <button
              type="button"
              role="switch"
              aria-checked={bypass24hLock}
              disabled={lockSaving}
              onClick={() => void toggleLock(!bypass24hLock)}
              className={`relative h-6 w-11 rounded-full transition ${
                bypass24hLock ? 'bg-slate-100' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-[#D4AF37] shadow transition ${
                  bypass24hLock ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
          </label>

          <button type="button" onClick={onAddDay} className={VIP_BTN_GHOST}>
            <Plus className="h-4 w-4 text-[#D4AF37]" aria-hidden />
            إضافة يوم
          </button>
          <button type="button" onClick={onSave} disabled={saving} className={VIP_BTN_OLIVE}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            حفظ المسار
          </button>
          <button
            type="button"
            onClick={onBroadcast}
            disabled={broadcasting || saving}
            className={VIP_BTN_GOLD}
          >
            {broadcasting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            بث المسار للعميل
          </button>
        </div>
      </div>

      {notice ? (
        <p className="border-t border-[#D4AF37]/30 bg-white px-4 py-2 text-center text-xs font-bold text-[#1E2720] sm:px-6">
          {notice}
        </p>
      ) : null}
    </header>
  );
}

export function bypassLockFromRow(row: Record<string, unknown>): boolean {
  return parseBypass24hLock(row.bypass_24h_lock ?? row.bypass24hLock);
}
