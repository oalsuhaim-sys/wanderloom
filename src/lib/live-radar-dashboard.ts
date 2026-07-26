import { parseSupplierRequests, type SupplierRequest } from '@/lib/supplier-requests';
import {
  isQuotationStatusApproved,
  isQuotationStatusPending,
} from '@/lib/crm-quotations';
import { resolveTripDateRange } from '@/lib/vip-operations-radar';

const MS_PER_HOUR = 60 * 60 * 1000;
const LAZY_SUPPLIER_HOURS = 24;
const PASSPORT_WARNING_DAYS = 180;
const LOW_WALLET_THRESHOLD = 5000;

export type SalesPipelinePulse = {
  confirmedProfit: number;
  pendingQuotationValue: number;
  lowWalletCount: number;
};

export type VipInTransit = {
  id: string;
  clientId: string | null;
  clientName: string;
  destination: string;
  dayNumber: number;
  totalDays: number;
  tripTitle: string;
};

export type PassportAlert = {
  id: string;
  clientName: string;
  daysUntilExpiry: number;
  expiryIso: string;
};

export type LazySupplierAlert = {
  id: string;
  supplierName: string;
  clientName: string;
  tripTitle: string;
  hoursWaiting: number;
  itineraryId: string | number;
};

function parseMoney(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parseLocalDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function todayNorm(referenceDate: Date): Date {
  const t = new Date(referenceDate);
  t.setHours(0, 0, 0, 0);
  return t;
}

function todayIsoLocal(referenceDate: Date): string {
  return referenceDate.toLocaleDateString('en-CA');
}

function daysBetweenInclusive(startIso: string, endIso: string): number {
  const start = parseLocalDate(startIso);
  const end = parseLocalDate(endIso);
  if (!start || !end) return 1;
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return Math.max(diff + 1, 1);
}

function daysUntilDate(iso: string, today: Date): number | null {
  const target = parseLocalDate(iso);
  if (!target) return null;
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function tripDayNumber(startIso: string, todayIso: string): number {
  const start = parseLocalDate(startIso);
  const today = parseLocalDate(todayIso);
  if (!start || !today) return 1;
  const diff = Math.round((today.getTime() - start.getTime()) / 86400000);
  return Math.max(diff + 1, 1);
}

function resolveClientName(client: Record<string, unknown>): string {
  return String(client.name ?? '').trim() || '—';
}

function resolveItineraryClientName(row: Record<string, unknown>): string {
  const joined = row.clients;
  if (joined && typeof joined === 'object') {
    const c = Array.isArray(joined) ? joined[0] : joined;
    if (c && typeof c === 'object') {
      const name = String(
        (c as Record<string, unknown>).name ?? '',
      ).trim();
      if (name) return name;
    }
  }
  return String(row.customer_name ?? row.title ?? 'عميل VIP').trim() || 'عميل VIP';
}

function resolveItineraryClientId(row: Record<string, unknown>): string | null {
  if (row.client_id != null && String(row.client_id).trim() !== '') {
    return String(row.client_id).trim();
  }
  const joined = row.clients;
  if (joined && typeof joined === 'object') {
    const c = Array.isArray(joined) ? joined[0] : joined;
    if (c && typeof c === 'object') {
      const id = (c as Record<string, unknown>).id;
      if (id != null && String(id).trim() !== '') return String(id).trim();
    }
  }
  return null;
}

function isOperationalItinerary(row: Record<string, unknown>): boolean {
  if (row.is_template === true) return false;
  const status = String(row.status ?? '').trim().toLowerCase();
  return status !== 'archived' && status !== 'draft';
}

function supplierRequestPendingSinceMs(
  request: SupplierRequest,
  rawItem: Record<string, unknown> | null,
  itineraryUpdatedAt: string | null,
): number | null {
  const fromRaw = rawItem?.updated_at ?? rawItem?.updatedAt ?? rawItem?.created_at ?? rawItem?.createdAt;
  if (fromRaw != null && String(fromRaw).trim()) {
    const ms = new Date(String(fromRaw)).getTime();
    if (Number.isFinite(ms)) return ms;
  }

  const idMatch = /^sr-(\d+)-/.exec(request.id);
  if (idMatch) {
    const ts = Number(idMatch[1]);
    if (Number.isFinite(ts) && ts > 1_000_000_000_000) return ts;
  }

  if (itineraryUpdatedAt) {
    const ms = new Date(itineraryUpdatedAt).getTime();
    if (Number.isFinite(ms)) return ms;
  }

  return null;
}

function rawSupplierRequestMap(raw: unknown): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  if (!Array.isArray(raw)) return map;
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? '').trim();
    if (id) map.set(id, row);
  }
  return map;
}

