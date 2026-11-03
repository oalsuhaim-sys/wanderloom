import type { SupabaseClient } from '@supabase/supabase-js';

export type ClientFollowup = {
  id: string;
  clientId: string;
  clientName?: string | null;
  agentName: string;
  agentEmployeeId: string | null;
  notes: string;
  createdAt: string;
};

export type FollowupClientRef = {
  id?: string | number | null;
  client_id?: string | number | null;
  name?: string | null;
};

/** يقرأ المعرف من clientId أو client_id أو client.id — يتجاهل undefined/null/فراغ */
export function resolveFollowupClientId(source: {
  clientId?: unknown;
  client_id?: unknown;
  client?: FollowupClientRef | null;
}): string {
  const nested = source.client && typeof source.client === 'object' ? source.client : null;
  const raw = source.clientId ?? source.client_id ?? nested?.id ?? nested?.client_id;
  if (raw == null) return '';
  const text = String(raw).trim();
  if (!text || text === 'undefined' || text === 'null' || text === 'NaN') return '';
  return text;
}

const LOCAL_FOLLOWUPS_KEY = 'wanderloom.client-followups';
export const ALL_FOLLOWUPS_STORAGE_KEY = 'wanderloom_all_followups';
export const WANDERLOOM_FOLLOWUPS_KEY = 'wanderloom_followups';

export function followupStatusStorageKey(clientId: string): string {
  return `followup_status_${canonicalFollowupClientId(clientId)}`;
}
export const CLIENT_FOLLOWUPS_CHANGED_EVENT = 'wanderloom:client-followups-changed';
export const FOLLOWUP_UPDATED_EVENT = 'followup-updated';
export const FOLLOWUP_SAVED_EVENT = 'followup-saved';

export function followupsStorageKey(clientId: string): string {
  return `wanderloom_followups_${canonicalFollowupClientId(clientId)}`;
}

/** نفس المعرف الظاهر في صفحة العميل: client.id أو params.id، بدون تحويل UUID إلى رقم. */
export function canonicalFollowupClientId(value: unknown): string {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text || text === 'undefined' || text === 'null' || text === 'NaN') return '';
  return text;
}

export function followupClientIdsMatch(left: unknown, right: unknown): boolean {
  const a = canonicalFollowupClientId(left);
  const b = canonicalFollowupClientId(right);
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/** معرّف كامل + الجزء الأخير من UUID للمطابقة المرنة. */
export function followupIdNeedles(clientId: string): string[] {
  const key = canonicalFollowupClientId(clientId);
  if (!key) return [];
  const last = key.includes('-') ? key.split('-').pop() ?? '' : '';
  return [...new Set([key, last].map((part) => part.trim()).filter((part) => part.length >= 4))];
}

export function followupIdsLooselyMatch(storedId: unknown, clientId: string): boolean {
  const hay = canonicalFollowupClientId(storedId).toLowerCase();
  if (!hay) return false;
  return followupIdNeedles(clientId).some((needle) => {
    const token = needle.toLowerCase();
    return hay === token || hay.includes(token) || token.includes(hay);
  });
}

export function followupNamesMatch(left?: string | null, right?: string | null): boolean {
  const a = String(left ?? '').trim().toLowerCase();
  const b = String(right ?? '').trim().toLowerCase();
  return Boolean(a && b && a === b);
}
const EMPLOYEE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ClientFollowupsTableMissingError extends Error {
  readonly code = 'CLIENT_FOLLOWUPS_TABLE_MISSING';

  constructor() {
    super('client_followups relation does not exist');
    this.name = 'ClientFollowupsTableMissingError';
  }
}

/** أعمدة supabase/sql/client_followups.sql: الجدول غير مُنشأ أو غير ظاهر في الـ schema cache. */
export function isMissingClientFollowupsTable(message: string, code?: string): boolean {
  const msg = `${code ?? ''} ${message}`.toLowerCase();
  return (
    msg.includes('schema cache') ||
    msg.includes('42p01') ||
    msg.includes('pgrst205') ||
    msg.includes('could not find the table') ||
    msg.includes('client_followups.sql') ||
    (msg.includes('client_followups') &&
      (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema')))
  );
}

function optionalEmployeeUuid(value: string | null | undefined): string | null {
  const text = String(value ?? '').trim();
  return EMPLOYEE_UUID.test(text) ? text : null;
}

export function buildFallbackFollowup(input: {
  clientId: string | number;
  clientName?: string | null;
  agentName: string;
  agentEmployeeId?: string | null;
  notes: string;
  createdAt?: string;
}): ClientFollowup {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `local-${crypto.randomUUID()}`
      : `local-${Date.now()}`;
  return {
    id,
    clientId: String(input.clientId).trim(),
    clientName: input.clientName ? String(input.clientName).trim() : null,
    agentName: String(input.agentName ?? '').trim() || 'موظف',
    agentEmployeeId: optionalEmployeeUuid(input.agentEmployeeId),
    notes: String(input.notes ?? '').trim(),
    createdAt,
  };
}

export function readLocalFollowups(): ClientFollowup[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_FOLLOWUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => parseFollowupRow(row as Record<string, unknown>))
      .filter((row): row is ClientFollowup => row != null);
  } catch {
    return [];
  }
}

function parseStoredList(raw: string | null): ClientFollowup[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => parseFollowupRow(row as Record<string, unknown>))
      .filter((row): row is ClientFollowup => row != null);
  } catch {
    return [];
  }
}

