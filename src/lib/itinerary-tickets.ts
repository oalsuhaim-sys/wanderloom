export type ActivityTicket = {
  id: string;
  title: string;
  date: string;
  ticket_number: string;
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

  return data
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const title = String(row.title ?? row.activity_name ?? row.name ?? '').trim();
      if (!title) return null;
      return {
        id: String(row.id ?? `ticket-${index}`),
        title,
        date: String(row.date ?? row.entry_date ?? row.datetime ?? '').trim(),
        ticket_number: String(row.ticket_number ?? row.confirmation ?? row.pnr ?? '').trim(),
      } satisfies ActivityTicket;
    })
    .filter((t): t is ActivityTicket => t != null);
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
