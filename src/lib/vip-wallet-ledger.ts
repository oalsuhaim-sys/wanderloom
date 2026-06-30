import type { SupabaseClient } from '@supabase/supabase-js';

import {
  normalizeVipSpendingTier,
  parseTotalSpent,
  type VipSpendingTier,
} from '@/lib/vip-spending-tier';

export type WalletTransaction = {
  id: string;
  clientId: string;
  amount: number;
  description: string;
  createdAt: string;
};

export type ClientWalletLedger = {
  balance: number;
  totalSpent: number;
  vipTier: VipSpendingTier;
  transactions: WalletTransaction[];
};

export function parseWalletBalance(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function formatWalletAmount(amount: number, currency = 'ر.س'): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat('ar-SA', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    signDisplay: 'never',
  }).format(Math.abs(value));
  return `${formatted} ${currency}`;
}

export function formatWalletSignedAmount(amount: number, currency = 'ر.س'): string {
  const prefix = amount > 0 ? '+' : amount < 0 ? '−' : '';
  return `${prefix}${formatWalletAmount(amount, currency)}`;
}

export function formatWalletTransactionDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ar-SA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseWalletTransactionRow(row: Record<string, unknown>): WalletTransaction | null {
  const id = row.id != null ? String(row.id) : '';
  const clientId = row.client_id != null ? String(row.client_id) : '';
  if (!id || !clientId) return null;
  const amount = parseWalletBalance(row.amount);
  return {
    id,
    clientId,
    amount,
    description: String(row.description ?? '').trim(),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function fetchClientWalletLedger(
  supabase: SupabaseClient,
  clientId: string,
  options?: { limit?: number },
): Promise<ClientWalletLedger> {
  const limit = options?.limit ?? 50;
  const idNum = Number(clientId);
  if (!Number.isFinite(idNum)) {
    return { balance: 0, totalSpent: 0, vipTier: 'gold', transactions: [] };
  }

  const [clientRes, txRes] = await Promise.all([
    supabase.from('clients').select('wallet_balance, total_spent, vip_tier').eq('id', idNum).maybeSingle(),
    supabase
      .from('wallet_transactions')
      .select('id, client_id, amount, description, created_at')
      .eq('client_id', idNum)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  if (clientRes.error) {
    const msg = String(clientRes.error.message ?? '').toLowerCase();
    if (msg.includes('wallet_balance') || msg.includes('schema cache')) {
      return { balance: 0, totalSpent: 0, vipTier: 'gold', transactions: [] };
    }
    throw clientRes.error;
  }

  const balance = parseWalletBalance(clientRes.data?.wallet_balance);
  const totalSpent = parseTotalSpent(clientRes.data?.total_spent);
  const vipTier = normalizeVipSpendingTier(clientRes.data?.vip_tier, totalSpent);

  if (txRes.error) {
    const msg = String(txRes.error.message ?? '').toLowerCase();
    if (msg.includes('wallet_transactions') || msg.includes('schema cache')) {
      return { balance, totalSpent, vipTier, transactions: [] };
    }
    throw txRes.error;
  }

  const transactions = (txRes.data ?? [])
    .map((row) => parseWalletTransactionRow(row as Record<string, unknown>))
    .filter((t): t is WalletTransaction => t != null);

  return { balance, totalSpent, vipTier, transactions };
}

export async function addClientWalletTransaction(
  supabase: SupabaseClient,
  clientId: string,
  amount: number,
  description: string,
): Promise<{ balance: number; transactionId: string | null; totalSpent: number; vipTier: string }> {
  const idNum = Number(clientId);
  if (!Number.isFinite(idNum)) {
    throw new Error('معرّف العميل غير صالح.');
  }
  if (!Number.isFinite(amount) || amount === 0) {
    throw new Error('أدخل مبلغاً غير صفري (موجب للإيداع، سالب للخصم).');
  }
  const desc = description.trim();
  if (!desc) {
    throw new Error('أدخل وصفاً للعملية.');
  }

  const { data, error } = await supabase.rpc('add_client_wallet_transaction', {
    p_client_id: idNum,
    p_amount: amount,
    p_description: desc,
  });

  if (error) {
    const msg = String(error.message ?? '').toLowerCase();
    if (
      msg.includes('add_client_wallet_transaction') ||
      msg.includes('wallet_transactions') ||
      msg.includes('wallet_balance')
    ) {
      throw new Error('نفّذ supabase/sql/clients_wallet_ledger.sql في Supabase أولاً.');
    }
    throw error;
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  return {
    balance: parseWalletBalance(payload.new_balance),
    transactionId: payload.transaction_id != null ? String(payload.transaction_id) : null,
    totalSpent: parseWalletBalance(payload.new_total_spent),
    vipTier: String(payload.vip_tier ?? 'gold'),
  };
}
