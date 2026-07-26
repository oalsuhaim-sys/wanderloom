import { parseDnaInterests, parseTravelDnaForm } from '@/lib/clientsTravelDna';

/** اهتمامات DNA الموحّدة لميزة التطابق البشري */
export const FELLOWSHIP_INTERESTS = [
  'investment',
  'art',
  'architecture',
  'food',
  'active',
  'culture',
  'nature',
  'shopping',
  'spa',
  'sports',
  'history',
  'events',
] as const;

export type FellowshipInterest = (typeof FELLOWSHIP_INTERESTS)[number];

export type FellowshipInterestMeta = {
  key: FellowshipInterest;
  labelAr: string;
  labelEn: string;
  matchLabel: string;
};

export const FELLOWSHIP_INTEREST_META: Record<FellowshipInterest, FellowshipInterestMeta> = {
  investment: { key: 'investment', labelAr: 'الاستثمار', labelEn: 'Investment', matchLabel: 'عاشق الاستثمار' },
  art: { key: 'art', labelAr: 'الفن', labelEn: 'Art', matchLabel: 'عاشق الفن' },
  architecture: {
    key: 'architecture',
    labelAr: 'العمارة',
    labelEn: 'Architecture',
    matchLabel: 'عاشق العمارة',
  },
  food: { key: 'food', labelAr: 'الطعام', labelEn: 'Food', matchLabel: 'عاشق الطعام' },
  active: { key: 'active', labelAr: 'النشاط', labelEn: 'Active', matchLabel: 'روح مغامرة' },
  culture: { key: 'culture', labelAr: 'الثقافة', labelEn: 'Culture', matchLabel: 'عاشق الثقافة' },
  nature: { key: 'nature', labelAr: 'الطبيعة', labelEn: 'Nature', matchLabel: 'عاشق الطبيعة' },
  shopping: { key: 'shopping', labelAr: 'التسوق', labelEn: 'Shopping', matchLabel: 'عاشق التسوق' },
  spa: { key: 'spa', labelAr: 'السبا', labelEn: 'Spa', matchLabel: 'روح الاسترخاء' },
  sports: { key: 'sports', labelAr: 'الرياضة', labelEn: 'Sports', matchLabel: 'عاشق الرياضة' },
  history: { key: 'history', labelAr: 'التاريخ', labelEn: 'History', matchLabel: 'عاشق التاريخ' },
  events: { key: 'events', labelAr: 'الفعاليات', labelEn: 'Events', matchLabel: 'عاشق الفعاليات' },
};

/** اهتمامات مترابطة — مثال: فن × عمارة */
export const FELLOWSHIP_RELATED_INTERESTS: Record<FellowshipInterest, FellowshipInterest[]> = {
  investment: ['shopping', 'culture', 'architecture'],
  art: ['architecture', 'culture', 'history'],
  architecture: ['art', 'culture', 'history', 'investment'],
  food: ['culture', 'events', 'shopping'],
  active: ['sports', 'nature', 'events'],
  culture: ['art', 'architecture', 'history', 'food'],
  nature: ['active', 'sports', 'spa'],
  shopping: ['investment', 'food', 'culture'],
  spa: ['nature', 'culture'],
  sports: ['active', 'nature', 'events'],
  history: ['art', 'architecture', 'culture'],
  events: ['food', 'culture', 'active', 'sports'],
};

const ARABIC_INTEREST_ALIASES: Record<string, FellowshipInterest> = {
  استثمار: 'investment',
  الاستثمار: 'investment',
  فن: 'art',
  الفن: 'art',
  معارض: 'art',
  عمارة: 'architecture',
  العمارة: 'architecture',
  تصميم: 'architecture',
  طعام: 'food',
  مطاعم: 'food',
  المطاعم: 'food',
  مأكولات: 'food',
  نشاط: 'active',
  مغامرة: 'active',
  نشاطعالي: 'active',
  ثقافة: 'culture',
  الثقافة: 'culture',
  طبيعة: 'nature',
  الطبيعة: 'nature',
  تسوق: 'shopping',
  التسوق: 'shopping',
  سبا: 'spa',
  السبا: 'spa',
  استرخاء: 'spa',
  رياضة: 'sports',
  الرياضة: 'sports',
  تاريخ: 'history',
  التاريخ: 'history',
  فعاليات: 'events',
  الفعاليات: 'events',
  مهرجان: 'events',
};

