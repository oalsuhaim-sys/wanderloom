import type { SupabaseClient } from '@supabase/supabase-js';

import { isQuotationStatusApproved, normalizeQuotationId } from '@/lib/crm-quotations';
import {
  canonicalizeReferralCode,
  normalizeAffiliateRef,
  referralCodeLookupVariants,
} from '@/lib/referral-url';
import { resolveCommissionRate } from '@/lib/partner-commission';
import { addClientWalletTransaction } from '@/lib/vip-wallet-ledger';

/** مكافأة المحفظة للمُحيل عند تأكيد الحجز (عروض الأسعار) */
export const REFERRAL_REWARD_AMOUNT_SAR = 500;

/** مكافأة إحالة عند موافقة طلب مجموعة وترحيله للعملاء */
export const REFERRAL_APPROVAL_BONUS_SAR = 150;

export type ReferralRewardResult = {
  processed: boolean;
  reason?: string;
  referrerId?: string;
  amount?: number;
  referrerRole?: 'leader' | 'expert' | 'client';
};

export type PartnerReferrerRole = 'leader' | 'expert';

/** Extract referral code from lead column or final_thoughts note. */
export function extractReferralCodeFromLead(
  lead: Record<string, unknown> | null | undefined,
): string | null {
  if (!lead) return null;
  const direct = normalizeAffiliateRef(
    String(lead.referral_code ?? lead.referralCode ?? '').trim(),
  );
  if (direct) return direct;

  const thoughts = String(lead.final_thoughts ?? '');
  const fromNotes =
    /كود الإحالة:\s*([A-Za-z0-9][A-Za-z0-9_-]{1,62})/i.exec(thoughts)?.[1] ??
    /referral[_ ]?code[:\s]+([A-Za-z0-9][A-Za-z0-9_-]{1,62})/i.exec(thoughts)?.[1];
  return normalizeAffiliateRef(fromNotes);
}

export function isQuotationReferralTriggerStatus(raw: unknown): boolean {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return false;
  if (isQuotationStatusApproved(raw)) return true;
  if (s === 'confirmed' || s === 'paid') return true;
  return s.includes('اعتماد') || s.includes('مؤكد') || s.includes('مدفو');
}

function normalizeReferralCode(raw: unknown): string {
  return String(raw ?? '').trim();
}

function referralCodesEqual(a: unknown, b: unknown): boolean {
  const left = canonicalizeReferralCode(String(a ?? ''));
  const right = canonicalizeReferralCode(String(b ?? ''));
  return Boolean(left && right && left === right);
}

async function resolveReferralCodeForQuotation(
  supabase: SupabaseClient,
  quote: {
    referral_code?: unknown;
    client_id?: unknown;
  },
): Promise<string | null> {
  const fromQuote = normalizeReferralCode(quote.referral_code);
  if (fromQuote) return fromQuote;

  const clientId = quote.client_id;
  if (clientId == null || clientId === '') return null;

  const { data: client, error } = await supabase
    .from('clients')
    .select('used_code, referral_code, ref_code')
    .eq('id', clientId)
    .maybeSingle();

  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    if (msg.includes('used_code') || msg.includes('column')) {
      const fallback = await supabase
        .from('clients')
        .select('referral_code, ref_code')
        .eq('id', clientId)
        .maybeSingle();
      if (fallback.error) throw fallback.error;
      return null;
    }
    throw error;
  }

  const used = normalizeReferralCode(client?.used_code);
  if (used) return used;

  return null;
}

async function findPartnerReferrerByCode(
  supabase: SupabaseClient,
  code: string,
): Promise<{
  id: string;
  role: PartnerReferrerRole;
  pending_commission: number;
  commission_rate: number;
} | null> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  const variants = referralCodeLookupVariants(normalized);

  for (const role of ['leader', 'expert'] as const) {
    const table = role === 'leader' ? 'leaders' : 'experts';
    for (const variant of variants) {
      let result = await supabase
        .from(table)
        .select('id, referral_code, pending_commission, commission_rate')
        .eq('referral_code', variant)
        .maybeSingle();

      if (
        result.error &&
        /commission_rate|pending_commission|column|schema cache|does not exist/i.test(
          result.error.message ?? '',
        )
      ) {
        result = await supabase
          .from(table)
          .select('id, referral_code')
          .eq('referral_code', variant)
          .maybeSingle();
      }

      if (result.error) {
        if (/column|schema cache|does not exist/i.test(result.error.message ?? '')) {
          break;
        }
        throw result.error;
      }

      const row = result.data as Record<string, unknown> | null;
      const id = String(row?.id ?? '').trim();
      if (!id) continue;

      return {
        id,
        role,
        pending_commission: Number(row?.pending_commission ?? 0) || 0,
        commission_rate: resolveCommissionRate(row?.commission_rate),
      };
    }
  }

  return null;
}

