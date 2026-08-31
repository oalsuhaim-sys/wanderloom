export type GroupPricingDirectCosts = {
  /** Blended hotel cost per passenger (derived from VIP unified-rate engine). */
  hotel: number;
  flight: number;
  activities: number;
  meals: number;
  /** Hotel lines — unified rate + optional shared-room VIP services. */
  hotels?: GroupPricingHotelItem[];
};

export type GroupPricingFixedCosts = {
  leader: number;
  expert: number;
  marketing: number;
  contingency: number;
};

/**
 * VIP Unified Rate + Custom Services:
 * Every passenger pays unifiedBaseRoomRate × nights (never split by occupancy).
 * Shared rooms only affect physical room count; VIP extras are a separate total.
 */
export type GroupPricingHotelItem = {
  id: string;
  name: string;
  nightsCount: number;
  /** Base rate per passenger per night (charged in full for every pax). */
  unifiedBaseRoomRate: number;
  /** Shared Double/Twin setup — occupancy math only. */
  hasSharedAllocations: boolean;
  /** Shared rooms (each = 2 pax) for physical inventory. */
  doubleRoomsCount: number;
  /** Total custom VIP services cost for shared occupants (dinner, events, etc.). */
  customVipServicesTotalCost: number;
};

export type HotelOccupancyBreakdown = {
  soloPax: number;
  sharedPax: number;
  singleRooms: number;
  doubleRooms: number;
  physicalRoomsTotal: number;
  /** passengers × unified rate × nights */
  unifiedRoomCost: number;
  /** VIP custom services (when shared allocations on) */
  vipServicesCost: number;
  hotelTotal: number;
  warnings: string[];
};

export type GroupPricingRow = {
  id: string;
  title: string | null;
  passengers_count: number;
  nights_count: number;
  direct_costs: GroupPricingDirectCosts | Record<string, unknown>;
  fixed_costs: GroupPricingFixedCosts | Record<string, unknown>;
  hotels_breakdown?: GroupPricingHotelItem[] | unknown;
  profit_margin: number;
  manual_selling_price?: number | null;
  final_selling_price_per_pax?: number | null;
  total_group_revenue?: number | null;
  total_group_net_profit?: number | null;
  /** Legacy column aliases */
  final_selling_price?: number | null;
  total_revenue?: number | null;
  total_net_profit?: number | null;
  effective_margin?: number | null;
  total_base_cost_per_passenger?: number | null;
  itinerary_id: number | null;
  client_id: number | null;
  leader_id?: number | null;
  itinerary_name?: string | null;
  leader_name?: string | null;
  created_at?: string;
  updated_at?: string;
};

/** Exact columns written to public.group_pricings (no calculated extras). */
export type GroupPricingPayload = {
  title: string;
  passengers_count: number;
  nights_count: number;
  direct_costs: {
    hotel: number;
    flight: number;
    activities: number;
    meals: number;
  };
  fixed_costs: GroupPricingFixedCosts;
  hotels_breakdown: GroupPricingHotelItem[];
  profit_margin: number;
  effective_margin: number;
  manual_selling_price: number | null;
  final_selling_price_per_pax: number;
  total_group_revenue: number;
  total_group_net_profit: number;
  updated_at: string;
  /** Only included when linked — omitted from payload when null */
  itinerary_id?: number;
  client_id?: number;
  leader_id?: number;
  itinerary_name?: string;
  leader_name?: string;
};

/** Whitelist of columns accepted by the live group_pricings schema. */
export const GROUP_PRICING_SAVE_COLUMNS = [
  'title',
  'passengers_count',
  'nights_count',
  'direct_costs',
  'fixed_costs',
  'hotels_breakdown',
  'profit_margin',
  'effective_margin',
  'manual_selling_price',
  'final_selling_price_per_pax',
  'total_group_revenue',
  'total_group_net_profit',
  'updated_at',
  'itinerary_id',
  'client_id',
  'leader_id',
  'itinerary_name',
  'leader_name',
] as const;

