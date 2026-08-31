import type { VipClientProfile } from '@/lib/clientsTravelDna';

function csvEscape(value: unknown): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/**
 * Downloads the official clients directory as `clients_database.csv`.
 */
export function exportClientsToCSV(clients: VipClientProfile[]): void {
  if (typeof window === 'undefined') return;

  const header = ['Name', 'Phone', 'Email', 'Created At'];
  const rows = clients.map((c) => [
    csvEscape(c.name),
    csvEscape(c.phone_wa),
    csvEscape(c.email),
    csvEscape(c.created_at ?? ''),
  ]);

  const bom = '\uFEFF';
  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'clients_database.csv';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