function readEveryLocalFollowup(): ClientFollowup[] {
  if (typeof window === 'undefined') return [];
  const rows = [
    ...readLocalFollowups(),
    ...parseStoredList(window.localStorage.getItem(ALL_FOLLOWUPS_STORAGE_KEY)),
    ...parseStoredList(window.localStorage.getItem(WANDERLOOM_FOLLOWUPS_KEY)),
  ];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const storageKey = window.localStorage.key(index);
    if (!storageKey) continue;
    if (
      !storageKey.startsWith('followups_') &&
      !storageKey.startsWith('wanderloom_followups_') &&
      !storageKey.startsWith('followup_status_')
    ) {
      continue;
    }
    const raw = window.localStorage.getItem(storageKey);
    if (storageKey.startsWith('followup_status_')) {
      try {
        const parsed = parseFollowupRow(JSON.parse(raw ?? 'null') as Record<string, unknown>);
        if (parsed) rows.push(parsed);
      } catch {
        rows.push(...parseStoredList(raw));
      }
      continue;
    }
    rows.push(...parseStoredList(raw));
  }
  return rows;
}

/** يقرأ مفتاح العميل `wanderloom_followups_${params.id}` والمفتاح العام. */
export function readWanderloomFollowups(clientId: string, clientName?: string | null): ClientFollowup[] {
  const key = canonicalFollowupClientId(clientId);
  if (!key || typeof window === 'undefined') return [];
  const byClient = [
    ...parseStoredList(window.localStorage.getItem(followupsStorageKey(key))),
    ...parseStoredList(window.localStorage.getItem(followupStatusStorageKey(key))),
  ];
  try {
    const status = parseFollowupRow(
      JSON.parse(window.localStorage.getItem(followupStatusStorageKey(key)) ?? 'null') as Record<string, unknown>,
    );
    if (status) byClient.unshift(status);
  } catch {
    /* المفتاح قد يكون قائمة */
  }
  const fromAll = [
    ...parseStoredList(window.localStorage.getItem(WANDERLOOM_FOLLOWUPS_KEY)),
    ...parseStoredList(window.localStorage.getItem(ALL_FOLLOWUPS_STORAGE_KEY)),
  ].filter((row) => followupIdsLooselyMatch(row.clientId, key) || followupNamesMatch(row.clientName, clientName));
  return mergeFollowupLists(byClient, fromAll);
}