async function creditPartnerPendingCommission(
  supabase: SupabaseClient,
  referrer: {
    id: string;
    role: PartnerReferrerRole;
    pending_commission: number;
  },
  amount: number,
  description: string,
): Promise<boolean> {
  const table = referrer.role === 'leader' ? 'leaders' : 'experts';

  // Insert ledger row first — used for idempotency and Smart Wallet "آخر الحركات"
  const { error: txError } = await supabase.from('wallet_transactions').insert({
    partner_id: referrer.id,
    partner_type: referrer.role,
    amount,
    status: 'pending',
    description,
  });

  if (txError) {
    console.warn('[referral-approval] wallet_transactions insert failed:', txError.message);
    return false;
  }

  const nextPending = Math.max(0, referrer.pending_commission + amount);
  const { error: updateError } = await supabase
    .from(table)
    .update({ pending_commission: nextPending })
    .eq('id', referrer.id);

  if (updateError) {
    console.warn(
      '[referral-approval] pending_commission update failed:',
      updateError.message,
    );
    // Transaction row already exists; balance can be reconciled later
  }

  return true;
}

/**
 * Credits leader/expert pending wallet (or client VIP wallet) when a referred
 * group lead is approved and converted to a client.
 */
export async function processReferralCommissionOnLeadApproval(
  supabase: SupabaseClient,
  input: {
    referralCode: string | null | undefined;
    clientId: string | number;
    clientName: string;
    leadId?: string | null;
  },
): Promise<ReferralRewardResult> {
  const code = normalizeAffiliateRef(input.referralCode);
  if (!code) return { processed: false, reason: 'no_referral_code' };

  const clientId = String(input.clientId ?? '').trim();
  const clientName = String(input.clientName ?? '').trim() || 'عميل';
  const leadId = String(input.leadId ?? '').trim();
  const amount = REFERRAL_APPROVAL_BONUS_SAR;
  const leadTag = leadId ? ` [lead:${leadId}]` : '';
  const description = `عمولة إحالة عن انضمام العميل: ${clientName}${leadTag}`;

  // Idempotency: skip if this lead already generated a commission row
  if (leadId) {
    const { data: existing } = await supabase
      .from('wallet_transactions')
      .select('id')
      .ilike('description', `%[lead:${leadId}]%`)
      .limit(1);
    if (existing && existing.length > 0) {
      return { processed: false, reason: 'already_credited' };
    }
  }

  const partner = await findPartnerReferrerByCode(supabase, code);
  if (partner) {
    const credited = await creditPartnerPendingCommission(
      supabase,
      partner,
      amount,
      description,
    );
    if (!credited) {
      return { processed: false, reason: 'wallet_write_failed' };
    }
    return {
      processed: true,
      referrerId: partner.id,
      referrerRole: partner.role,
      amount,
    };
  }

  // Fallback: client-owned referral code → VIP wallet credit
  const bookingClientId = /^\d+$/.test(clientId) ? Number(clientId) : null;
  const referrerClient = await findReferrerByCode(supabase, code, bookingClientId);
  if (!referrerClient) {
    return { processed: false, reason: 'referrer_not_found' };
  }

  // Client ledger idempotency via description scan
  if (leadId) {
    const { data: clientDup } = await supabase
      .from('wallet_transactions')
      .select('id')
      .eq('client_id', referrerClient.id)
      .ilike('description', `%[lead:${leadId}]%`)
      .limit(1);
    if (clientDup && clientDup.length > 0) {
      return { processed: false, reason: 'already_credited' };
    }
  }

  try {
    await addClientWalletTransaction(
      supabase,
      String(referrerClient.id),
      amount,
      description,
    );
  } catch (walletError) {
    console.error('[referral-approval] client wallet credit failed:', walletError);
    return { processed: false, reason: 'client_wallet_failed' };
  }

  return {
    processed: true,
    referrerId: String(referrerClient.id),
    referrerRole: 'client',
    amount,
  };
}