const ENGLISH_INTEREST_ALIASES: Record<string, FellowshipInterest> = {
  investment: 'investment',
  invest: 'investment',
  art: 'art',
  arts: 'art',
  museum: 'art',
  gallery: 'art',
  architecture: 'architecture',
  architect: 'architecture',
  design: 'architecture',
  food: 'food',
  dining: 'food',
  culinary: 'food',
  restaurant: 'food',
  active: 'active',
  adventure: 'active',
  hiking: 'active',
  culture: 'culture',
  cultural: 'culture',
  heritage: 'culture',
  nature: 'nature',
  outdoor: 'nature',
  scenic: 'nature',
  shopping: 'shopping',
  retail: 'shopping',
  fashion: 'shopping',
  spa: 'spa',
  wellness: 'spa',
  relaxation: 'spa',
  sport: 'sports',
  sports: 'sports',
  athletic: 'sports',
  history: 'history',
  historical: 'history',
  historic: 'history',
  event: 'events',
  events: 'events',
  festival: 'events',
};

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function tokenToInterest(token: string): FellowshipInterest | null {
  const n = norm(token);
  if (!n) return null;

  if ((FELLOWSHIP_INTERESTS as readonly string[]).includes(n)) {
    return n as FellowshipInterest;
  }

  for (const [key, interest] of Object.entries(ARABIC_INTEREST_ALIASES)) {
    const kn = norm(key);
    if (n === kn || n.includes(kn) || kn.includes(n)) return interest;
  }

  for (const [key, interest] of Object.entries(ENGLISH_INTEREST_ALIASES)) {
    if (n === key || n.includes(key) || key.includes(n)) return interest;
  }

  return null;
}

export type FellowshipClientDna = {
  clientId: number;
  name: string;
  interests: FellowshipInterest[];
  priorityInterests: FellowshipInterest[];
  activityLevel: string;
  flightSeat: string;
};

export type FellowshipClientInput = {
  id: number;
  name?: string | null;
  travel_dna?: unknown;
  travel_dna_json?: unknown;
  dna_interests?: string | null;
  dna_activity_level?: string | null;
  flight_seat?: string | null;
};

/** يقرأ travel_dna (أو travel_dna_json) + dna_interests ويُوحّد الاهتمامات */
export function extractFellowshipInterests(client: FellowshipClientInput): FellowshipInterest[] {
  const dnaRaw = client.travel_dna_json ?? client.travel_dna;
  const dna = parseTravelDnaForm(dnaRaw);
  const tokens: string[] = [...parseDnaInterests(client.dna_interests)];

  if (dna.food_preference) tokens.push(dna.food_preference);
  if (dna.hotel_type) tokens.push(dna.hotel_type);
  if (dna.favorite_drink) tokens.push(dna.favorite_drink);

  const activity = String(client.dna_activity_level ?? '').trim();
  if (activity) tokens.push(activity);

  if (dnaRaw && typeof dnaRaw === 'object' && !Array.isArray(dnaRaw)) {
    const obj = dnaRaw as Record<string, unknown>;
    for (const key of ['interests', 'priority_interests', 'hobbies', 'passions']) {
      const v = obj[key];
      if (Array.isArray(v)) {
        for (const item of v) tokens.push(String(item));
      } else if (typeof v === 'string') {
        tokens.push(...parseDnaInterests(v));
      }
    }
  }

  const found = new Set<FellowshipInterest>();
  for (const token of tokens) {
    const mapped = tokenToInterest(token);
    if (mapped) found.add(mapped);
  }

  if (activity.includes('مغامرة') || activity.includes('نشاط')) found.add('active');
  if (activity.includes('استرخاء')) found.add('spa');

  return FELLOWSHIP_INTERESTS.filter((k) => found.has(k));
}

export function buildFellowshipClientDna(client: FellowshipClientInput): FellowshipClientDna {
  const interests = extractFellowshipInterests(client);
  const dna = parseTravelDnaForm(client.travel_dna_json ?? client.travel_dna);
  const priorityInterests = interests.slice(0, 3);

  return {
    clientId: client.id,
    name: String(client.name ?? '').trim() || `عميل #${client.id}`,
    interests,
    priorityInterests,
    activityLevel: String(client.dna_activity_level ?? '').trim(),
    flightSeat: String(client.flight_seat ?? dna.flight_seat ?? '').trim(),
  };
}

export type FellowshipPairMatch = {
  clientAId: number;
  clientBId: number;
  clientAName: string;
  clientBName: string;
  score: number;
  sharedInterests: FellowshipInterest[];
  bridgeInterests: { a: FellowshipInterest; b: FellowshipInterest }[];
  matchLabel: string;
};

export type FellowshipMatchResult = {
  clients: FellowshipClientDna[];
  pairs: FellowshipPairMatch[];
  clusters: number[][];
  seatPairs: FellowshipPairMatch[];
  dinnerTables: { tableIndex: number; clientIds: number[]; label: string }[];
};

