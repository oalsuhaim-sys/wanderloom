import { VIP_DESTINATION_COUNTRIES } from '@/lib/vip-destination-countries';

const ALLOWED_COUNTRY_CODES = new Set(VIP_DESTINATION_COUNTRIES.map((c) => c.code));

export type InterestDestinationCity = {
  cityEn: string;
  cityAr: string;
  countryCode: string;
};

export type ClientInterestCategory = 'history' | 'shopping' | 'nature' | 'art';

export const CLIENT_INTEREST_PRESETS: Array<{ id: ClientInterestCategory; label: string }> = [
  { id: 'history', label: 'التاريخ' },
  { id: 'nature', label: 'طبيعة' },
  { id: 'shopping', label: 'تسوق' },
  { id: 'art', label: 'فن' },
];

/** مدن مقترحة — تُفلتر تلقائياً ضمن الـ 21 دولة VIP */
const INTEREST_CITY_POOL: Record<ClientInterestCategory, InterestDestinationCity[]> = {
  history: [
    { cityEn: 'Rome', cityAr: 'روما', countryCode: 'IT' },
    { cityEn: 'Vienna', cityAr: 'فيينا', countryCode: 'AT' },
    { cityEn: 'Seville', cityAr: 'إشبيلية', countryCode: 'ES' },
    { cityEn: 'Athens', cityAr: 'أثينا', countryCode: 'GR' },
    { cityEn: 'Istanbul', cityAr: 'إسطنبول', countryCode: 'TR' },
    { cityEn: 'Prague', cityAr: 'براغ', countryCode: 'CZ' },
    { cityEn: 'Budapest', cityAr: 'بودابست', countryCode: 'HU' },
  ],
  shopping: [
    { cityEn: 'Paris', cityAr: 'باريس', countryCode: 'FR' },
    { cityEn: 'Milan', cityAr: 'ميلانو', countryCode: 'IT' },
    { cityEn: 'London', cityAr: 'لندن', countryCode: 'GB' },
    { cityEn: 'Dubai', cityAr: 'دبي', countryCode: 'AE' },
    { cityEn: 'Amsterdam', cityAr: 'أمستردام', countryCode: 'NL' },
    { cityEn: 'Brussels', cityAr: 'بروكسل', countryCode: 'BE' },
  ],
  nature: [
    { cityEn: 'Zermatt', cityAr: 'زيرمات', countryCode: 'CH' },
    { cityEn: 'Interlaken', cityAr: 'إنترلاكن', countryCode: 'CH' },
    { cityEn: 'Salzburg', cityAr: 'سالزبورغ', countryCode: 'AT' },
    { cityEn: 'Bergen', cityAr: 'بيرغن', countryCode: 'NO' },
    { cityEn: 'Stockholm', cityAr: 'ستوكهولم', countryCode: 'SE' },
    { cityEn: 'Geneva', cityAr: 'جنيف', countryCode: 'CH' },
  ],
  art: [
    { cityEn: 'Paris', cityAr: 'باريس', countryCode: 'FR' },
    { cityEn: 'Florence', cityAr: 'فلورنسا', countryCode: 'IT' },
    { cityEn: 'Vienna', cityAr: 'فيينا', countryCode: 'AT' },
    { cityEn: 'Barcelona', cityAr: 'برشلونة', countryCode: 'ES' },
    { cityEn: 'Amsterdam', cityAr: 'أمستردام', countryCode: 'NL' },
  ],
};

const INTEREST_ALIASES: Record<ClientInterestCategory, string[]> = {
  history: ['التاريخ', 'تاريخ', 'history', 'حضارة', 'تاريخ وحضارة'],
  shopping: ['تسوق', 'shopping', 'موضة', 'تسوق وموضة', 'أزياء'],
  nature: ['طبيعة', 'nature', 'مناظر', 'طبيعة ومناظر'],
  art: ['فن', 'art', 'فنون', 'museums', 'متاحف'],
};

function normInterest(s: string): string {
  return s.trim().toLowerCase();
}

export function resolveInterestCategory(interestRaw: string): ClientInterestCategory | null {
  const n = normInterest(interestRaw);
  if (!n) return null;
  for (const [category, aliases] of Object.entries(INTEREST_ALIASES) as Array<
    [ClientInterestCategory, string[]]
  >) {
    if (aliases.some((a) => normInterest(a) === n || n.includes(normInterest(a)))) {
      return category;
    }
  }
  return null;
}

export function citiesForInterestCategory(category: ClientInterestCategory): InterestDestinationCity[] {
  return INTEREST_CITY_POOL[category].filter((c) => ALLOWED_COUNTRY_CODES.has(c.countryCode));
}

export function formatArabicCityList(cities: InterestDestinationCity[], max = 3): string {
  const names = cities.slice(0, max).map((c) => c.cityAr);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} أو ${names[1]}`;
  return `${names.slice(0, -1).join(' أو ')} أو ${names[names.length - 1]}`;
}

export type ClientInterestSuggestion = {
  clientId: string;
  clientName: string;
  category: ClientInterestCategory;
  categoryLabel: string;
  cityListAr: string;
  cities: InterestDestinationCity[];
};

export function buildClientInterestSuggestions(input: {
  clients: Array<Record<string, unknown>>;
  preferences: Array<{ client_id: string | number; interests?: unknown }>;
}): ClientInterestSuggestion[] {
  const prefsByClient = new Map<string, string[]>();
  for (const row of input.preferences) {
    const id = String(row.client_id);
    const raw = row.interests;
    const list = Array.isArray(raw)
      ? raw.map((x) => String(x).trim()).filter(Boolean)
      : [];
    if (list.length) prefsByClient.set(id, list);
  }

  const suggestions: ClientInterestSuggestion[] = [];
  const seen = new Set<string>();

  for (const client of input.clients) {
    const clientId = String(client.id);
    const interests = prefsByClient.get(clientId) ?? [];
    if (!interests.length) continue;

    const clientName =
      String(client.name ?? '').trim() || `عميل #${clientId}`;

    for (const interest of interests) {
      const category = resolveInterestCategory(interest);
      if (!category) continue;

      const key = `${clientId}:${category}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const cities = citiesForInterestCategory(category);
      if (!cities.length) continue;

      const preset = CLIENT_INTEREST_PRESETS.find((p) => p.id === category);
      suggestions.push({
        clientId,
        clientName,
        category,
        categoryLabel: preset?.label ?? interest,
        cityListAr: formatArabicCityList(cities),
        cities,
      });
    }
  }

  return suggestions;
}