function assertStoredFollowup(key: string, followup: ClientFollowup, asList: boolean): void {
  const raw = window.localStorage.getItem(key);
  if (!raw) throw new Error('تعذر تأكيد حفظ المتابعة في المتصفح.');
  const rows = asList
    ? parseStoredList(raw)
    : [parseFollowupRow(JSON.parse(raw) as Record<string, unknown>)].filter((row): row is ClientFollowup => row != null);
  const found = rows.some((row) => row.id === followup.id && row.notes === followup.notes);
  if (!found) throw new Error('تعذر تأكيد حفظ المتابعة في المتصفح.');
}

export function readClientLocalFollowups(clientId: string, clientName?: string | null): ClientFollowup[] {
  const key = canonicalFollowupClientId(clientId);
  if (!key || typeof window === 'undefined') return [];
  const matched = readEveryLocalFollowup().filter(
    (row) => followupIdsLooselyMatch(row.clientId, key) || followupNamesMatch(row.clientName, clientName),
  );
  return mergeFollowupLists(matched, []);
}

export function persistLocalFollowup(followup: ClientFollowup): ClientFollowup {
  const stored: ClientFollowup = {
    ...followup,
    clientId: canonicalFollowupClientId(followup.clientId),
  };
  if (typeof window === 'undefined' || !stored.clientId) return stored;

  const bucketKey = followupsStorageKey(stored.clientId);
  const bucket = parseStoredList(window.localStorage.getItem(bucketKey));
  window.localStorage.setItem(
    bucketKey,
    JSON.stringify([stored, ...bucket.filter((row) => row.id !== stored.id)].slice(0, 200)),
  );
  assertStoredFollowup(bucketKey, stored, true);

  const statusKey = followupStatusStorageKey(stored.clientId);
  window.localStorage.setItem(statusKey, JSON.stringify(stored));
  assertStoredFollowup(statusKey, stored, false);

  const catalog = parseStoredList(window.localStorage.getItem(WANDERLOOM_FOLLOWUPS_KEY));
  window.localStorage.setItem(
    WANDERLOOM_FOLLOWUPS_KEY,
    JSON.stringify([stored, ...catalog.filter((row) => row.id !== stored.id)].slice(0, 200)),
  );
  assertStoredFollowup(WANDERLOOM_FOLLOWUPS_KEY, stored, true);

  const all = parseStoredList(window.localStorage.getItem(ALL_FOLLOWUPS_STORAGE_KEY));
  window.localStorage.setItem(
    ALL_FOLLOWUPS_STORAGE_KEY,
    JSON.stringify([stored, ...all.filter((row) => row.id !== stored.id)].slice(0, 200)),
  );

  const legacy = [stored, ...readLocalFollowups().filter((row) => row.id !== stored.id)].slice(0, 200);
  window.localStorage.setItem(LOCAL_FOLLOWUPS_KEY, JSON.stringify(legacy));

  const detail = stored;
  window.dispatchEvent(new CustomEvent(FOLLOWUP_UPDATED_EVENT, { detail }));
  window.dispatchEvent(new CustomEvent(CLIENT_FOLLOWUPS_CHANGED_EVENT, { detail }));
  window.dispatchEvent(
    new CustomEvent(FOLLOWUP_SAVED_EVENT, { detail: { clientId: stored.clientId } }),
  );
  return stored;
}

export function notifyFollowupUpdated(followup: ClientFollowup): void {
  if (typeof window === 'undefined') return;
  const clientId = canonicalFollowupClientId(followup.clientId);
  window.dispatchEvent(new CustomEvent(FOLLOWUP_UPDATED_EVENT, { detail: followup }));
  window.dispatchEvent(new CustomEvent(FOLLOWUP_SAVED_EVENT, { detail: { clientId } }));
}

function localFollowupsForClient(clientId: string): ClientFollowup[] {
  return readClientLocalFollowups(clientId);
}

/** حالة «تم التواصل اليوم» من followup_status و wanderloom_followups. */
export function readTodayFollowupStatuses(clientIds: Array<string | number>): Record<string, ClientFollowup> {
  const map: Record<string, ClientFollowup> = {};
  for (const rawId of clientIds) {
    const key = canonicalFollowupClientId(rawId);
    if (!key) continue;
    const rows = readWanderloomFollowups(key).filter((row) => isFollowupFromToday(row.createdAt));
    const latest = rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    if (latest) map[key] = latest;
  }
  return map;
}

