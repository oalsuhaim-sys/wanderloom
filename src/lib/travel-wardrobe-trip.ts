/**
 * استنتاج سياق الرحلة ومطابقة قطع travel_wardrobe مع الوجهة/الموسم.
 */

export type WardrobeMatchRow = {
  id: string;
  name: string;
  description?: string;
  price?: number;
  image_url?: string | null;
  purchase_url?: string | null;
  purchase_link?: string | null;
  seasons?: string[] | null;
  destinations?: string[] | null;
  season_tags?: string[] | null;
  destination_tags?: string[] | null;
};

export type TripDayForWardrobeMatch = {
  title?: string;
  notes?: string;
  hotel?: { city?: string; country?: string; name?: string } | null;
  experience?: { title?: string; city?: string; country?: string } | null;
};

const MONTH_TO_SEASON_AR: Record<number, string> = {
  1: 'شتاء',
  2: 'شتاء',
  3: 'ربيع',
  4: 'ربيع',
  5: 'ربيع',
  6: 'صيف',
  7: 'صيف',
  8: 'صيف',
  9: 'خريف',
  10: 'خريف',
  11: 'خريف',
  12: 'شتاء',
};

/** أنماط نص الرحلة → وسوم إضافية للمطابقة مع destination_tags في المنتجات */
const PLACE_HINTS: { re: RegExp; tags: string[] }[] = [
  { re: /سيول|سول|seoul|korea|كوريا/i, tags: ['سيول', 'سول', 'Seoul', 'كوريا', 'كوريا الجنوبية', 'آسيا', 'Korea'] },
  { re: /طوكيو|tokyo|اليابان|japan/i, tags: ['طوكيو', 'Tokyo', 'اليابان', 'Japan', 'آسيا'] },
  { re: /سويسرا|زيورخ|جنيف|switzerland|zurich|geneva/i, tags: ['سويسرا', 'زيورخ', 'جنيف', 'Switzerland', 'أوروبا'] },
  { re: /فرنسا|باريس|paris|france/i, tags: ['فرنسا', 'باريس', 'Paris', 'France', 'أوروبا'] },
  { re: /إيطاليا|ايطاليا|روما|ميلان|italy|rome|milan/i, tags: ['إيطاليا', 'روما', 'ميلان', 'Italy', 'أوروبا'] },
  { re: /إسبانيا|اسبانيا|مدريد|برشلونة|spain|madrid|barcelona/i, tags: ['إسبانيا', 'مدريد', 'برشلونة', 'Spain', 'أوروبا'] },
  { re: /المالديف|maldives/i, tags: ['المالديف', 'Maldives', 'آسيا'] },
  { re: /دبي|الإمارات|uae|dubai|emirates/i, tags: ['دبي', 'الإمارات', 'UAE', 'Dubai', 'آسيا'] },
  { re: /لندن|بريطانيا|المملكة المتحدة|uk|london|britain/i, tags: ['لندن', 'بريطانيا', 'UK', 'London', 'أوروبا'] },
  { re: /نيويورك|أمريكا|الولايات المتحدة|usa|new york|ny\b/i, tags: ['نيويورك', 'أمريكا', 'USA', 'New York', 'أمريكا الشمالية'] },
  { re: /النرويج|norway|أوسلو|oslo/i, tags: ['النرويج', 'Norway', 'أوروبا', 'شتاء'] },
  { re: /النمسا|فيينا|austria|vienna/i, tags: ['النمسا', 'فيينا', 'Austria', 'أوروبا'] },
  { re: /اليونان|greece|سانتوريني|athens/i, tags: ['اليونان', 'Greece', 'أوروبا'] },
  { re: /تركيا|اسطنبول|istanbul|turkey/i, tags: ['تركيا', 'إسطنبول', 'Turkey', 'آسيا', 'أوروبا'] },
  { re: /المغرب|مراكش|marrakech|morocco/i, tags: ['المغرب', 'مراكش', 'Morocco', 'إفريقيا'] },
];

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

