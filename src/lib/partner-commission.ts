/**
 * Expert / Leader commission — calculated on profit margin (price − cost).
 * Default rate: 15% of profit.
 */

export const DEFAULT_PARTNER_COMMISSION_RATE = 15;

/** Formula: (Trip Price - Base Cost) * (Commission Rate / 100) */
export function calculateCommission(
  price: number,
  cost: number,
  rate: number = DEFAULT_PARTNER_COMMISSION_RATE,
): number {
  const profitMargin = Math.max(0, Number(price) - Number(cost));
  const safeRate = Number.isFinite(rate) ? rate : DEFAULT_PARTNER_COMMISSION_RATE;
  return profitMargin * (safeRate / 100);
}

/** Normalize a stored / form commission rate; null/undefined → default 15. */
export function resolveCommissionRate(raw: unknown): number {
  if (raw == null || raw === '') return DEFAULT_PARTNER_COMMISSION_RATE;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_PARTNER_COMMISSION_RATE;
  return Math.min(100, Math.max(0, n));
}