function mergeFollowupLists(remote: ClientFollowup[], local: ClientFollowup[]): ClientFollowup[] {
  const seen = new Set<string>();
  const merged: ClientFollowup[] = [];
  for (const row of [...local, ...remote]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** رقم صحيح يُخزَّن كـ number ليطابق عمود client_id bigint، وأي نص آخر يُمرَّر كما هو. */
function coerceStoredClientId(resolvedId: string): string | number | null {
  if (!resolvedId) return null;
  if (/^-?\d+$/.test(resolvedId)) {
    const asNumber = Number(resolvedId);
    if (Number.isFinite(asNumber)) return asNumber;
  }
  return resolvedId;
}

function parseFollowupRow(row: Record<string, unknown>): ClientFollowup | null {
  const id = row.id != null ? String(row.id) : '';
  const clientRaw = row.client_id ?? row.clientId;
  const clientId = clientRaw != null ? String(clientRaw).trim() : '';
  if (!id || !clientId) return null;
  const employeeRaw = row.agent_employee_id ?? row.agentEmployeeId;
  const nameRaw = row.client_name ?? row.clientName;
  return {
    id,
    clientId,
    clientName: nameRaw != null && String(nameRaw).trim() ? String(nameRaw).trim() : null,
    agentName: String(row.agent_name ?? row.agentName ?? '').trim() || 'موظف',
    agentEmployeeId: employeeRaw != null && String(employeeRaw).trim() ? String(employeeRaw) : null,
    notes: String(row.notes ?? '').trim(),
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
  };
}

export function formatFollowupDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ar-SA-u-ca-gregory-nu-latn', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isFollowupFromToday(iso: string, reference = new Date()): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === reference.getFullYear() &&
    d.getMonth() === reference.getMonth() &&
    d.getDate() === reference.getDate()
  );
}

/** أحدث متابعة اليوم لكل عميل — لشارات «تم التواصل» في الرادار */
export async function fetchTodaysFollowupsByClientIds(
  supabase: SupabaseClient,
  clientIds: Array<string | number>,
): Promise<Record<string, ClientFollowup>> {
  const ids = [
    ...new Set(
      clientIds
        .map((id) => Number(id))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ];
  if (!ids.length) return readTodaysLocalFollowups(clientIds);

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('client_followups')
    .select('id, client_id, agent_name, agent_employee_id, notes, created_at')
    .in('client_id', ids)
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: false });

  const map: Record<string, ClientFollowup> = {};
  if (error) {
    console.warn('[client_followups] today fetch:', error.message);
  } else {
    for (const row of data ?? []) {
      const parsed = parseFollowupRow(row as Record<string, unknown>);
      if (!parsed) continue;
      if (!map[parsed.clientId]) map[parsed.clientId] = parsed;
    }
  }

  return { ...map, ...readTodaysLocalFollowups(clientIds, map) };
}

export function readTodaysLocalFollowups(
  clientIds: Array<string | number>,
  existing: Record<string, ClientFollowup> = {},
): Record<string, ClientFollowup> {
  const wanted = clientIds.map((id) => canonicalFollowupClientId(id)).filter(Boolean);
  const map = { ...existing };
  const localRows = wanted.flatMap((id) => readClientLocalFollowups(id));
  for (const row of localRows) {
    if (!wanted.some((id) => followupClientIdsMatch(row.clientId, id)) || !isFollowupFromToday(row.createdAt)) continue;
    const current = map[row.clientId];
    if (!current || row.createdAt > current.createdAt) map[row.clientId] = row;
  }
  return map;
}

function isClientIdTypeMismatch(message: string): boolean {
  const msg = message.toLowerCase();
  return msg.includes('invalid input syntax') || msg.includes('22p02');
}