export function sanitizeGroupPricingPayload(
  raw: Record<string, unknown>,
): GroupPricingPayload {
  const allowed = new Set<string>(GROUP_PRICING_SAVE_COLUMNS);
  const sanitized: Record<string, unknown> = {};

  for (const key of GROUP_PRICING_SAVE_COLUMNS) {
    if (!(key in raw) || !allowed.has(key)) continue;
    const value = raw[key];
    if (key === 'itinerary_id' || key === 'client_id' || key === 'leader_id') {
      if (value == null) continue;
    }
    if (key === 'itinerary_name' || key === 'leader_name') {
      if (value == null || String(value).trim() === '') continue;
    }
    sanitized[key] = value;
  }

  // Hard-ban known legacy / calculated aliases that break PostgREST
  delete sanitized.final_selling_price;
  delete sanitized.total_revenue;
  delete sanitized.total_net_profit;
  delete sanitized.total_base_cost_per_passenger;

  return sanitized as GroupPricingPayload;
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

export function createEmptyHotelItem(nightsCount = 7): GroupPricingHotelItem {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `hotel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: 'فندق الإقامة',
    nightsCount: Math.max(1, nightsCount),
    unifiedBaseRoomRate: 350,
    hasSharedAllocations: false,
    doubleRoomsCount: 0,
    customVipServicesTotalCost: 0,
  };
}

/** Migrate legacy hotel JSON (baseSingle / hasSharedUpgrades / extras-per-double). */
export function parseHotelItem(raw: unknown, fallbackNights = 7): GroupPricingHotelItem {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const base = createEmptyHotelItem(fallbackNights);

  const unifiedFromNew = asFiniteNumber(obj.unifiedBaseRoomRate, NaN);
  const unifiedFromLegacy = asFiniteNumber(obj.baseSingleRoomRate, NaN);
  const unifiedBaseRoomRate = Math.max(
    0,
    Number.isFinite(unifiedFromNew)
      ? unifiedFromNew
      : Number.isFinite(unifiedFromLegacy)
        ? unifiedFromLegacy
        : base.unifiedBaseRoomRate,
  );

  const hasSharedAllocations = Boolean(
    obj.hasSharedAllocations ?? obj.hasSharedUpgrades ?? false,
  );
  const doubleRoomsCount = Math.max(0, Math.floor(asFiniteNumber(obj.doubleRoomsCount)));

  const vipFromNew = asFiniteNumber(obj.customVipServicesTotalCost, NaN);
  const extrasPerDouble = asFiniteNumber(obj.extraServicesCostPerDouble, NaN);
  const customVipServicesTotalCost = Math.max(
    0,
    Number.isFinite(vipFromNew)
      ? vipFromNew
      : Number.isFinite(extrasPerDouble)
        ? extrasPerDouble * Math.max(1, doubleRoomsCount || 1)
        : 0,
  );

  return {
    id: String(obj.id ?? base.id),
    name: String(obj.name ?? base.name).trim() || base.name,
    nightsCount: Math.max(1, asFiniteNumber(obj.nightsCount, fallbackNights)),
    unifiedBaseRoomRate,
    hasSharedAllocations,
    doubleRoomsCount,
    customVipServicesTotalCost,
  };
}

export function parseHotelsList(raw: unknown, fallbackNights = 7): GroupPricingHotelItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((item) => parseHotelItem(item, fallbackNights));
}

/**
 * VIP Unified Rate + Shared Occupancy (inventory only):
 * - Room revenue/cost: EVERY passenger × unifiedBaseRoomRate × nights (never split)
 * - Shared rooms: only compute physical single/double room counts
 * - VIP services: flat customVipServicesTotalCost when shared allocations are enabled
 */
export function calculateHotelOccupancy(
  hotel: GroupPricingHotelItem,
  passengersCount: number,
): HotelOccupancyBreakdown {
  const pax = Math.max(1, passengersCount);
  const nights = Math.max(1, hotel.nightsCount);
  const warnings: string[] = [];

  let doubleRooms = 0;
  let sharedPax = 0;

  if (hotel.hasSharedAllocations) {
    doubleRooms = Math.max(0, Math.floor(hotel.doubleRoomsCount));
    sharedPax = doubleRooms * 2;
    if (sharedPax > pax) {
      warnings.push(
        `الغرف المشتركة في «${hotel.name}» تستوعب ${sharedPax} مسافر بينما القروب ${pax} فقط.`,
      );
      const maxDoubles = Math.floor(pax / 2);
      doubleRooms = maxDoubles;
      sharedPax = doubleRooms * 2;
    }
  }

  const soloPax = Math.max(0, pax - sharedPax);
  const singleRooms = hotel.hasSharedAllocations ? soloPax : pax;
  const physicalRoomsTotal = singleRooms + doubleRooms;

  // Critical: occupancy never divides the rate — every passenger pays full unified rate.
  const unifiedRoomCost = pax * hotel.unifiedBaseRoomRate * nights;
  const vipServicesCost = hotel.hasSharedAllocations
    ? Math.max(0, hotel.customVipServicesTotalCost)
    : 0;
  const hotelTotal = unifiedRoomCost + vipServicesCost;

  return {
    soloPax,
    sharedPax,
    singleRooms,
    doubleRooms,
    physicalRoomsTotal,
    unifiedRoomCost,
    vipServicesCost,
    hotelTotal,
    warnings,
  };
}

export function calculateHotelsGroupTotal(
  hotels: GroupPricingHotelItem[],
  passengersCount: number,
): {
  hotelGroupTotal: number;
  hotelAvgPerPassenger: number;
  breakdowns: HotelOccupancyBreakdown[];
  warnings: string[];
} {
  const pax = Math.max(1, passengersCount);
  if (!hotels.length) {
    return {
      hotelGroupTotal: 0,
      hotelAvgPerPassenger: 0,
      breakdowns: [],
      warnings: [],
    };
  }

  const breakdowns = hotels.map((h) => calculateHotelOccupancy(h, pax));
  const hotelGroupTotal = breakdowns.reduce((sum, b) => sum + b.hotelTotal, 0);
  const warnings = breakdowns.flatMap((b) => b.warnings);

  return {
    hotelGroupTotal,
    hotelAvgPerPassenger: hotelGroupTotal / pax,
    breakdowns,
    warnings,
  };
}

export function parseDirectCosts(raw: unknown, fallbackNights = 7): GroupPricingDirectCosts {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const hotels = parseHotelsList(obj.hotels, fallbackNights);
  const legacyHotel = asFiniteNumber(obj.hotel);

  const resolvedHotels =
    hotels.length > 0
      ? hotels
      : legacyHotel > 0
        ? [
            {
              ...createEmptyHotelItem(fallbackNights),
              name: 'إقامة (مستورد من تسعير سابق)',
              nightsCount: Math.max(1, fallbackNights),
              unifiedBaseRoomRate: legacyHotel / Math.max(1, fallbackNights),
              hasSharedAllocations: false,
              doubleRoomsCount: 0,
              customVipServicesTotalCost: 0,
            },
          ]
        : [];

  return {
    hotel: legacyHotel,
    flight: asFiniteNumber(obj.flight),
    activities: asFiniteNumber(obj.activities),
    meals: asFiniteNumber(obj.meals),
    hotels: resolvedHotels,
  };
}

/** Prefer hotels_breakdown column; fall back to nested direct_costs.hotels / legacy flat hotel. */
export function resolveHotelsFromRow(
  row: Pick<GroupPricingRow, 'direct_costs' | 'hotels_breakdown' | 'nights_count'>,
): GroupPricingHotelItem[] {
  const nights = Math.max(1, Number(row.nights_count) || 7);
  const fromBreakdown = parseHotelsList(row.hotels_breakdown, nights);
  if (fromBreakdown.length > 0) return fromBreakdown;

  const fromDirect = parseDirectCosts(row.direct_costs, nights).hotels ?? [];
  if (fromDirect.length > 0) return fromDirect;

  return [createEmptyHotelItem(nights)];
}

export function parseFixedCosts(raw: unknown): GroupPricingFixedCosts {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    leader: asFiniteNumber(obj.leader),
    expert: asFiniteNumber(obj.expert),
    marketing: asFiniteNumber(obj.marketing),
    contingency: asFiniteNumber(obj.contingency),
  };
}
