export type ActivityTicket = {
  id: string;
  title: string;
  date: string;
  ticket_number: string;
  /** @deprecated Per-ticket uploads removed — use Document Wallet instead */
  file_url?: string;
  /** @deprecated Per-ticket uploads removed — use Document Wallet instead */
  file_name?: string;
};

export function createEmptyActivityTicket(): ActivityTicket {
  return {
    id: `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: '',
    date: '',
    ticket_number: '',
  };
}

export function parseActivityTickets(raw: unknown): ActivityTicket[] {
  if (raw == null) return [];

  let data: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      data = JSON.parse(trimmed) as unknown;
    } catch {
      return [];
    }
  }

  if (!Array.isArray(data)) return [];

  const tickets: ActivityTicket[] = [];
  data.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const row = item as Record<string, unknown>;
    const title = String(row.title ?? row.activity_name ?? row.name ?? '').trim();
    if (!title) return;
    tickets.push({
      id: String(row.id ?? `ticket-${index}`),
      title,
      date: String(row.date ?? row.entry_date ?? row.datetime ?? '').trim(),
      ticket_number: String(row.ticket_number ?? row.confirmation ?? row.pnr ?? '').trim(),
      file_url: String(row.file_url ?? row.attachment_url ?? '').trim() || undefined,
      file_name: String(row.file_name ?? row.attachment_name ?? '').trim() || undefined,
    });
  });
  return tickets;
}

export function serializeActivityTickets(tickets: ActivityTicket[]): Record<string, unknown>[] {
  return tickets
    .filter((t) => t.title.trim())
    .map((t) => ({
      id: t.id,
      title: t.title.trim(),
      date: t.date.trim() || null,
      ticket_number: t.ticket_number.trim() || null,
    }));
}

type QuotationActivityLike = {
  id?: string;
  name?: string;
  title?: string;
  activity_name?: string;
  description?: string;
  location?: string;
  date?: string;
  ticket_number?: string;
  confirmation?: string;
  pnr?: string;
  price?: number;
  is_selected_by_client?: boolean;
};

type QuotationActivitiesSource = {
  activity_options?: QuotationActivityLike[];
  activities_proposals?: QuotationActivityLike[];
  activities?: unknown;
  start_date?: string | null;
};

function ticketId(prefix: string, index: number, existing?: string): string {
  const id = String(existing ?? '').trim();
  if (id) return id.startsWith('ticket-') ? id : `ticket-q-${id}`;
  return `ticket-q-${prefix}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

function mapActivityLikeToTicket(
  item: QuotationActivityLike,
  index: number,
  fallbackDate: string,
): ActivityTicket | null {
  const title = String(
    item.title ?? item.activity_name ?? item.name ?? '',
  ).trim();
  if (!title) return null;

  const location = String(item.location ?? '').trim();
  const enrichedTitle =
    location && !title.includes(location) ? `${title} — ${location}` : title;

  return {
    id: ticketId('act', index, item.id),
    title: enrichedTitle,
    date: String(item.date ?? '').trim() || fallbackDate,
    ticket_number: String(
      item.ticket_number ?? item.confirmation ?? item.pnr ?? '',
    ).trim(),
  };
}

/**
 * Maps quotation activity options / proposals into itinerary ActivityTicket rows
 * for the builder “تذاكر الفعاليات والدخول” section.
 *
 * Preference order:
 * 1) activity_options marked is_selected_by_client
 * 2) all named activity_options
 * 3) activities_proposals
 * 4) raw activities / activities_details JSON (via parseActivityTickets)
 */
export function activityTicketsFromQuotation(
  source: QuotationActivitiesSource | null | undefined,
): ActivityTicket[] {
  if (!source) return [];

  const fallbackDate = String(source.start_date ?? '').trim().slice(0, 10);

  const options = Array.isArray(source.activity_options)
    ? source.activity_options
    : [];
  const selected = options.filter(
    (o) => o?.is_selected_by_client === true && String(o.name ?? o.title ?? '').trim(),
  );
  const namedOptions = options.filter((o) =>
    String(o?.name ?? o?.title ?? o?.activity_name ?? '').trim(),
  );
  const optionSource = selected.length > 0 ? selected : namedOptions;

  if (optionSource.length > 0) {
    return optionSource
      .map((item, index) => mapActivityLikeToTicket(item, index, fallbackDate))
      .filter((t): t is ActivityTicket => t != null);
  }

  const proposals = Array.isArray(source.activities_proposals)
    ? source.activities_proposals
    : [];
  if (proposals.length > 0) {
    const mapped = proposals
      .map((item, index) => mapActivityLikeToTicket(item, index, fallbackDate))
      .filter((t): t is ActivityTicket => t != null);
    if (mapped.length > 0) return mapped;
  }

  return parseActivityTickets(source.activities);
}