async function findReferrerByCode(
  supabase: SupabaseClient,
  code: string,
  excludeClientId: number | null,
): Promise<{ id: number; wallet_balance: number } | null> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;

  const selectCols = 'id, wallet_balance, referral_code, ref_code';
  const variants = referralCodeLookupVariants(normalized);

  for (const variant of variants) {
    const byReferralCode = await supabase
      .from('clients')
      .select(selectCols)
      .eq('referral_code', variant)
      .maybeSingle();

    if (byReferralCode.error && !byReferralCode.error.message.includes('referral_code')) {
      throw byReferralCode.error;
    }

    let row = byReferralCode.data as Record<string, unknown> | null;

    if (!row) {
      const byRefCode = await supabase
        .from('clients')
        .select(selectCols)
        .eq('ref_code', variant)
        .maybeSingle();
      if (byRefCode.error) throw byRefCode.error;
      row = byRefCode.data as Record<string, unknown> | null;
    }

    if (!row?.id) continue;

    const id = Number(row.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (excludeClientId != null && id === excludeClientId) continue;

    return {
      id,
      wallet_balance: Number(row.wallet_balance ?? 0) || 0,
    };
  }

  // Soft fallback: scan recent clients and match canonical form (WL-HALA100 ≡ WL-HALA-100)
  const target = canonicalizeReferralCode(normalized);
  if (!target) return null;

  const { data: candidates, error } = await supabase
    .from('clients')
    .select(selectCols)
    .or('referral_code.not.is.null,ref_code.not.is.null')
    .order('id', { ascending: false })
    .limit(500);

  if (error) {
    if (!/column|schema cache/i.test(error.message)) throw error;
    return null;
  }

  for (const row of candidates ?? []) {
    const record = row as Record<string, unknown>;
    const id = Number(record.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (excludeClientId != null && id === excludeClientId) continue;
    if (
      referralCodesEqual(record.referral_code, target) ||
      referralCodesEqual(record.ref_code, target)
    ) {
      return {
        id,
        wallet_balance: Number(record.wallet_balance ?? 0) || 0,
      };
    }
  }

  return null;
}

async function releaseReferralClaim(
  supabase: SupabaseClient,
  quotationId: string,
): Promise<void> {
  const { error } = await supabase
    .from('quotations')
    .update({ is_referral_paid: false, updated_at: new Date().toISOString() })
    .eq('id', quotationId);

  if (error) {
    console.warn('[referral-reward] failed to release claim:', error.message);
  }
}

/**
 * يُستدعى بعد اعتماد/تأكيد عرض السعر.
 * يستخدم is_referral_paid كقفل لمنع الصرف المكرر.
 */
export async function processReferralRewardForQuotation(
  supabase: SupabaseClient,
  quotationId: string | number,
): Promise<ReferralRewardResult> {
  const key = normalizeQuotationId(quotationId);
  if (!key) return { processed: false, reason: 'invalid_quotation_id' };

  const { data: quote, error: fetchError } = await supabase
    .from('quotations')
    .select('id, status, referral_code, client_id, title, is_referral_paid')
    .eq('id', key)
    .maybeSingle();

  if (fetchError) {
    if ((fetchError.message ?? '').toLowerCase().includes('is_referral_paid')) {
      console.warn('[referral-reward] is_referral_paid column missing — run quotations_referral_reward.sql');
      return { processed: false, reason: 'schema_missing' };
    }
    throw fetchError;
  }

  if (!quote) return { processed: false, reason: 'quotation_not_found' };

  if (quote.is_referral_paid === true) {
    return { processed: false, reason: 'already_paid' };
  }

  if (!isQuotationReferralTriggerStatus(quote.status)) {
    return { processed: false, reason: 'status_not_eligible' };
  }

  const referralCode = await resolveReferralCodeForQuotation(supabase, quote);
  if (!referralCode) {
    return { processed: false, reason: 'no_referral_code' };
  }

  const bookingClientId =
    quote.client_id != null && quote.client_id !== ''
      ? Number(quote.client_id)
      : null;
  const excludeId = Number.isFinite(bookingClientId) ? bookingClientId : null;

  const referrer = await findReferrerByCode(supabase, referralCode, excludeId);
  if (!referrer) {
    return { processed: false, reason: 'referrer_not_found' };
  }

  const { data: claimed, error: claimError } = await supabase
    .from('quotations')
    .update({ is_referral_paid: true, updated_at: new Date().toISOString() })
    .eq('id', key)
    .eq('is_referral_paid', false)
    .select('id')
    .maybeSingle();

  if (claimError) {
    if ((claimError.message ?? '').toLowerCase().includes('is_referral_paid')) {
      return { processed: false, reason: 'schema_missing' };
    }
    throw claimError;
  }

  if (!claimed) {
    return { processed: false, reason: 'already_paid_race' };
  }

  const title = String(quote.title ?? '').trim() || 'عرض سعر';
  const description = `مكافأة إحالة — ${title} (#${key}) — ${REFERRAL_REWARD_AMOUNT_SAR} ر.س`;

  try {
    await addClientWalletTransaction(
      supabase,
      String(referrer.id),
      REFERRAL_REWARD_AMOUNT_SAR,
      description,
    );
  } catch (walletError) {
    console.error('[referral-reward] wallet credit failed:', walletError);
    await releaseReferralClaim(supabase, key);
    throw walletError;
  }

  return {
    processed: true,
    referrerId: String(referrer.id),
    amount: REFERRAL_REWARD_AMOUNT_SAR,
  };
}
