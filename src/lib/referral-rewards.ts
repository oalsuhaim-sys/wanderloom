import type { SupabaseClient } from '@supabase/supabase-js';

import { isQuotationStatusApproved, normalizeQuotationId } from '@/lib/crm-quotations';
import { addClientWalletTransaction } from '@/lib/vip-wallet-ledger';

/** مكافأة المحفظة للمُحيل عند تأكيد الحجز */
export const REFERRAL_REWARD_AMOUNT_SAR = 500;

export type ReferralRewardResult = {
  processed: boolean;
  reason?: string;
  referrerId?: string;
  amount?: number;
};

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

async function findReferrerByCode(
  supabase: SupabaseClient,
  code: string,
  excludeClientId: number | null,
): Promise<{ id: number; wallet_balance: number } | null> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;

  const selectCols = 'id, wallet_balance, referral_code, ref_code';

  const byReferralCode = await supabase
    .from('clients')
    .select(selectCols)
    .eq('referral_code', normalized)
    .maybeSingle();

  if (byReferralCode.error && !byReferralCode.error.message.includes('referral_code')) {
    throw byReferralCode.error;
  }

  let row = byReferralCode.data as Record<string, unknown> | null;

  if (!row) {
    const byRefCode = await supabase
      .from('clients')
      .select(selectCols)
      .eq('ref_code', normalized)
      .maybeSingle();
    if (byRefCode.error) throw byRefCode.error;
    row = byRefCode.data as Record<string, unknown> | null;
  }

  if (!row?.id) return null;

  const referrerId = Number(row.id);
  if (!Number.isFinite(referrerId)) return null;
  if (excludeClientId != null && referrerId === excludeClientId) return null;

  const wallet_balance =
    row.wallet_balance != null ? Number(row.wallet_balance) : 0;

  return {
    id: referrerId,
    wallet_balance: Number.isFinite(wallet_balance) ? wallet_balance : 0,
  };
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