function pushUnique(arr: string[], v: string) {
  const n = norm(v);
  if (n.length < 2) return;
  if (!arr.some((x) => norm(x) === n)) arr.push(v.trim());
}

function seasonsFromDateStrings(blob: string): string[] {
  const out: string[] = [];
  const iso = blob.match(/\d{4}-\d{2}-\d{2}/g) || [];
  for (const d of iso) {
    const m = Number(d.slice(5, 7));
    if (m >= 1 && m <= 12) {
      const s = MONTH_TO_SEASON_AR[m];
      pushUnique(out, s);
      if (s === 'شتاء') {
        pushUnique(out, 'Winter');
        pushUnique(out, 'winter');
      }
      if (s === 'صيف') {
        pushUnique(out, 'Summer');
        pushUnique(out, 'summer');
      }
      if (s === 'ربيع') {
        pushUnique(out, 'Spring');
        pushUnique(out, 'spring');
      }
      if (s === 'خريف') {
        pushUnique(out, 'Autumn');
        pushUnique(out, 'autumn');
      }
    }
  }
  return out;
}

function seasonsFromTitle(title: string): string[] {
  const out: string[] = [];
  const t = title;
  if (/شتاء|winter|ثلج|ski/i.test(t)) {
    pushUnique(out, 'شتاء');
    pushUnique(out, 'Winter');
  }
  if (/صيف|summer|شاطئ|بحر/i.test(t)) {
    pushUnique(out, 'صيف');
    pushUnique(out, 'Summer');
  }
  if (/ربيع|spring/i.test(t)) {
    pushUnique(out, 'ربيع');
    pushUnique(out, 'Spring');
  }
  if (/خريف|autumn|fall/i.test(t)) {
    pushUnique(out, 'خريف');
    pushUnique(out, 'Autumn');
  }
  return out;
}

function expandBlobWithHints(blob: string): string[] {
  const extra: string[] = [];
  for (const { re, tags } of PLACE_HINTS) {
    if (re.test(blob)) extra.push(...tags);
  }
  return extra;
}

export function buildTripMatchContext(input: {
  title: string | null | undefined;
  dates: string | null | undefined;
  days: TripDayForWardrobeMatch[];
}): { tokens: string[]; seasons: string[] } {
  const tokens: string[] = [];
  const seasons: string[] = [];

  const title = String(input.title || '').trim();
  const dates = String(input.dates || '').trim();

  const blobParts: string[] = [title, dates];
  for (const d of input.days || []) {
    blobParts.push(d.title || '', d.notes || '');
    blobParts.push(d.hotel?.city || '', d.hotel?.country || '', d.hotel?.name || '');
    blobParts.push(d.experience?.city || '', d.experience?.country || '', d.experience?.title || '');
  }
  const bigBlob = blobParts.filter(Boolean).join(' ');

  for (const part of blobParts) {
    const p = part.trim();
    if (!p) continue;
    pushUnique(tokens, p);
    for (const w of p.split(/[\s،,.|\/\-–—]+/)) {
      if (w.length >= 2) pushUnique(tokens, w);
    }
  }

  for (const x of expandBlobWithHints(bigBlob)) pushUnique(tokens, x);

  for (const s of seasonsFromDateStrings(dates)) pushUnique(seasons, s);
  for (const s of seasonsFromDateStrings(title)) pushUnique(seasons, s);
  for (const s of seasonsFromTitle(title)) pushUnique(seasons, s);

  return { tokens, seasons };
}