export function buildSalesPipelinePulse(input: {
  itineraries: Record<string, unknown>[];
  quotations: Record<string, unknown>[];
  clients: Record<string, unknown>[];
}): SalesPipelinePulse {
  void input.itineraries;

  const confirmedProfit = input.quotations
    .filter((row) => isQuotationStatusApproved(row.status))
    .reduce((sum, row) => sum + parseMoney(row.expected_profit), 0);

  const pendingQuotationValue = input.quotations
    .filter((row) => isQuotationStatusPending(row.status))
    .reduce((sum, row) => sum + parseMoney(row.total_estimated_cost), 0);

  const lowWalletCount = input.clients.filter((client) => {
    const balance = parseMoney(client.wallet_balance);
    return balance < LOW_WALLET_THRESHOLD;
  }).length;

  return { confirmedProfit, pendingQuotationValue, lowWalletCount };
}

export function buildVipsInTransit(
  itineraries: Record<string, unknown>[],
  referenceDate: Date = new Date(),
): VipInTransit[] {
  const todayIso = todayIsoLocal(referenceDate);
  const results: VipInTransit[] = [];

  for (const row of itineraries) {
    if (!isOperationalItinerary(row)) continue;
    const range = resolveTripDateRange(row);
    if (!range || range.start > todayIso || todayIso > range.end) continue;

    const destination =
      String(row.destination ?? '').trim() ||
      String(row.title ?? '').trim() ||
      'الوجهة';
    const tripTitle = String(row.title ?? destination).trim() || destination;
    const totalDays = daysBetweenInclusive(range.start, range.end);
    const dayNumber = Math.min(tripDayNumber(range.start, todayIso), totalDays);

    results.push({
      id: String(row.id ?? tripTitle),
      clientId: resolveItineraryClientId(row),
      clientName: resolveItineraryClientName(row),
      destination,
      dayNumber,
      totalDays,
      tripTitle,
    });
  }

  return results.sort((a, b) => a.clientName.localeCompare(b.clientName, 'ar'));
}

export function buildPassportAlerts(
  clients: Record<string, unknown>[],
  referenceDate: Date = new Date(),
): PassportAlert[] {
  const today = todayNorm(referenceDate);
  const alerts: PassportAlert[] = [];

  for (const client of clients) {
    const expiryRaw = client.passport_expiry;
    if (expiryRaw == null || expiryRaw === '') continue;

    const expiryIso = String(expiryRaw).slice(0, 10);
    const daysUntil = daysUntilDate(expiryIso, today);
    if (daysUntil == null) continue;
    if (daysUntil < 0 || daysUntil >= PASSPORT_WARNING_DAYS) continue;

    const clientName = resolveClientName(client);
    alerts.push({
      id: String(client.id ?? clientName),
      clientName,
      daysUntilExpiry: daysUntil,
      expiryIso,
    });
  }

  return alerts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

export function buildLazySupplierAlerts(
  itineraries: Record<string, unknown>[],
  referenceDate: Date = new Date(),
): LazySupplierAlert[] {
  const nowMs = referenceDate.getTime();
  const thresholdMs = LAZY_SUPPLIER_HOURS * MS_PER_HOUR;
  const alerts: LazySupplierAlert[] = [];

  for (const row of itineraries) {
    if (!isOperationalItinerary(row)) continue;

    const rawMap = rawSupplierRequestMap(row.supplier_requests);
    const itineraryUpdatedAt =
      row.updated_at != null ? String(row.updated_at) : null;
    const clientName = resolveItineraryClientName(row);
    const tripTitle = String(row.title ?? row.destination ?? 'رحلة VIP').trim() || 'رحلة VIP';

    for (const request of parseSupplierRequests(row.supplier_requests)) {
      if (request.status !== 'pending_reply') continue;

      const pendingSinceMs = supplierRequestPendingSinceMs(
        request,
        rawMap.get(request.id) ?? null,
        itineraryUpdatedAt,
      );
      if (pendingSinceMs == null) continue;

      const elapsedMs = nowMs - pendingSinceMs;
      if (elapsedMs < thresholdMs) continue;

      const hoursWaiting = Math.floor(elapsedMs / MS_PER_HOUR);
      const supplierName = (request.supplier_name || request.title).trim() || 'مورد';

      alerts.push({
        id: `lazy-${row.id}-${request.id}`,
        supplierName,
        clientName,
        tripTitle,
        hoursWaiting,
        itineraryId: row.id as string | number,
      });
    }
  }

  return alerts.sort((a, b) => b.hoursWaiting - a.hoursWaiting);
}

export function formatSarAmount(value: number): string {
  return `${value.toLocaleString('ar-SA')} ر.س`;
}
