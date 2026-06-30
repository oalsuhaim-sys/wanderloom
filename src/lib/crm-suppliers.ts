export type CrmSupplier = {
  id: string;
  name: string;
  destination: string;
  category: string;
  country: string;
  city: string;
  contact_person: string;
  phone: string;
  email: string;
  services_provided: string;
  preferred_app: string;
};

function pickStr(raw: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = raw[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

export function normalizeCrmSupplier(raw: Record<string, unknown>): CrmSupplier | null {
  const id = raw.id != null ? String(raw.id) : '';
  const name = pickStr(raw, ['name', 'supplier_name', 'company_name', 'title']);
  if (!id || !name) return null;

  const destination = pickStr(raw, ['destination', 'destination_city', 'city', 'country']);
  const country = pickStr(raw, ['country', 'country_name']);
  const city = pickStr(raw, ['city', 'destination_city']);

  return {
    id,
    name,
    destination: destination || city || country,
    category: pickStr(raw, ['category', 'supplier_category', 'type']),
    country,
    city,
    contact_person: pickStr(raw, ['contact_person', 'contact_name', 'contact']),
    phone: pickStr(raw, ['phone', 'phone_number', 'mobile', 'phone_wa']),
    email: pickStr(raw, ['email', 'contact_email']),
    services_provided: pickStr(raw, ['services_provided', 'services', 'service_summary']),
    preferred_app: pickStr(raw, ['preferred_app', 'contact_app', 'messaging_app', 'preferred_messenger']),
  };
}

function normDest(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

const DESTINATION_ALIASES: Record<string, string[]> = {
  'كوريا الجنوبية': ['south korea', 'korea', 'republic of korea', 'kr', 'seoul', 'سيول'],
  'اليابان': ['japan', 'jp', 'tokyo', 'طوكيو'],
  'فرنسا': ['france', 'paris', 'باريس'],
  'إسبانيا': ['spain', 'madrid', 'مدريد'],
  'إيطاليا': ['italy', 'rome', 'روما'],
  'ألمانيا': ['germany', 'berlin', 'برلين'],
};

function expandDestinationTargets(raw: string): string[] {
  const base = raw.trim();
  if (!base) return [];
  const normalized = normDest(base);
  const out = new Set<string>([base]);
  for (const [canonical, aliases] of Object.entries(DESTINATION_ALIASES)) {
    const canonNorm = normDest(canonical);
    if (
      canonNorm === normalized ||
      normalized.includes(canonNorm) ||
      canonNorm.includes(normalized) ||
      aliases.some((a) => normDest(a) === normalized || normalized.includes(normDest(a)))
    ) {
      out.add(canonical);
      for (const alias of aliases) out.add(alias);
    }
  }
  return [...out];
}

/** يطابق destination في المسار مع حقل destination (أو city/country) في المورد */
export function supplierMatchesDestination(supplier: CrmSupplier, itineraryDestination: string): boolean {
  const target = normDest(itineraryDestination);
  if (!target) return false;

  const candidates = [supplier.destination, supplier.city, supplier.country]
    .map(normDest)
    .filter(Boolean);

  if (candidates.some((c) => c === target)) return true;

  const expandedTargets = expandDestinationTargets(itineraryDestination).map(normDest);
  if (expandedTargets.some((t) => candidates.some((c) => c === t))) return true;

  return candidates.some((c) => c.includes(target) || target.includes(c));
}

export function filterSuppliersByDestination(
  suppliers: CrmSupplier[],
  itineraryDestination: string,
): CrmSupplier[] {
  const dest = itineraryDestination.trim();
  if (!dest) return [];
  return suppliers.filter((s) => supplierMatchesDestination(s, dest));
}

export type SupplierItineraryFilter = {
  destination?: string;
  countries?: string[];
  cities?: string[];
};

/** فلترة صارمة — لا تُرجع أبداً القائمة الكاملة عند غياب معايير الوجهة */
export function filterSuppliersForItinerary(
  suppliers: CrmSupplier[],
  filter: SupplierItineraryFilter,
): CrmSupplier[] {
  const targets = new Set<string>();

  for (const country of filter.countries ?? []) {
    for (const expanded of expandDestinationTargets(country)) targets.add(expanded);
  }
  for (const city of filter.cities ?? []) {
    if (city.trim()) targets.add(city.trim());
  }
  const destination = filter.destination?.trim();
  if (destination) {
    for (const part of destination.split(/[,،|/·]+/)) {
      for (const expanded of expandDestinationTargets(part)) targets.add(expanded);
    }
  }

  if (targets.size === 0) return [];

  return suppliers.filter((supplier) =>
    [...targets].some((target) => supplierMatchesDestination(supplier, target)),
  );
}

export async function fetchCrmSuppliers(
  supabase: NonNullable<typeof import('@/lib/supabase').supabase>,
): Promise<CrmSupplier[]> {
  const { data, error } = await supabase.from('suppliers').select('*');
  if (error) throw error;
  return (data ?? [])
    .map((row) => normalizeCrmSupplier(row as Record<string, unknown>))
    .filter((s): s is CrmSupplier => Boolean(s))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}