function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function interestOverlapScore(
  a: FellowshipInterest[],
  b: FellowshipInterest[],
): { score: number; shared: FellowshipInterest[]; bridges: { a: FellowshipInterest; b: FellowshipInterest }[] } {
  let score = 0;
  const shared: FellowshipInterest[] = [];
  const bridges: { a: FellowshipInterest; b: FellowshipInterest }[] = [];

  for (const ia of a) {
    if (b.includes(ia)) {
      score += 3;
      shared.push(ia);
    }
  }

  for (const ia of a) {
    for (const ib of b) {
      if (ia === ib) continue;
      const relatedA = FELLOWSHIP_RELATED_INTERESTS[ia] ?? [];
      if (relatedA.includes(ib)) {
        score += 2;
        bridges.push({ a: ia, b: ib });
      }
    }
  }

  return { score, shared, bridges };
}

function buildMatchLabel(
  shared: FellowshipInterest[],
  bridges: { a: FellowshipInterest; b: FellowshipInterest }[],
): string {
  if (shared.length >= 2) {
    return `${FELLOWSHIP_INTEREST_META[shared[0]].matchLabel} × ${FELLOWSHIP_INTEREST_META[shared[1]].labelAr}`;
  }
  if (shared.length === 1) {
    return `${FELLOWSHIP_INTEREST_META[shared[0]].matchLabel} — توافق عميق`;
  }
  if (bridges.length > 0) {
    const b = bridges[0];
    return `${FELLOWSHIP_INTEREST_META[b.a].matchLabel} × ${FELLOWSHIP_INTEREST_META[b.b].labelAr}`;
  }
  return 'انسجام اجتماعي';
}

export function computeFellowshipMatches(inputs: FellowshipClientInput[]): FellowshipMatchResult {
  const clients = inputs.map(buildFellowshipClientDna);
  const pairMap = new Map<string, FellowshipPairMatch>();

  for (let i = 0; i < clients.length; i++) {
    for (let j = i + 1; j < clients.length; j++) {
      const ca = clients[i];
      const cb = clients[j];
      const priA = ca.priorityInterests.length ? ca.priorityInterests : ca.interests;
      const priB = cb.priorityInterests.length ? cb.priorityInterests : cb.interests;
      const { score, shared, bridges } = interestOverlapScore(priA, priB);

      let total = score;
      if (ca.activityLevel && cb.activityLevel && ca.activityLevel === cb.activityLevel) {
        total += 1;
      }

      if (total >= 2) {
        const key = pairKey(ca.clientId, cb.clientId);
        pairMap.set(key, {
          clientAId: ca.clientId,
          clientBId: cb.clientId,
          clientAName: ca.name,
          clientBName: cb.name,
          score: total,
          sharedInterests: shared,
          bridgeInterests: bridges,
          matchLabel: buildMatchLabel(shared, bridges),
        });
      }
    }
  }

  const pairs = [...pairMap.values()].sort((x, y) => y.score - x.score);

  const clusters: number[][] = [];
  const assigned = new Set<number>();

  for (const pair of pairs) {
    if (assigned.has(pair.clientAId) && assigned.has(pair.clientBId)) continue;

    let cluster = clusters.find(
      (c) => c.includes(pair.clientAId) || c.includes(pair.clientBId),
    );

    if (!cluster) {
      cluster = [];
      clusters.push(cluster);
    }

    if (!cluster.includes(pair.clientAId)) cluster.push(pair.clientAId);
    if (!cluster.includes(pair.clientBId)) cluster.push(pair.clientBId);
    assigned.add(pair.clientAId);
    assigned.add(pair.clientBId);
  }

  for (const c of clients) {
    if (!assigned.has(c.clientId)) {
      clusters.push([c.clientId]);
    }
  }

  const seatPairs = pairs.slice(0, Math.ceil(clients.length / 2));

  const dinnerTables: FellowshipMatchResult['dinnerTables'] = [];
  const tableSize = 4;
  let tableIndex = 1;

  for (const cluster of clusters) {
    for (let i = 0; i < cluster.length; i += tableSize) {
      const slice = cluster.slice(i, i + tableSize);
      const names = slice
        .map((id) => clients.find((c) => c.clientId === id)?.name ?? `#${id}`)
        .join(' · ');
      dinnerTables.push({
        tableIndex,
        clientIds: slice,
        label: names,
      });
      tableIndex += 1;
    }
  }

  return { clients, pairs, clusters, seatPairs, dinnerTables };
}

export function clampRegisteredClientIds(ids: number[], max = 10): number[] {
  const unique: number[] = [];
  for (const id of ids) {
    const n = Math.floor(Number(id));
    if (!Number.isFinite(n) || n <= 0) continue;
    if (!unique.includes(n)) unique.push(n);
    if (unique.length >= max) break;
  }
  return unique;
}

export function parseRegisteredClientIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return clampRegisteredClientIds(raw.map((v) => Number(v)));
}
