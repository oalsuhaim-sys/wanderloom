import {
  countryStoredFlagValue,
  DEFAULT_COUNTRIES,
  type CountryOption,
} from '@/lib/countries';

export type VipDestinationCountry = {
  code: string;
  name: string;
  flag: string;
};

const COUNTRY_ID_TO_ISO: Record<string, string> = {
  indonesia: 'ID',
  japan: 'JP',
  south_korea: 'KR',
  china: 'CN',
  canada: 'CA',
  south_africa: 'ZA',
  germany: 'DE',
  spain: 'ES',
  italy: 'IT',
  france: 'FR',
  uk: 'GB',
  usa: 'US',
  portugal: 'PT',
  belgium: 'BE',
  netherlands: 'NL',
  czech: 'CZ',
  poland: 'PL',
  austria: 'AT',
  sweden: 'SE',
  russia: 'RU',
  hungary: 'HU',
  switzerland: 'CH',
  saudi_arabia: 'SA',
};

function toVipDestinationCountry(country: CountryOption): VipDestinationCountry {
  return {
    code: COUNTRY_ID_TO_ISO[country.id] ?? country.id.toUpperCase(),
    name: country.name,
    flag: country.flag,
  };
}

/** وجهات VIP — تُشتق من القائمة المركزية للدول */
export const VIP_DESTINATION_COUNTRIES: VipDestinationCountry[] = DEFAULT_COUNTRIES.map(
  toVipDestinationCountry,
);

export function vipCountriesFromOptions(countries: CountryOption[]): VipDestinationCountry[] {
  return countries.map(toVipDestinationCountry);
}

export function vipDestinationStoredValue(country: VipDestinationCountry | CountryOption): string {
  if ('code' in country) {
    return countryStoredFlagValue({ id: country.code, name: country.name, flag: country.flag });
  }
  return countryStoredFlagValue(country);
}

const VIP_STORED_VALUES = new Set(
  VIP_DESTINATION_COUNTRIES.map((country) => vipDestinationStoredValue(country)),
);

/** يطابق القيمة المحفوظة مع أقرب خيار VIP (للقوالب القديمة التي تحفظ العلم فقط) */
export function resolveVipDestinationStoredValue(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (VIP_STORED_VALUES.has(t)) return t;

  for (const c of VIP_DESTINATION_COUNTRIES) {
    const stored = vipDestinationStoredValue(c);
    if (t === c.flag || t.startsWith(c.flag)) return stored;
    if (t.includes(c.name)) return stored;
  }

  return t;
}

export function isAllowedVipDestinationValue(raw: string): boolean {
  const resolved = resolveVipDestinationStoredValue(raw);
  return resolved !== '' && VIP_STORED_VALUES.has(resolved);
}