export async function fetchClientFollowups(
  supabase: SupabaseClient,
  clientId: string | number,
  options?: { limit?: number },
): Promise<ClientFollowup[]> {
  const key = canonicalFollowupClientId(clientId);
  const local = localFollowupsForClient(key);
  if (!key) return [];

  const limit = options?.limit ?? 50;
  const columns = 'id, client_id, agent_name, agent_employee_id, notes, created_at';
  const needles = followupIdNeedles(key).map((needle) => needle.replace(/[^a-zA-Z0-9-]/g, ''));
  const orFilter = needles
    .flatMap((needle) => {
      const quoted = `"${needle}"`;
      const parts = [`client_id.eq.${quoted}`, `client_id.ilike.%${needle}%`];
      if (/^-?\d+$/.test(needle)) parts.push(`client_id.eq.${Number(needle)}`);
      return parts;
    })
    .join(',');

  let data: unknown[] | null = null;
  let error: { message: string; code?: string } | null = null;
  if (orFilter) {
    const flexible = await supabase
      .from('client_followups')
      .select(columns)
      .or(orFilter)
      .order('created_at', { ascending: false })
      .limit(limit);
    data = flexible.data;
    error = flexible.error;
  }

  if (error || !data?.length) {
    const broad = await supabase
      .from('client_followups')
      .select(columns)
      .order('created_at', { ascending: false })
      .limit(200);
    if (!broad.error && broad.data?.length) {
      data = broad.data.filter((row) => followupIdsLooselyMatch((row as { client_id?: unknown }).client_id, key));
      error = null;
    } else if (broad.error && !error) {
      error = broad.error;
    }
  }

  const remote = error
    ? []
    : (data ?? [])
        .map((row) => parseFollowupRow(row as Record<string, unknown>))
        .filter((f): f is ClientFollowup => f != null && followupIdsLooselyMatch(f.clientId, key));

  if (
    error &&
    !isMissingClientFollowupsTable(error.message, error.code) &&
    !isClientIdTypeMismatch(error.message) &&
    local.length === 0
  ) {
    console.warn('[client_followups] list:', error.message);
    throw error;
  }

  return mergeFollowupLists(remote, local).slice(0, limit);
}

export async function createClientFollowup(
  supabase: SupabaseClient,
  input: {
    clientId?: string | number | null;
    client_id?: string | number | null;
    client?: FollowupClientRef | null;
    agentName: string;
    agentEmployeeId?: string | null;
    notes: string;
  },
): Promise<ClientFollowup> {
  const resolvedId = resolveFollowupClientId(input);
  const storedClientId = coerceStoredClientId(resolvedId);
  if (storedClientId == null) {
    throw new Error('معرّف العميل غير صالح.');
  }
  const agentName = String(input.agentName ?? '').trim();
  if (!agentName) {
    throw new Error('اسم الموظف مطلوب.');
  }
  const notes = String(input.notes ?? '').trim();
  if (!notes) {
    throw new Error('اكتب ملاحظات المتابعة قبل الحفظ.');
  }

  const payload: Record<string, unknown> = {
    client_id: storedClientId,
    agent_name: agentName,
    notes,
  };
  const employeeId = optionalEmployeeUuid(input.agentEmployeeId);
  if (employeeId) payload.agent_employee_id = employeeId;

  const columns = 'id, client_id, agent_name, agent_employee_id, notes, created_at';
  let { data, error } = await supabase.from('client_followups').insert(payload).select(columns).single();

  if (error && employeeId && /agent_employee_id|employees|23503/i.test(String(error.message ?? ''))) {
    const { agent_employee_id: _omit, ...withoutEmployee } = payload;
    void _omit;
    ({ data, error } = await supabase
      .from('client_followups')
      .insert(withoutEmployee)
      .select(columns)
      .single());
  }

  if (error) {
    if (isMissingClientFollowupsTable(String(error.message ?? ''), error.code)) {
      throw new ClientFollowupsTableMissingError();
    }
    throw error;
  }

  const parsed = parseFollowupRow((data ?? {}) as Record<string, unknown>);
  if (!parsed) throw new Error('تعذر قراءة سجل المتابعة بعد الحفظ.');
  return parsed;
}
