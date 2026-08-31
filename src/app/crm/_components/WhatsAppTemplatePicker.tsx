'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';

import {
  launchWhatsAppTemplate,
  WHATSAPP_TEMPLATE_OPTIONS,
  type WhatsAppTemplateId,
} from '@/lib/whatsapp-templates';
import { updatePipelineStatus } from '@/lib/lead-pipeline-automation';
import { supabase } from '@/lib/supabase';

type Props = {
  phone?: string | null;
  clientName: string;
  tripTitle: string;
  quoteId: string;
  leadId?: string | null;
  clientId?: string | number | null;
  disabled?: boolean;
  className?: string;
  onLaunched?: () => void;
  onError?: (message: string) => void;
};

export default function WhatsAppTemplatePicker({
  phone,
  clientName,
  tripTitle,
  quoteId,
  leadId = null,
  clientId = null,
  disabled = false,
  className = '',
  onLaunched,
  onError,
}: Props) {
  const [value, setValue] = useState('');

  const handleChange = (next: string) => {
    if (!next) return;

    if (!quoteId) {
      onError?.('معرّف العرض غير صالح.');
      setValue('');
      return;
    }

    launchWhatsAppTemplate({
      templateId: next as WhatsAppTemplateId,
      phone,
      clientName,
      tripTitle,
      quoteId,
    });

    if (supabase && (leadId || clientId != null)) {
      void updatePipelineStatus(supabase, { leadId, clientId, force: true }, 'awaiting_payment').catch((err) =>
        console.warn('[quote-whatsapp] lead pipeline:', err),
      );

      void supabase
        .from('quotations')
        .update({ status: 'awaiting_payment', updated_at: new Date().toISOString() })
        .eq('id', quoteId)
        .then(({ error }) => {
          if (error) console.warn('[quote-whatsapp] quotation status:', error.message);
        });
    }

    onLaunched?.();
    setValue('');
  };

  return (
    <div className={`relative min-w-[9.5rem] ${className}`}>
      <MessageCircle
        className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-600 dark:text-[#D4AF37]"
        aria-hidden
      />
      <select
        value={value}
        disabled={disabled || !quoteId}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pe-8 ps-8 text-xs font-medium text-slate-700 shadow-sm outline-none transition hover:bg-slate-50 focus:border-slate-300 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2D3F3A] dark:bg-[#2A3834] dark:text-gray-200 dark:hover:border-[#D4AF37]/30 dark:focus:border-[#D4AF37]/40 dark:focus:ring-[#D4AF37]/15"
        aria-label="قوالب واتساب"
        title={phone ? 'إرسال قالب واتساب للعميل' : 'فتح واتساب بدون رقم — ألصق الرقم يدوياً'}
      >
        <option value="">قوالب واتساب</option>
        {WHATSAPP_TEMPLATE_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 dark:text-[#D4AF37]/70"
        aria-hidden
      >
        ▾
      </span>
    </div>
  );
}
