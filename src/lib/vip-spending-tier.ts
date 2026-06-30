export type VipSpendingTier = 'gold' | 'black' | 'signature';

/** عتبات الشريحة حسب إجمالي الأرباح (ر.س) — عدّل هنا عند تغيير السياسة */
export const VIP_PROFIT_TIER_THRESHOLDS = {
  black: 10_000,
  signature: 30_000,
} as const;

/** @deprecated استخدم VIP_PROFIT_TIER_THRESHOLDS */
export const VIP_SPENDING_TIER_THRESHOLDS = VIP_PROFIT_TIER_THRESHOLDS;

export function parseTotalProfit(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** @deprecated استخدم parseTotalProfit */
export function parseTotalSpent(raw: unknown): number {
  return parseTotalProfit(raw);
}

/** يحدّد الشريحة من إجمالي الأرباح — Gold افتراضياً */
export function resolveVipSpendingTier(totalProfit: number): VipSpendingTier {
  const profit = parseTotalProfit(totalProfit);
  if (profit >= VIP_PROFIT_TIER_THRESHOLDS.signature) return 'signature';
  if (profit >= VIP_PROFIT_TIER_THRESHOLDS.black) return 'black';
  return 'gold';
}

export function normalizeVipSpendingTier(
  tierRaw: unknown,
  totalProfitRaw?: unknown,
): VipSpendingTier {
  if (totalProfitRaw != null && totalProfitRaw !== '') {
    return resolveVipSpendingTier(parseTotalProfit(totalProfitRaw));
  }
  const s = String(tierRaw ?? '')
    .trim()
    .toLowerCase();
  if (s === 'signature') return 'signature';
  if (s === 'black') return 'black';
  if (s === 'gold') return 'gold';
  return 'gold';
}

export function vipSpendingTierLabel(tier: VipSpendingTier): string {
  if (tier === 'signature') return 'Wanderloom Signature ✨';
  if (tier === 'black') return 'Wanderloom Black ⚫';
  return 'Wanderloom Gold 🟡';
}

export function buildClientVipTierMap(
  clients: Record<string, unknown>[],
): Map<string, VipSpendingTier> {
  const map = new Map<string, VipSpendingTier>();
  for (const row of clients) {
    const id = row.id != null ? String(row.id) : '';
    if (!id) continue;
    map.set(
      id,
      normalizeVipSpendingTier(row.vip_tier, row.total_profit ?? row.total_spent),
    );
  }
  return map;
}

export function resolveVipTierFromClientRow(
  client: Record<string, unknown> | null | undefined,
): VipSpendingTier {
  if (!client) return 'gold';
  return normalizeVipSpendingTier(client.vip_tier, client.total_profit ?? client.total_spent);
}