/** سياق يوم واحد (فندق/تجربة/ملاحظات) + عنوان الرحلة وتواريخها لموسم الرحلة */
export function buildDayMatchContext(
  day: TripDayForWardrobeMatch,
  trip: { title: string; dates: string },
): { tokens: string[]; seasons: string[] } {
  const tokens: string[] = [];
  const seasons: string[] = [];

  const title = String(trip.title || '').trim();
  const dates = String(trip.dates || '').trim();

  const blobParts: string[] = [title, dates, day.title || '', day.notes || ''];
  blobParts.push(day.hotel?.city || '', day.hotel?.country || '', day.hotel?.name || '');
  blobParts.push(day.experience?.city || '', day.experience?.country || '', day.experience?.title || '');
  const bigBlob = blobParts.filter(Boolean).join(' ');

  for (const part of blobParts) {
    const p = part.trim();
    if (!p) continue;
    pushUnique(tokens, p);
    for (const w of p.split(/[\s،,.|\/\-–—]+/)) {
      if (w.length >= 2) pushUnique(tokens, w);
    }
  }
  for (const x of expandBlobWithHints(bigBlob)) pushUnique(tokens, x);

  for (const s of seasonsFromDateStrings(dates)) pushUnique(seasons, s);
  for (const s of seasonsFromDateStrings(title)) pushUnique(seasons, s);
  for (const s of seasonsFromTitle(`${title} ${day.title || ''} ${day.notes || ''}`)) pushUnique(seasons, s);

  return { tokens, seasons };
}

/** قطعة واحدة مناسبة لهذا اليوم (مستقرة حسب stableSalt) */
export function pickOneWardrobeForDay(
  rows: WardrobeMatchRow[],
  day: TripDayForWardrobeMatch,
  trip: { title: string; dates: string },
  stableSalt: number,
): WardrobeMatchRow | null {
  if (!rows.length) return null;
  const dayCtx = buildDayMatchContext(day, trip);
  let matches = filterWardrobeForTrip(rows, dayCtx);
  if (!matches.length) {
    const tripCtx = buildTripMatchContext({ title: trip.title, dates: trip.dates, days: [day] });
    matches = filterWardrobeForTrip(rows, tripCtx);
  }
  if (!matches.length) return null;
  return matches[Math.abs(stableSalt) % matches.length];
}

function itemAllTags(row: WardrobeMatchRow): { season: string[]; dest: string[] } {
  const season = [
    ...(Array.isArray(row.season_tags) ? row.season_tags : []),
    ...(Array.isArray(row.seasons) ? row.seasons : []),
  ];
  const dest = [
    ...(Array.isArray(row.destination_tags) ? row.destination_tags : []),
    ...(Array.isArray(row.destinations) ? row.destinations : []),
  ];
  return { season, dest };
}

function anyMatch(a: string[], b: string[]): boolean {
  const bn = b.map(norm).filter(Boolean);
  for (const x of a) {
    const xn = norm(x);
    if (!xn) continue;
    for (const y of bn) {
      if (!y) continue;
      if (xn === y || xn.includes(y) || y.includes(xn)) return true;
    }
  }
  return false;
}

/** قطع تتطابق موسم أو وجهة مع سياق الرحلة */
export function filterWardrobeForTrip(rows: WardrobeMatchRow[], ctx: { tokens: string[]; seasons: string[] }): WardrobeMatchRow[] {
  if (!rows.length) return [];
  const tripSeasons = ctx.seasons.length ? ctx.seasons : [];
  const tripTokens = ctx.tokens;

  return rows.filter((row) => {
    const { season: sTags, dest: dTags } = itemAllTags(row);
    const destHit = dTags.length && tripTokens.length && anyMatch(dTags, tripTokens);
    const seasonHit = sTags.length && tripSeasons.length && anyMatch(sTags, tripSeasons);
    const crossSeasonInTitle =
      sTags.length &&
      tripTokens.length &&
      anyMatch(
        sTags,
        tripTokens.filter((t) =>
          ['شتاء', 'صيف', 'ربيع', 'خريف', 'winter', 'summer', 'spring', 'autumn', 'طوال العام'].some((k) => norm(t).includes(norm(k))),
        ),
      );
    const crossDestSeason =
      sTags.length && tripTokens.length && anyMatch(sTags, tripTokens) && dTags.length && anyMatch(dTags, tripTokens);
    return destHit || seasonHit || crossSeasonInTitle || crossDestSeason;
  });
}

export function purchaseHref(row: WardrobeMatchRow): string | null {
  const raw = (row.purchase_link || row.purchase_url || '').trim();
  if (!raw) return null;
  return raw.startsWith('http') ? raw : `https://${raw}`;
}
